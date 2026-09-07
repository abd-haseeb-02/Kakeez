-- ============================================================================
-- Admin write RPCs + audit trail
-- ============================================================================
-- The admin Coupons and Settings screens wrote directly to coupons /
-- tax_rates / delivery_zones / delivery_methods / store_settings. Those tables
-- have INSERT/UPDATE/DELETE REVOKEd from anon+authenticated at the privilege
-- layer (20260617000005_rls.sql), and an RLS "admin_write" policy cannot grant
-- a privilege the role does not hold -- so every save failed with
-- "permission denied". These SECURITY DEFINER RPCs are the supported write
-- path: they run as the function owner, gate on is_admin(), validate input,
-- and record who changed what.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit trail. Nothing outside these RPCs (and the price trigger below) writes
-- here; staff can read it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id         bigserial PRIMARY KEY,
  actor_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  text,
  details    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity
  ON public.admin_audit_log (entity, entity_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_select_staff ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_staff ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.is_staff());

REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text, p_entity text, p_entity_id text, p_details jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), p_action, p_entity, p_entity_id, COALESCE(p_details, '{}'::jsonb));
END $$;

-- Shared guard.
CREATE OR REPLACE FUNCTION public.require_admin() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Coupons
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_upsert_coupon(
  p_id                   uuid,
  p_code                 text,
  p_type                 text,
  p_percent_bp           integer,
  p_value_minor          bigint,
  p_min_order_minor      bigint,
  p_max_discount_minor   bigint,
  p_usage_limit          integer,
  p_usage_limit_per_user integer,
  p_starts_at            timestamptz,
  p_expires_at           timestamptz,
  p_status               text
) RETURNS public.coupons
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row  public.coupons%ROWTYPE;
  v_code text := upper(trim(coalesce(p_code, '')));
BEGIN
  PERFORM public.require_admin();

  IF v_code = '' THEN
    RAISE EXCEPTION 'code_required' USING ERRCODE = '22023';
  END IF;
  IF p_type NOT IN ('percent', 'fixed_cart', 'fixed_product', 'free_shipping') THEN
    RAISE EXCEPTION 'invalid_type:%', p_type USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('active', 'paused', 'archived') THEN
    RAISE EXCEPTION 'invalid_status:%', p_status USING ERRCODE = '22023';
  END IF;
  IF p_type = 'percent' AND (p_percent_bp IS NULL OR p_percent_bp <= 0 OR p_percent_bp > 10000) THEN
    RAISE EXCEPTION 'invalid_percent' USING ERRCODE = '22023';
  END IF;
  IF p_type = 'fixed_cart' AND (p_value_minor IS NULL OR p_value_minor <= 0) THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;
  -- Negative money is nonsense and there is no CHECK on these columns.
  IF coalesce(p_min_order_minor, 0) < 0 OR coalesce(p_max_discount_minor, 0) < 0 THEN
    RAISE EXCEPTION 'negative_amount' USING ERRCODE = '22023';
  END IF;
  IF coalesce(p_usage_limit, 1) < 0 OR coalesce(p_usage_limit_per_user, 1) < 0 THEN
    RAISE EXCEPTION 'negative_usage_limit' USING ERRCODE = '22023';
  END IF;
  IF p_starts_at IS NOT NULL AND p_expires_at IS NOT NULL AND p_expires_at <= p_starts_at THEN
    RAISE EXCEPTION 'expiry_before_start' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.coupons (
      code, type, percent_bp, value_minor, min_order_minor, max_discount_minor,
      usage_limit, usage_limit_per_user, starts_at, expires_at, status
    ) VALUES (
      v_code, p_type,
      CASE WHEN p_type = 'percent' THEN p_percent_bp END,
      CASE WHEN p_type = 'fixed_cart' THEN p_value_minor END,
      COALESCE(p_min_order_minor, 0), p_max_discount_minor,
      p_usage_limit, p_usage_limit_per_user, p_starts_at, p_expires_at, p_status
    ) RETURNING * INTO v_row;
    PERFORM public.log_admin_action('create', 'coupon', v_row.id::text, to_jsonb(v_row));
  ELSE
    UPDATE public.coupons SET
      code                 = v_code,
      type                 = p_type,
      percent_bp           = CASE WHEN p_type = 'percent' THEN p_percent_bp END,
      value_minor          = CASE WHEN p_type = 'fixed_cart' THEN p_value_minor END,
      min_order_minor      = COALESCE(p_min_order_minor, 0),
      max_discount_minor   = p_max_discount_minor,
      usage_limit          = p_usage_limit,
      usage_limit_per_user = p_usage_limit_per_user,
      starts_at            = p_starts_at,
      expires_at           = p_expires_at,
      status               = p_status
    WHERE id = p_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'coupon_not_found' USING ERRCODE = '22023';
    END IF;
    PERFORM public.log_admin_action('update', 'coupon', v_row.id::text, to_jsonb(v_row));
  END IF;

  RETURN v_row;
