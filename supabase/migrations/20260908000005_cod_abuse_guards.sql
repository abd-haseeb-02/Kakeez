-- ============================================================================
-- COD abuse guards in create_order
-- ============================================================================
-- store_settings has carried cod.* keys since the initial seed, but nothing
-- ever read them, so the cod_blocklist table and the per-phone daily cap were
-- decorative. This wires up the two guards that cannot reject legitimate
-- revenue:
--
--   * cod_blocklist  — only ever blocks a phone/area an admin explicitly added
--                      (the table is empty today, so no behaviour change).
--   * cod.max_orders_per_phone_per_day — stops one number spamming orders.
--
-- Deliberately NOT enforced here:
--   * cod.first_order_max_total_minor (500000 = Rs 5,000). Order KKZ-000001 was
--     Rs 5,071, so switching this on would have rejected a real customer. It is
--     a pricing/risk decision for the owner, not a bug fix.
--   * cod.delivery_cities_allowlist. City is free text at checkout, so an
--     allow-list would reject "Lahore Cantt" and similar. Needs a proper city
--     picker first.
--   * cod.max_orders_per_ip_per_day — the database never sees the client IP.
--
-- Everything else in create_order is byte-for-byte the previous definition.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_order(
  p_cart jsonb, p_address jsonb, p_payment_method text, p_promo_code text, p_is_gift boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_uid              uuid := auth.uid();
  v_order_id         uuid;
  v_order_number     text;
  v_item             jsonb;
  v_product_id       uuid;
  v_variation_id     uuid;
  v_qty              integer;
  v_product          public.products%ROWTYPE;
  v_variation        public.product_variations%ROWTYPE;
  v_unit_minor       bigint;
  v_subtotal_minor   bigint := 0;
  v_delivery_minor   bigint := 0;
  v_discount_minor   bigint := 0;
  v_tax_minor        bigint := 0;
  v_total_minor      bigint := 0;
  v_hero_path        text;
  v_email            text;
  v_phone            text;
  v_full_name        text;
  v_promo            record;
  v_free_shipping    boolean := false;
  v_area             text;
  v_max_per_phone    int;
  v_today_count      int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  IF coalesce(p_payment_method, 'cod') <> 'cod' THEN
    RAISE EXCEPTION 'payment_method_unsupported' USING ERRCODE = '22023';
  END IF;

  IF p_cart IS NULL
     OR jsonb_typeof(p_cart) <> 'array'
     OR jsonb_array_length(p_cart) = 0 THEN
    RAISE EXCEPTION 'empty_cart' USING ERRCODE = '22023';
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;

  SELECT full_name, phone_e164 INTO v_full_name, v_phone
    FROM public.profiles
   WHERE id = v_uid;

  v_phone := COALESCE(p_address->>'phone_e164', v_phone, '');

  IF coalesce(v_email, '') = '' THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  -- ── COD abuse guards ──────────────────────────────────────────────────────
  -- A blocked customer must not be able to keep placing cash orders.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND blocked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'account_blocked' USING ERRCODE = '42501';
  END IF;

  v_area := lower(coalesce(p_address->>'area', ''));
  IF EXISTS (
    SELECT 1 FROM public.cod_blocklist b
     WHERE (b.phone_e164 IS NOT NULL AND b.phone_e164 = v_phone)
        OR (b.area_slug IS NOT NULL AND v_area <> '' AND lower(b.area_slug) = v_area)
  ) THEN
    RAISE EXCEPTION 'cod_blocked' USING ERRCODE = '42501';
  END IF;

  SELECT (value #>> '{}')::int INTO v_max_per_phone
    FROM public.store_settings WHERE key = 'cod.max_orders_per_phone_per_day';

  IF v_max_per_phone IS NOT NULL AND v_max_per_phone > 0 AND coalesce(v_phone, '') <> '' THEN
    SELECT COUNT(*) INTO v_today_count
      FROM public.orders
     WHERE customer_phone = v_phone
       AND created_at >= date_trunc('day', now())
       AND status <> 'cancelled';
    IF v_today_count >= v_max_per_phone THEN
      RAISE EXCEPTION 'too_many_orders_today' USING ERRCODE = '42501';
    END IF;
  END IF;
  -- ──────────────────────────────────────────────────────────────────────────

  v_order_number := 'KKZ-' || lpad(nextval('public.order_number_seq')::text, 6, '0');

  INSERT INTO public.orders (
    order_number, user_id, channel,
    customer_name, customer_email, customer_phone,
    delivery_address_snapshot,
    subtotal_minor, discount_minor, tax_minor, delivery_fee_minor, total_minor,
    currency, payment_method, payment_status, status,
    delivery_slot_date, delivery_slot_window,
    is_gift, customer_note, coupon_code
  ) VALUES (
    v_order_number, v_uid, 'web',
    COALESCE(p_address->>'recipient_name', v_full_name, split_part(v_email, '@', 1)),
    v_email, v_phone,
    coalesce(p_address, '{}'::jsonb),
    0, 0, 0, 0, 0,
    'PKR', 'cod', 'unpaid', 'pending_confirmation',
    NULLIF(p_address->>'delivery_slot_date', '')::date,
    NULLIF(p_address->>'delivery_slot_window', ''),
    COALESCE(p_is_gift, false),
    p_address->>'instructions',
    NULLIF(p_promo_code, '')
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart) LOOP
    v_product_id   := (v_item->>'productId')::uuid;
    v_variation_id := NULLIF(v_item->>'variationId', '')::uuid;
    v_qty          := COALESCE((v_item->>'quantity')::int, 0);

    IF v_product_id IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'invalid_cart_shape' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_product
      FROM public.products
     WHERE id = v_product_id
       AND status = 'published'
       AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found:%', v_product_id USING ERRCODE = '22023';
    END IF;

    v_unit_minor := v_product.base_price_minor;

    IF v_variation_id IS NOT NULL THEN
      SELECT * INTO v_variation
        FROM public.product_variations
       WHERE id = v_variation_id
         AND product_id = v_product_id
         AND is_active
         AND deleted_at IS NULL
       FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'variation_not_found:%', v_variation_id USING ERRCODE = '22023';
      END IF;

      v_unit_minor := v_unit_minor + v_variation.price_delta_minor;

      IF v_variation.track_inventory THEN
        IF v_variation.stock_quantity < v_qty THEN
          RAISE EXCEPTION 'out_of_stock:%', v_variation_id USING ERRCODE = '22023';
        END IF;

        UPDATE public.product_variations
           SET stock_quantity = stock_quantity - v_qty
         WHERE id = v_variation_id;

        INSERT INTO public.inventory_movements (variation_id, change, reason, order_id, created_by)
        VALUES (v_variation_id, -v_qty, 'order', v_order_id, v_uid);
      END IF;
    ELSIF v_product.track_inventory THEN
      IF v_product.stock_quantity < v_qty THEN
        RAISE EXCEPTION 'out_of_stock:%', v_product_id USING ERRCODE = '22023';
      END IF;

      UPDATE public.products
         SET stock_quantity = stock_quantity - v_qty
       WHERE id = v_product_id;

      INSERT INTO public.inventory_movements (product_id, change, reason, order_id, created_by)
      VALUES (v_product_id, -v_qty, 'order', v_order_id, v_uid);
    END IF;

    SELECT storage_path INTO v_hero_path
      FROM public.product_images
     WHERE product_id = v_product_id
     ORDER BY is_featured DESC NULLS LAST, position ASC
     LIMIT 1;

    INSERT INTO public.order_items (
      order_id, product_id, variation_id,
      product_name_snapshot, product_sku_snapshot,
      variation_label_snapshot, image_storage_path_snapshot,
      is_perishable_snapshot,
      unit_price_minor_snapshot, quantity, line_total_minor_snapshot,
      customer_notes
    ) VALUES (
      v_order_id, v_product_id, v_variation_id,
      v_product.name, v_product.sku, NULL, v_hero_path,
      v_product.is_perishable,
      v_unit_minor, v_qty, v_unit_minor * v_qty,
      v_item->>'customMessage'
    );

    v_subtotal_minor := v_subtotal_minor + v_unit_minor * v_qty;
  END LOOP;

  SELECT * INTO v_promo
    FROM public.apply_promo_minor(p_promo_code, v_uid, v_subtotal_minor);

  v_discount_minor := COALESCE(v_promo.discount, 0);

  IF v_promo.coupon_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
        FROM public.coupons
       WHERE id = v_promo.coupon_id
         AND type = 'free_shipping'
    ) THEN
      v_free_shipping := true;
    END IF;
  END IF;

  IF v_free_shipping THEN
    v_delivery_minor := 0;
  ELSE
    v_delivery_minor := public.compute_delivery_minor(p_address);
  END IF;

  v_tax_minor := public.compute_tax_minor(greatest(0, v_subtotal_minor - v_discount_minor));
  v_total_minor := greatest(0, v_subtotal_minor - v_discount_minor) + v_tax_minor + v_delivery_minor;

  UPDATE public.orders
     SET subtotal_minor     = v_subtotal_minor,
         discount_minor     = v_discount_minor,
         tax_minor          = v_tax_minor,
         delivery_fee_minor = v_delivery_minor,
         total_minor        = v_total_minor
   WHERE id = v_order_id;

  IF v_promo.coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, order_id, user_id, amount_minor)
    VALUES (v_promo.coupon_id, v_order_id, v_uid, v_discount_minor);
  END IF;

  INSERT INTO public.payments (order_id, provider, method, amount_minor, status)
  VALUES (v_order_id, 'cod', 'cod', v_total_minor, 'pending_collection');

  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role)
  VALUES (v_order_id, NULL, 'pending_confirmation', v_uid, 'customer');

  RETURN v_order_id;
END $function$;
