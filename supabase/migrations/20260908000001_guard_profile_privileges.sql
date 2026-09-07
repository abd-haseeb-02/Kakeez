-- C1 remediation: stop customers self-escalating profile privileges.
-- 1. Re-revoke the sensitive columns (a prior blanket GRANT re-opened them).
REVOKE UPDATE (role, cod_trust_level, no_show_count, blocked_at, blocked_reason)
  ON public.profiles FROM anon, authenticated;

-- 2. Durable guard: reject privilege-column changes from non-admins even if a
--    future GRANT re-opens the columns.
CREATE OR REPLACE FUNCTION public.guard_profile_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role            IS DISTINCT FROM OLD.role
  OR NEW.cod_trust_level IS DISTINCT FROM OLD.cod_trust_level
  OR NEW.no_show_count   IS DISTINCT FROM OLD.no_show_count
  OR NEW.blocked_at      IS DISTINCT FROM OLD.blocked_at
  OR NEW.blocked_reason  IS DISTINCT FROM OLD.blocked_reason THEN
    RAISE EXCEPTION 'cannot modify privileged profile columns' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard_privilege ON public.profiles;
CREATE TRIGGER profiles_guard_privilege
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privilege_columns();
