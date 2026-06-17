-- ============================================================================
-- Phase 2 follow-up — bootstrap an admin user (no committed credential)
-- ============================================================================
-- The Phase 0 rebuild deleted the seeded `admin@kakeez.com`/`admin` user
-- (AUDIT.md §B Critical #1 — committed credential in git). Without an admin
-- profile, the new role-based RLS rejects every admin write from the new
-- /admin/products editor.
--
-- This migration solves the chicken-and-egg without committing a known
-- password:
--   1. INSERT into auth.users with a password generated at MIGRATION RUNTIME
--      from gen_random_bytes — different every push, nothing committed.
--   2. handle_new_user() fires and creates a profile with role='customer'.
--   3. DO block elevates that row to role='admin'.
--   4. RAISE NOTICE prints the generated password to the CLI log so the
--      operator can copy it once and change it in Studio.
--
-- Idempotent: if `admin@kakeez.com` already exists (re-running the migration
-- locally or after a partial push) we update its profile to admin and skip
-- the auth.users INSERT — no password change in that case.
-- ============================================================================

DO $$
DECLARE
  v_user_id  uuid;
  v_password text;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM auth.users WHERE email = 'admin@kakeez.com';

  IF v_existing IS NULL THEN
    -- Generate a 24-char password from random bytes. Base64-encoded so the
    -- characters are safe to paste from the CLI log. pgcrypto lives in the
    -- `extensions` schema on Supabase, so schema-qualify these calls.
    v_password := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/=', 'xyz');

    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@kakeez.com',
      extensions.crypt(v_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Kakeez Admin"}'::jsonb,
      now(), now(),
      '', '', '', ''
    ) RETURNING id INTO v_user_id;

    -- handle_new_user() trigger has now created profiles row with role='customer'.
    UPDATE public.profiles
       SET role = 'admin', full_name = 'Kakeez Admin'
     WHERE id = v_user_id;

    RAISE NOTICE '════════════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  ADMIN USER CREATED — capture the password below and rotate it ASAP';
    RAISE NOTICE '════════════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  Email:    admin@kakeez.com';
    RAISE NOTICE '  Password: %', v_password;
    RAISE NOTICE '════════════════════════════════════════════════════════════════════════════════';
    RAISE NOTICE '  How to rotate: Supabase Studio → Authentication → Users → admin@kakeez.com';
    RAISE NOTICE '  → "Send password recovery" OR "Reset password".';
    RAISE NOTICE '════════════════════════════════════════════════════════════════════════════════';
  ELSE
    UPDATE public.profiles
       SET role = 'admin'
     WHERE id = v_existing;
    RAISE NOTICE 'admin@kakeez.com already exists in auth.users — elevated profile role to admin (password unchanged)';
  END IF;
END $$;
