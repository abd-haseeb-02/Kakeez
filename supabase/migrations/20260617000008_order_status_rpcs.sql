-- ============================================================================
-- Phase 3 / Migration 8 — order status transition + cancellation RPCs
-- (ECOMMERCE_CMS_PLAN.md §B.2.3, §G.X.3, §G.X.5)
-- ============================================================================
-- Replaces the Phase-0 stub `update_order_status` with a real body that:
--   * Validates the requested transition against a small table of allowed
--     (from_status, to_status) pairs — illegal jumps (e.g. cancelled →
--     delivered) are rejected at the DB layer, not just in UI.
--   * Restricts to staff/admin via has_role().
--   * Wraps the UPDATE + history row + (conditional) inventory restock in
--     one plpgsql block. Either everything commits or nothing does.
--   * For perishable line items, cancellation does NOT restock (G.X.5
--     waste-log policy — once flour is allocated, it's allocated). For
--     non-perishables the inventory restored is exactly what the create_order
--     RPC decremented (read from inventory_movements via the original
--     'order' reason rows).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Valid-transitions reference table. Joined inside update_order_status
--    to gate every requested move. Keeping it as data (not a giant CASE)
--    means new transitions ship via INSERT instead of code changes.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_status_transitions (
  from_status text NOT NULL,
  to_status   text NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

INSERT INTO public.order_status_transitions (from_status, to_status) VALUES
  ('pending_confirmation', 'confirmed'),
  ('pending_confirmation', 'cancelled'),
  ('confirmed',            'preparing'),
  ('confirmed',            'cancelled'),
  ('preparing',            'ready_for_dispatch'),
  ('preparing',            'cancelled'),
  ('ready_for_dispatch',   'out_for_delivery'),
  ('ready_for_dispatch',   'cancelled'),
  ('out_for_delivery',     'delivered'),
  ('out_for_delivery',     'failed_delivery'),
  ('out_for_delivery',     'disputed'),
  ('failed_delivery',      'out_for_delivery'),
  ('failed_delivery',      'cancelled'),
  ('disputed',             'delivered'),
  ('disputed',             'cancelled')
ON CONFLICT DO NOTHING;

-- Anyone signed in can read; only admin can rewrite (rarely needed).
ALTER TABLE public.order_status_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ost_authenticated_read ON public.order_status_transitions;
CREATE POLICY ost_authenticated_read ON public.order_status_transitions
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ost_admin_write ON public.order_status_transitions;
CREATE POLICY ost_admin_write ON public.order_status_transitions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.order_status_transitions FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. update_order_status — drop the Phase-0 stub and re-create with body.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text, text);

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id  uuid,
  p_to_status text,
  p_reason    text
) RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_actor_role text;
  v_order     public.orders%ROWTYPE;
  v_item      public.order_items%ROWTYPE;
  v_decrement int;
BEGIN
  -- ── Auth + role gate ───────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_required' USING ERRCODE = '42501';
  END IF;
  v_actor_role := CASE WHEN public.is_admin() THEN 'admin' ELSE 'staff' END;

  -- ── Row-lock the order to serialize concurrent transitions ────────────
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = '22023';
  END IF;

  -- ── No-op short-circuit ───────────────────────────────────────────────
  IF v_order.status = p_to_status THEN
    RETURN v_order;
  END IF;

  -- ── Transition validation against the table ───────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.order_status_transitions
     WHERE from_status = v_order.status AND to_status = p_to_status
  ) THEN
    RAISE EXCEPTION 'invalid_transition:%->%', v_order.status, p_to_status USING ERRCODE = '22023';
  END IF;

  -- ── Cancel → conditional inventory restore (G.X.5) ────────────────────
  IF p_to_status = 'cancelled' AND v_order.status <> 'cancelled' THEN
    FOR v_item IN
      SELECT * FROM public.order_items WHERE order_id = p_order_id
    LOOP
      -- Only restore for non-perishables. Perishable line items are written
      -- off as waste — kitchen has already started baking by the time we
      -- get past 'confirmed'. The is_perishable_snapshot was frozen at
      -- checkout so this works even if the catalog row has flipped.
      IF v_item.is_perishable_snapshot = false THEN
        SELECT COALESCE(SUM(-change), 0) INTO v_decrement
          FROM public.inventory_movements
         WHERE order_id = p_order_id
           AND reason = 'order'
           AND COALESCE(variation_id, product_id) = COALESCE(v_item.variation_id, v_item.product_id);
        IF v_decrement > 0 THEN
          IF v_item.variation_id IS NOT NULL THEN
            UPDATE public.product_variations
               SET stock_quantity = stock_quantity + v_decrement
             WHERE id = v_item.variation_id;
            INSERT INTO public.inventory_movements (variation_id, change, reason, order_id, created_by)
            VALUES (v_item.variation_id, v_decrement, 'cancellation', p_order_id, v_uid);
          ELSIF v_item.product_id IS NOT NULL THEN
            UPDATE public.products
               SET stock_quantity = stock_quantity + v_decrement
             WHERE id = v_item.product_id;
            INSERT INTO public.inventory_movements (product_id, change, reason, order_id, created_by)
            VALUES (v_item.product_id, v_decrement, 'cancellation', p_order_id, v_uid);
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- Payment side of the void — no money was collected for COD orders
    -- pre-delivery, so we void rather than refund (G.X.5).
    UPDATE public.payments
       SET status = 'voided'
     WHERE order_id = p_order_id
       AND status = 'pending_collection';
    UPDATE public.orders
       SET payment_status = 'voided'
     WHERE id = p_order_id
       AND payment_status = 'unpaid';

    -- Record a zero-amount refund row so the audit history is consistent
    -- with how a future PSP cancellation would look (G.X.5 — same shape).
    INSERT INTO public.refunds (order_id, amount_minor, reason, kind, status, initiated_by)
    VALUES (p_order_id, 0, COALESCE(p_reason, 'cancelled by staff'), 'pre_collection_cancel', 'executed', v_uid);
  END IF;

  -- ── Delivered → flip payment to paid (COD collection happens at door) ─
  IF p_to_status = 'delivered' AND v_order.payment_status = 'unpaid' THEN
    UPDATE public.payments
       SET status = 'collected',
           collected_amount_minor = v_order.total_minor,
           collected_by = v_uid,
           collected_at = now()
     WHERE order_id = p_order_id
       AND status = 'pending_collection';
    UPDATE public.orders
       SET payment_status = 'paid'
     WHERE id = p_order_id;
  END IF;

  -- ── Apply the status change + history audit row ───────────────────────
  UPDATE public.orders
     SET status = p_to_status
   WHERE id = p_order_id;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, reason, actor_id, actor_role)
  VALUES (p_order_id, v_order.status, p_to_status, p_reason, v_uid, v_actor_role);

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  RETURN v_order;
END $$;

REVOKE ALL ON FUNCTION public.update_order_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Cleaner alias for the customer-cancel grace window (Phase 4 will add a
--    customer-side RPC; for now staff calls update_order_status to cancel).
--    Keep the spot to land the customer-cancel logic later.
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.update_order_status(uuid, text, text) IS
  'Staff/admin transitions an order through the G.X.3 state machine. Validates transitions against order_status_transitions, writes order_status_history, restores inventory for non-perishable lines on cancel, voids payment on cancel before delivery, marks payment collected on delivery.';
