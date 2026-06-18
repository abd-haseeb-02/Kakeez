-- ============================================================================
-- Phase 6 part 1 / Migration 11 — product reviews end-to-end
-- (ECOMMERCE_CMS_PLAN.md §B.5 Reviews & ratings)
-- ============================================================================
-- Closes the visible AUDIT.md leftover (hardcoded "43 reviews" + stars.svg
-- on every ProductCard). Three pieces:
--   1. submit_product_review() — verified-purchase gated insert.
--   2. moderate_product_review() — staff-only status flip.
--   3. Trigger that keeps products.rating_avg + rating_count in sync with
--      the set of published reviews per product. So the storefront just
--      reads two denormalized columns instead of aggregating live.
--
-- Default policy: new reviews land status='pending'. Admin reviews the
-- moderation queue and publishes — same shape as a future auto-publish
-- mode controlled by store_settings.review_auto_publish (default false).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Seed the auto-publish setting (default off — admin moderates).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.store_settings (key, value)
VALUES ('review.auto_publish', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Aggregate trigger — recompute products.rating_avg + rating_count on
--    every change. Only counts published reviews.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_product_rating(p_product_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
  v_avg   numeric(2,1);
BEGIN
  SELECT COUNT(*), COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
    INTO v_count, v_avg
    FROM public.product_reviews
   WHERE product_id = p_product_id AND status = 'published';
  UPDATE public.products
     SET rating_count = v_count,
         rating_avg   = v_avg
   WHERE id = p_product_id;
END $$;

CREATE OR REPLACE FUNCTION public.tg_product_reviews_recompute()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_product_rating(OLD.product_id);
  ELSE
    PERFORM public.recompute_product_rating(NEW.product_id);
    IF TG_OP = 'UPDATE' AND OLD.product_id <> NEW.product_id THEN
      PERFORM public.recompute_product_rating(OLD.product_id);
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS product_reviews_recompute ON public.product_reviews;
CREATE TRIGGER product_reviews_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_product_reviews_recompute();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. submit_product_review — customer-facing entry point.
--    Verified-purchase check: at least one order_items row for this product,
--    in a 'delivered' order owned by the current user. The verified_purchase
--    flag on the review records this so the storefront can badge it.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.submit_product_review(uuid, int, text, text);

CREATE OR REPLACE FUNCTION public.submit_product_review(
  p_product_id uuid,
  p_rating     int,
  p_title      text,
  p_body       text
) RETURNS public.product_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_order_id      uuid;
  v_already_review uuid;
  v_auto_publish  boolean;
  v_status        text;
  v_row           public.product_reviews%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'invalid_rating' USING ERRCODE = '22023';
  END IF;
  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'invalid_product' USING ERRCODE = '22023';
  END IF;

  -- Verified-purchase gate: must have bought this product in a delivered
  -- order. Picks the most recent such order to attach to the review.
  SELECT o.id INTO v_order_id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
   WHERE o.user_id = v_uid
     AND o.status = 'delivered'
     AND oi.product_id = p_product_id
   ORDER BY o.created_at DESC
   LIMIT 1;
  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'not_verified_purchase' USING ERRCODE = '42501';
  END IF;

  -- Prevent duplicate reviews per (user, product). Customers edit by
  -- writing a new one and the admin chooses which to publish.
  SELECT id INTO v_already_review
    FROM public.product_reviews
   WHERE user_id = v_uid AND product_id = p_product_id
     AND status IN ('pending', 'published')
   LIMIT 1;
  IF v_already_review IS NOT NULL THEN
    RAISE EXCEPTION 'already_reviewed' USING ERRCODE = '23505';
  END IF;

  -- Auto-publish policy lives in store_settings (default false → pending).
  SELECT (value)::boolean INTO v_auto_publish
    FROM public.store_settings WHERE key = 'review.auto_publish';
  v_status := CASE WHEN COALESCE(v_auto_publish, false) THEN 'published' ELSE 'pending' END;

  INSERT INTO public.product_reviews (
    product_id, user_id, order_id, rating, title, body,
    verified_purchase, status
  ) VALUES (
    p_product_id, v_uid, v_order_id, p_rating,
    NULLIF(trim(coalesce(p_title, '')), ''),
    NULLIF(trim(coalesce(p_body,  '')), ''),
    true, v_status
  ) RETURNING * INTO v_row;

  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.submit_product_review(uuid, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_product_review(uuid, int, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. moderate_product_review — staff/admin-only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.moderate_product_review(
  p_review_id uuid,
  p_status    text
) RETURNS public.product_reviews
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.product_reviews%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending', 'published', 'rejected') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.product_reviews
     SET status = p_status
   WHERE id = p_review_id
   RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'review_not_found' USING ERRCODE = '22023';
  END IF;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.moderate_product_review(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_product_review(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. admin_list_reviews — joined view (review + product name + reviewer
--    email/name) gated on is_staff. Same shape pattern as admin_list_users.
--    The products table is publicly readable; we still need this RPC so
--    admin can see reviewer emails (auth.users is not readable from
--    PostgREST by authenticated users).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_reviews(p_status text DEFAULT NULL)
RETURNS TABLE (
  id                 uuid,
  product_id         uuid,
  product_name       text,
  product_slug       text,
  user_id            uuid,
  user_email         text,
  user_full_name     text,
  order_id           uuid,
  rating             int,
  title              text,
  body               text,
  verified_purchase  bool,
  status             text,
  created_at         timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'staff_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    r.id, r.product_id, p.name, p.slug,
    r.user_id, u.email::text, pr.full_name,
    r.order_id, r.rating, r.title, r.body,
    r.verified_purchase, r.status, r.created_at
  FROM public.product_reviews r
  JOIN public.products p     ON p.id = r.product_id
  LEFT JOIN public.profiles pr ON pr.id = r.user_id
  LEFT JOIN auth.users u       ON u.id  = r.user_id
  WHERE p_status IS NULL OR r.status = p_status
  ORDER BY
    CASE r.status WHEN 'pending' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
    r.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_reviews(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_reviews(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Backfill — recompute every product's rating_avg + rating_count from
--    whatever's in product_reviews today (probably nothing, but safe to run).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.products LOOP
    PERFORM public.recompute_product_rating(r.id);
  END LOOP;
END $$;