END $$;

-- Deletes when the coupon was never redeemed; archives otherwise so redemption
-- history keeps its foreign key.
CREATE OR REPLACE FUNCTION public.admin_delete_coupon(p_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_used int;
  v_code text;
BEGIN
  PERFORM public.require_admin();

  SELECT code INTO v_code FROM public.coupons WHERE id = p_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'coupon_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_used FROM public.coupon_redemptions WHERE coupon_id = p_id;

  IF v_used > 0 THEN
    UPDATE public.coupons SET status = 'archived' WHERE id = p_id;
    PERFORM public.log_admin_action('archive', 'coupon', p_id::text,
      jsonb_build_object('code', v_code, 'redemptions', v_used));
    RETURN 'archived';
  END IF;

  DELETE FROM public.coupons WHERE id = p_id;
  PERFORM public.log_admin_action('delete', 'coupon', p_id::text, jsonb_build_object('code', v_code));
  RETURN 'deleted';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tax
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_save_tax_rate(
  p_id uuid, p_name text, p_rate_bp integer
) RETURNS public.tax_rates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.tax_rates%ROWTYPE;
BEGIN
  PERFORM public.require_admin();

  IF p_rate_bp IS NULL OR p_rate_bp < 0 OR p_rate_bp > 10000 THEN
    RAISE EXCEPTION 'invalid_rate' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.tax_rates (name, rate_bp, applies_to, is_default)
    VALUES (COALESCE(NULLIF(trim(p_name), ''), 'Default tax'), p_rate_bp, 'all', true)
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.tax_rates
       SET name = COALESCE(NULLIF(trim(p_name), ''), 'Default tax'),
           rate_bp = p_rate_bp,
           applies_to = 'all',
           is_default = true
     WHERE id = p_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'tax_rate_not_found' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM public.log_admin_action('save', 'tax_rate', v_row.id::text, to_jsonb(v_row));
  RETURN v_row;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Delivery zone + its flat method, saved together.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_save_delivery(
  p_zone_id        uuid,
  p_zone_name      text,
  p_city           text,
  p_zone_status    text,
  p_method_id      uuid,
  p_method_name    text,
  p_base_fee_minor bigint,
  p_eta_hours      integer,
  p_method_status  text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_zone   public.delivery_zones%ROWTYPE;
  v_method public.delivery_methods%ROWTYPE;
BEGIN
  PERFORM public.require_admin();

  IF p_zone_status NOT IN ('active', 'paused') OR p_method_status NOT IN ('active', 'paused') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  IF p_base_fee_minor IS NULL OR p_base_fee_minor < 0 THEN
    RAISE EXCEPTION 'invalid_fee' USING ERRCODE = '22023';
  END IF;
  IF p_eta_hours IS NOT NULL AND p_eta_hours < 0 THEN
    RAISE EXCEPTION 'invalid_eta' USING ERRCODE = '22023';
  END IF;

  IF p_zone_id IS NULL THEN
    INSERT INTO public.delivery_zones (name, city, status)
    VALUES (COALESCE(NULLIF(trim(p_zone_name), ''), 'Delivery zone'),
            COALESCE(NULLIF(trim(p_city), ''), 'Lahore'), p_zone_status)
    RETURNING * INTO v_zone;
  ELSE
    UPDATE public.delivery_zones
       SET name = COALESCE(NULLIF(trim(p_zone_name), ''), 'Delivery zone'),
           city = COALESCE(NULLIF(trim(p_city), ''), 'Lahore'),
           status = p_zone_status
     WHERE id = p_zone_id
    RETURNING * INTO v_zone;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'zone_not_found' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_method_id IS NULL THEN
    INSERT INTO public.delivery_methods (zone_id, name, type, base_fee_minor, min_order_minor, eta_hours, status)
    VALUES (v_zone.id, COALESCE(NULLIF(trim(p_method_name), ''), 'Standard delivery'),
            'flat', p_base_fee_minor, 0, p_eta_hours, p_method_status)
    RETURNING * INTO v_method;
  ELSE
    UPDATE public.delivery_methods
       SET zone_id = v_zone.id,
           name = COALESCE(NULLIF(trim(p_method_name), ''), 'Standard delivery'),
           type = 'flat',
           base_fee_minor = p_base_fee_minor,
           eta_hours = p_eta_hours,
           status = p_method_status
     WHERE id = p_method_id
    RETURNING * INTO v_method;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'method_not_found' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM public.log_admin_action('save', 'delivery', v_zone.id::text,
    jsonb_build_object('zone', to_jsonb(v_zone), 'method', to_jsonb(v_method)));

  RETURN jsonb_build_object('zone', to_jsonb(v_zone), 'method', to_jsonb(v_method));
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Store settings (the General tab had no save path at all).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_store_setting(p_key text, p_value jsonb)
RETURNS public.store_settings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.store_settings%ROWTYPE;
BEGIN
  PERFORM public.require_admin();

  IF coalesce(trim(p_key), '') = '' THEN
    RAISE EXCEPTION 'key_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.store_settings (key, value, updated_by, updated_at)
  VALUES (trim(p_key), p_value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_by = auth.uid(), updated_at = now()
  RETURNING * INTO v_row;

  PERFORM public.log_admin_action('save', 'store_setting', v_row.key,
    jsonb_build_object('value', v_row.value));
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_store_settings()
RETURNS TABLE(key text, value jsonb, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN QUERY SELECT s.key, s.value, s.updated_at FROM public.store_settings s ORDER BY s.key;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Price-change audit. Products are written directly by the admin editor (that
-- table does carry the grants), so a trigger is the only place to catch it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_products_audit_price()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.base_price_minor IS DISTINCT FROM OLD.base_price_minor
     OR NEW.status IS DISTINCT FROM OLD.status
     OR (NEW.deleted_at IS NULL) IS DISTINCT FROM (OLD.deleted_at IS NULL) THEN
    INSERT INTO public.admin_audit_log (actor_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'update', 'product', NEW.id::text, jsonb_build_object(
      'name', NEW.name,
      'from', jsonb_build_object('base_price_minor', OLD.base_price_minor, 'status', OLD.status, 'deleted_at', OLD.deleted_at),
      'to',   jsonb_build_object('base_price_minor', NEW.base_price_minor, 'status', NEW.status, 'deleted_at', NEW.deleted_at)
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS products_audit_price ON public.products;
CREATE TRIGGER products_audit_price
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_products_audit_price();

-- ─────────────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.admin_upsert_coupon(uuid,text,text,integer,bigint,bigint,bigint,integer,integer,timestamptz,timestamptz,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_coupon(uuid)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_tax_rate(uuid,text,integer)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_delivery(uuid,text,text,text,uuid,text,bigint,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_store_setting(text,jsonb)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_store_settings()                                  TO authenticated;
