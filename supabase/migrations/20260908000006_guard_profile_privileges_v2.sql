-- Refinement of the privilege guard: exempt the service role and superuser
-- sessions. Those are backend/admin tooling with no auth.uid(), and without
-- this exemption an operator could not block an abusive customer from a script
-- or the SQL console. A signed-in customer still carries role='authenticated'
-- and is not a superuser, so the escalation path stays closed.
CREATE OR REPLACE FUNCTION public.guard_profile_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jwt_role text;
  v_is_super boolean;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_jwt_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN others THEN
    v_jwt_role := NULL;
  END;
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT usesuper INTO v_is_super FROM pg_user WHERE usename = session_user;
  IF coalesce(v_is_super, false) THEN
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
