-- ============================================================================
-- Phase 1 / Migration 6 — create_order RPC body (real implementation)
-- (ECOMMERCE_CMS_PLAN.md §G.X.1 — server-authoritative checkout)
-- ============================================================================
-- Replaces the Phase-0 stub that returned 'NOT IMPLEMENTED'. The body here
-- closes AUDIT.md §B Critical #1 (client-trusted checkout totals) and §B High
-- #2 (non-transactional order creation):
--
--   1. Re-reads product + variation from the database — IGNORES any `price`
--      sent in the cart payload. A user editing localStorage cannot change
--      what they're charged.
--   2. Wraps order + line item inserts in ONE plpgsql block — the function
--      either commits everything or rolls back everything. No orphan orders
--      with zero line items (the bug the 1 archived legacy order proves
--      shipped to prod under the old flow).
--   3. Snapshots product name, image, unit price, and category info into
--      order_items so order history survives later catalog edits / deletes.
--   4. Computes delivery from delivery_methods (the seeded Karachi method
--      defaults to 9900 paisa = PKR 99, matching the prior hardcoded UI
--      const that's now gone).
--   5. Generates a human-friendly order_number (KKZ-000001…) so admins and
--      customers don't have to swap UUIDs over WhatsApp.
--
-- Phase-1 scope deliberately defers to follow-up migrations:
--   - Variations (B.1.X) — RPC accepts variation_id but the seeded catalog
--     has no variations yet; the join is a no-op at launch.
--   - Coupons / promos — RPC accepts p_promo_code but applies 0 discount
--     until apply_promo() lands in Phase 5.
--   - COD fraud guards (G.X.4) — RPC accepts the phone but skips OTP
--     verification and per-phone caps until Phase 4 auth hardening.
--   - Inventory decrement — only runs when track_inventory=true (no current
--     products track inventory; Phase 2 admin UI flips the flag per SKU).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Order-number sequence (KKZ-000001-style human-friendly id).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- Drop the Phase-0 stub so we can re-create with the new signature/body.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_order(jsonb, jsonb, text, text, boolean);

-- ─────────────────────────────────────────────────────────────────────────────
-- create_order: server-authoritative checkout entry point.
--
-- p_cart shape (validated against products + variations):
--   [
--     { "productId": "<uuid>",
--       "variationId": "<uuid>" | null,
--       "quantity": 1,
--       "customMessage": "Happy Birthday Ayesha"   -- optional
--     },
--     ...
--   ]
-- p_address shape (snapshot stored verbatim on the order):
--   {
--     "recipient_name": "...",
--     "phone_e164":     "+92...",
--     "line1":          "...",
--     "line2":          "...",  -- optional
--     "area":           "...",
--     "city":           "Karachi",
--     "instructions":   "..."   -- optional
--   }
--
-- Returns: the new orders.id.
-- Raises: structured errors so the server action can show the right UX:
--   - auth_required        (no auth.uid)
--   - empty_cart           (p_cart is null or empty)
--   - invalid_cart_shape   (a row missing productId/quantity)
--   - product_not_found    (referenced product doesn't exist or isn't published)
--   - variation_not_found  (variation gone or inactive)
--   - out_of_stock         (track_inventory && qty exceeds stock)
--   - payment_method_unsupported  (the COD-only DB CHECK rejects anything else)
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_total_minor      bigint := 0;
  v_hero_path        text;
  v_email            text;
  v_phone            text;
  v_full_name        text;
BEGIN
  -- ── 1. Auth gate ────────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  -- ── 2. Hard-lock to COD at the DB layer (defense in depth on top of the
  --      orders.payment_method CHECK constraint). ─────────────────────────
  IF coalesce(p_payment_method, 'cod') <> 'cod' THEN
    RAISE EXCEPTION 'payment_method_unsupported' USING ERRCODE = '22023';
  END IF;

  -- ── 3. Cart shape sanity ────────────────────────────────────────────────
  IF p_cart IS NULL
     OR jsonb_typeof(p_cart) <> 'array'
     OR jsonb_array_length(p_cart) = 0 THEN
    RAISE EXCEPTION 'empty_cart' USING ERRCODE = '22023';
  END IF;

  -- ── 4. Resolve customer identity from the verified JWT + profile.
  --      We snapshot these onto the order so admins see them at a glance
  --      without joining profiles. ───────────────────────────────────────
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  SELECT full_name, phone_e164 INTO v_full_name, v_phone
    FROM public.profiles WHERE id = v_uid;
  v_phone := COALESCE(p_address->>'phone_e164', v_phone, '');
  IF coalesce(v_email, '') = '' THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  -- ── 5. Generate order number + insert the order shell. Money fields are
  --      placeholder 0 here; we update them after iterating the cart.
  --      status=pending_confirmation matches the new order_status enum
  --      (admin confirms before kitchen starts). ────────────────────────
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

  -- ── 6. Iterate the cart: re-read every product/variation, recompute the
  --      line unit price, snapshot it onto order_items. Anything missing
  --      or not-published/inactive aborts the whole transaction. ────────
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
       FOR UPDATE;                              -- row-lock for stock decrement
      IF NOT FOUND THEN
        RAISE EXCEPTION 'variation_not_found:%', v_variation_id USING ERRCODE = '22023';
      END IF;
      v_unit_minor := v_unit_minor + v_variation.price_delta_minor;

      -- Stock check + decrement, only when this variation tracks inventory.
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
      -- Simple product with inventory tracked
      IF v_product.stock_quantity < v_qty THEN
        RAISE EXCEPTION 'out_of_stock:%', v_product_id USING ERRCODE = '22023';
      END IF;
      UPDATE public.products
         SET stock_quantity = stock_quantity - v_qty
       WHERE id = v_product_id;
      INSERT INTO public.inventory_movements (product_id, change, reason, order_id, created_by)
      VALUES (v_product_id, -v_qty, 'order', v_order_id, v_uid);
    END IF;

    -- Snapshot the featured image path so admin order detail can render
    -- the cake thumbnail later without joining live product_images.
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
      v_product.name, v_product.sku,
      NULL,                        -- variation_label set in Phase 2 once variations are wired up
      v_hero_path,
      v_product.is_perishable,
      v_unit_minor, v_qty, v_unit_minor * v_qty,
      v_item->>'customMessage'
    );

    v_subtotal_minor := v_subtotal_minor + v_unit_minor * v_qty;
  END LOOP;

  -- ── 7. Delivery: use the first active delivery method as the launch
  --      default. The G.X.4 zone-aware lookup lands in Phase 5 along with
  --      coupons + tax. ─────────────────────────────────────────────────
  SELECT base_fee_minor INTO v_delivery_minor
    FROM public.delivery_methods
   WHERE status = 'active'
   ORDER BY base_fee_minor ASC
   LIMIT 1;
  v_delivery_minor := COALESCE(v_delivery_minor, 0);

  v_total_minor := v_subtotal_minor + v_delivery_minor;

  UPDATE public.orders
     SET subtotal_minor     = v_subtotal_minor,
         delivery_fee_minor = v_delivery_minor,
         total_minor        = v_total_minor
   WHERE id = v_order_id;

  -- ── 8. Open the COD payment record. The rider's mark-collected RPC
  --      (Phase 3) flips status to 'collected' and order.payment_status
  --      to 'paid'. ────────────────────────────────────────────────────
  INSERT INTO public.payments (order_id, provider, method, amount_minor, status)
  VALUES (v_order_id, 'cod', 'cod', v_total_minor, 'pending_collection');

  -- ── 9. Stamp the lifecycle history (audit trail). ──────────────────
  INSERT INTO public.order_status_history (order_id, from_status, to_status, actor_id, actor_role)
  VALUES (v_order_id, NULL, 'pending_confirmation', v_uid, 'customer');

  RETURN v_order_id;
END $$;

-- Re-grant EXECUTE that 0005_rls.sql attached to the old stub signature.
REVOKE ALL ON FUNCTION public.create_order(jsonb, jsonb, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, jsonb, text, text, boolean) TO authenticated;
