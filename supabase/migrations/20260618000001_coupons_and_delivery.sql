-- ============================================================================
-- Phase 5 / Migration 10 — coupons + city-aware delivery
-- (ECOMMERCE_CMS_PLAN.md §B.5 + §G.X.1)
-- ============================================================================
-- Closes the two TODOs the Phase 1 create_order RPC left explicit:
--   * apply_promo_minor()  — was returning 0; now validates a coupon code
--     server-side and computes the discount, writes coupon_redemptions on
--     success. Replaces the client-side hardcoded `PROMOS` dict in
--     src/app/checkout/page.tsx (which was display-only anyway — the RPC
--     would have ignored anything tampered with).
--   * compute_delivery_minor() — was picking the first-active delivery
--     method by fee. Now keys on delivery_address_snapshot->>'city' and
--     joins through delivery_zones for an actual city-aware lookup, with
--     graceful fallback when the address city doesn't match any zone.
--
-- Also exposes validate_coupon_for_cart() so the checkout page can show a
-- live discount preview to the customer before they submit the order.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. compute_delivery_minor(p_address jsonb)
--    Lookup order:
--      1. exact city match in delivery_zones.city → first active method
--      2. fallback: any active method in any active zone (current behavior)
--      3. ultimate fallback: 0 (storefront still works if admin nukes config)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_delivery_minor(p_address jsonb)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_city text := lower(coalesce(p_address->>'city', ''));
  v_fee  bigint;
BEGIN
  IF v_city <> '' THEN
    SELECT m.base_fee_minor INTO v_fee
      FROM public.delivery_methods m
      JOIN public.delivery_zones  z ON z.id = m.zone_id
     WHERE m.status = 'active' AND z.status = 'active'
       AND lower(z.city) = v_city
     ORDER BY m.base_fee_minor ASC
     LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  SELECT base_fee_minor INTO v_fee
    FROM public.delivery_methods
   WHERE status = 'active'
   ORDER BY base_fee_minor ASC
   LIMIT 1;

  RETURN COALESCE(v_fee, 0);
END $$;

