-- ============================================================================
-- Phase 4 part 2 / Migration 9 — admin user management RPCs
-- (ECOMMERCE_CMS_PLAN.md §B.3.1)
-- ============================================================================
-- Role changes can't go through plain UPDATE because 0005_rls.sql does
--   REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;
-- That column-level REVOKE sits beneath RLS, so even admins can't write the
-- column via PostgREST. We give them a SECURITY DEFINER RPC instead, which
-- gates on is_admin() and adds a few safety rails (valid enum, no last-
-- admin demotion). Same shape for the block/unblock helper that drives the
-- COD risk flow (G.X.4).
--
-- We also expose a SECURITY DEFINER function that joins profiles with
-- auth.users so the /admin/staff page can render emails — auth.users is not
-- readable from PostgREST as a normal authenticated user.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. admin_list_users — joined view, admin-gated.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id                 uuid,
  email              text,
  role               text,
  full_name          text,
  phone_e164         text,
  cod_trust_level    text,
  no_show_count      int,
  blocked_at         timestamptz,
  blocked_reason     text,
  email_confirmed_at timestamptz,
  last_sign_in_at    timestamptz,
  created_at         timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.role,
    p.full_name,
    p.phone_e164,
    p.cod_trust_level,
    p.no_show_count,
    p.blocked_at,
    p.blocked_reason,
    u.email_confirmed_at,
    u.last_sign_in_at,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY
    CASE p.role WHEN 'admin' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END,
    p.created_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. set_profile_role — role change with safety rails.
--    - enum check (customer / staff / admin)
--    - cannot demote the last admin (anti-lockout)
--    - admin can change anyone's role (including their own — they can also
--      lock themselves out as customer/staff, that's their call as long as
--      another admin still exists)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_profile_role(
  p_user_id uuid,
  p_new_role text
) RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row              public.profiles%ROWTYPE;
  v_target_role      text;
  v_remaining_admins int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
  IF p_new_role NOT IN ('customer', 'staff', 'admin') THEN
    RAISE EXCEPTION 'invalid_role:%', p_new_role USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_target_role FROM public.profiles WHERE id = p_user_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = '22023';
  END IF;

  -- Anti-lockout: refuse to demote the last admin.
  IF v_target_role = 'admin' AND p_new_role <> 'admin' THEN
    SELECT COUNT(*) INTO v_remaining_admins
      FROM public.profiles
     WHERE role = 'admin' AND id <> p_user_id;
    IF v_remaining_admins = 0 THEN
      RAISE EXCEPTION 'cannot_demote_last_admin' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.profiles SET role = p_new_role WHERE id = p_user_id RETURNING * INTO v_row;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.set_profile_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_profile_role(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. admin_set_user_blocked — soft-block a customer from placing COD orders.
--    The create_order RPC will read profiles.blocked_at in Phase 5 alongside
--    cod_blocklist (G.X.4); this RPC writes the per-user side of that gate.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_blocked(
  p_user_id uuid,
  p_blocked boolean,
  p_reason  text DEFAULT NULL
) RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET blocked_at     = CASE WHEN p_blocked THEN now() ELSE NULL END,
         blocked_reason = CASE WHEN p_blocked THEN p_reason ELSE NULL END
   WHERE id = p_user_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = '22023';
  END IF;
  RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.admin_set_user_blocked(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_blocked(uuid, boolean, text) TO authenticated;