REVOKE ALL ON FUNCTION public.compute_delivery_minor(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_delivery_minor(jsonb) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. validate_coupon_for_cart(p_code text, p_subtotal_minor bigint)
--    Read-only check used by the checkout page's "Apply promo" button. The
--    customer sees the live discount preview without committing anything.
--    Returns NULL on any validity failure (storefront message is generic so
--    we don't leak which coupon is paused vs expired vs unused).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_coupon_for_cart(
  p_code           text,
  p_subtotal_minor bigint
) RETURNS TABLE (
  coupon_id          uuid,
  code               text,
  type               text,
  discount_minor     bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_c      public.coupons%ROWTYPE;
  v_now    timestamptz := now();
  v_used   int;
  v_user_used int;
  v_discount bigint := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF p_code IS NULL OR p_code = '' THEN RETURN; END IF;
  IF p_subtotal_minor IS NULL OR p_subtotal_minor < 0 THEN RETURN; END IF;

  SELECT * INTO v_c FROM public.coupons WHERE upper(code) = upper(p_code);
  IF NOT FOUND THEN RETURN; END IF;
  IF v_c.status <> 'active' THEN RETURN; END IF;
  IF v_c.starts_at  IS NOT NULL AND v_c.starts_at  > v_now THEN RETURN; END IF;
  IF v_c.expires_at IS NOT NULL AND v_c.expires_at < v_now THEN RETURN; END IF;
  IF p_subtotal_minor < COALESCE(v_c.min_order_minor, 0) THEN RETURN; END IF;

  -- Usage caps.
  IF v_c.usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_used FROM public.coupon_redemptions WHERE coupon_id = v_c.id;
    IF v_used >= v_c.usage_limit THEN RETURN; END IF;
  END IF;
  IF v_c.usage_limit_per_user IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_used
      FROM public.coupon_redemptions
     WHERE coupon_id = v_c.id AND user_id = v_uid;
    IF v_user_used >= v_c.usage_limit_per_user THEN RETURN; END IF;
  END IF;

  -- Discount math.
  IF v_c.type = 'percent' THEN
    v_discount := (p_subtotal_minor * COALESCE(v_c.percent_bp, 0)) / 10000;
  ELSIF v_c.type = 'fixed_cart' THEN
    v_discount := COALESCE(v_c.value_minor, 0);
  ELSIF v_c.type = 'free_shipping' THEN
    v_discount := 0;   -- free shipping is applied in compute_delivery_minor at create_order time
  ELSE
    RETURN;
  END IF;

  IF v_c.max_discount_minor IS NOT NULL AND v_discount > v_c.max_discount_minor THEN
    v_discount := v_c.max_discount_minor;
  END IF;
  -- Never let discount exceed the subtotal.
  IF v_discount > p_subtotal_minor THEN
    v_discount := p_subtotal_minor;
  END IF;

  RETURN QUERY SELECT v_c.id, v_c.code, v_c.type, v_discount;
END $$;

REVOKE ALL ON FUNCTION public.validate_coupon_for_cart(text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon_for_cart(text, bigint) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. apply_promo_minor(p_code text, p_user_id uuid, p_subtotal_minor bigint,
--                      OUT v_coupon_id uuid, OUT v_discount bigint)
--    Used INSIDE create_order. Re-runs the validate_coupon_for_cart checks
--    via direct SELECTs (can't call the function because it depends on
--    auth.uid() which is set for the calling user, and inside create_order
--    we already have that). On success, the caller writes the
--    coupon_redemptions row after the order id is known.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_promo_minor(
  p_code           text,
  p_user_id        uuid,
  p_subtotal_minor bigint,
  OUT coupon_id    uuid,
  OUT discount     bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_c    public.coupons%ROWTYPE;
  v_now  timestamptz := now();
  v_used int;
  v_user_used int;
BEGIN
  coupon_id := NULL;
  discount  := 0;
  IF p_code IS NULL OR p_code = '' THEN RETURN; END IF;

  SELECT * INTO v_c FROM public.coupons WHERE upper(code) = upper(p_code);
  IF NOT FOUND THEN RETURN; END IF;
  IF v_c.status <> 'active' THEN RETURN; END IF;
  IF v_c.starts_at  IS NOT NULL AND v_c.starts_at  > v_now THEN RETURN; END IF;
  IF v_c.expires_at IS NOT NULL AND v_c.expires_at < v_now THEN RETURN; END IF;
  IF p_subtotal_minor < COALESCE(v_c.min_order_minor, 0) THEN RETURN; END IF;

  IF v_c.usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_used FROM public.coupon_redemptions WHERE coupon_id = v_c.id;
    IF v_used >= v_c.usage_limit THEN RETURN; END IF;
  END IF;
  IF v_c.usage_limit_per_user IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_used
      FROM public.coupon_redemptions
     WHERE coupon_id = v_c.id AND user_id = p_user_id;
    IF v_user_used >= v_c.usage_limit_per_user THEN RETURN; END IF;
  END IF;

  IF v_c.type = 'percent' THEN
    discount := (p_subtotal_minor * COALESCE(v_c.percent_bp, 0)) / 10000;
  ELSIF v_c.type = 'fixed_cart' THEN
    discount := COALESCE(v_c.value_minor, 0);
  ELSIF v_c.type = 'free_shipping' THEN
    discount := 0;
  ELSE
    RETURN;
  END IF;

  IF v_c.max_discount_minor IS NOT NULL AND discount > v_c.max_discount_minor THEN
    discount := v_c.max_discount_minor;
  END IF;
  IF discount > p_subtotal_minor THEN
    discount := p_subtotal_minor;
  END IF;

  coupon_id := v_c.id;
END $$;

REVOKE ALL ON FUNCTION public.apply_promo_minor(text, uuid, bigint) FROM PUBLIC;
-- not granted to authenticated — called only by create_order (SECURITY DEFINER).

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Recreate create_order so it uses the two helpers + writes
--    coupon_redemptions on success + handles free-shipping coupons by
--    zeroing the delivery fee.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_order(jsonb, jsonb, text, text, boolean);

CREATE OR REPLACE FUNCTION public.create_order(
  p_cart           jsonb,
  p_address        jsonb,
  p_payment_method text,
  p_promo_code     text,
  p_is_gift        boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  v_total_minor      bigint := 0;
  v_hero_path        text;
  v_email            text;
  v_phone            text;
  v_full_name        text;
  v_promo            record;
  v_free_shipping    boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000'; END IF;
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
    FROM public.profiles WHERE id = v_uid;
  v_phone := COALESCE(p_address->>'phone_e164', v_phone, '');
  IF coalesce(v_email, '') = '' THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  v_order_number := 'KKZ-' || lpad(nextval('public.order_number_seq')::text, 6, '0');

  INSERT INTO public.orders (
    order_number, user_id, channel,
    customer_name, customer_email, customer_phone,
    delivery_address_snapshot,
    subtotal_minor, discount_minor, tax_minor, delivery_fee_minor, total_minor,
    currency, payment_method, payment_status, status,
    is_gift, customer_note, coupon_code
  ) VALUES (
    v_order_number, v_uid, 'web',
    COALESCE(p_address->>'recipient_name', v_full_name, split_part(v_email, '@', 1)),
    v_email, v_phone,
    coalesce(p_address, '{}'::jsonb),
    0, 0, 0, 0, 0,
    'PKR', 'cod', 'unpaid', 'pending_confirmation',
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
     WHERE id = v_product_id AND status = 'published' AND deleted_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found:%', v_product_id USING ERRCODE = '22023';
    END IF;

    v_unit_minor := v_product.base_price_minor;

    IF v_variation_id IS NOT NULL THEN
      SELECT * INTO v_variation
        FROM public.product_variations
       WHERE id = v_variation_id AND product_id = v_product_id
         AND is_active AND deleted_at IS NULL
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

  -- ── Phase 5: real coupon application ─────────────────────────────────
  SELECT * INTO v_promo FROM public.apply_promo_minor(p_promo_code, v_uid, v_subtotal_minor);
  v_discount_minor := COALESCE(v_promo.discount, 0);

  -- Free-shipping coupon: zero out the delivery fee instead of subtracting.
  -- (apply_promo_minor returned discount=0 for free_shipping; we detect it
  -- here so the receipt still shows "Delivery: free" instead of mixing the
  -- two effects.)
  IF v_promo.coupon_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.coupons WHERE id = v_promo.coupon_id AND type = 'free_shipping') THEN
      v_free_shipping := true;
    END IF;
  END IF;

  -- ── Phase 5: city-aware delivery lookup ──────────────────────────────
  IF v_free_shipping THEN
    v_delivery_minor := 0;
  ELSE
    v_delivery_minor := public.compute_delivery_minor(p_address);
  END IF;

  v_total_minor := greatest(0, v_subtotal_minor - v_discount_minor) + v_delivery_minor;

  UPDATE public.orders
     SET subtotal_minor     = v_subtotal_minor,
         discount_minor     = v_discount_minor,
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
END $$;

REVOKE ALL ON FUNCTION public.create_order(jsonb, jsonb, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, jsonb, text, text, boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Index for the case-insensitive coupon-code lookup the helpers do.
--    coupons.code already has a unique constraint but it's case-sensitive;
--    the upper() comparison would seq-scan without a functional index.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_unique
  ON public.coupons (upper(code));
