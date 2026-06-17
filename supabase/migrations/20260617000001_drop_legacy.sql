-- ============================================================================
-- Phase 0 / Migration 1 of 5 — DROP LEGACY (ECOMMERCE_CMS_PLAN.md §F.0 step d)
-- ============================================================================
-- DESTRUCTIVE. Drops public.{products, categories, orders, order_items, profiles}
-- after copying every row into a temporary _legacy_staging schema for the ETL
-- step (0003_etl.sql) to read from.
--
-- PRE-FLIGHT (manual, before `supabase db push`):
--   1. PITR snapshot via Supabase Dashboard → Database → Backups.
--   2. Studio SQL editor: capture the unmanaged public.profiles column list
--      (see ECOMMERCE_CMS_PLAN.md §F.0 step b). If it carries data we want
--      (e.g. a username/loyalty_points column), extend the ETL in 0003.
--   3. Confirm the rollback path: PITR restore button in Dashboard.
--
-- Drops in FK-safe order. No CASCADE wildcards beyond what's strictly needed.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Staging schema (kept for the duration of Phase 0; dropped at the end of
--    step i after 24 h of green smoke tests).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS _legacy_staging;

CREATE TABLE _legacy_staging.products    AS TABLE public.products;     -- 88 rows
CREATE TABLE _legacy_staging.categories  AS TABLE public.categories;   -- 4 rows
CREATE TABLE _legacy_staging.orders      AS TABLE public.orders;       -- 1 row (archival evidence of B5 non-transactional bug)
CREATE TABLE _legacy_staging.order_items AS TABLE public.order_items;  -- 0 rows (shape only)

-- Capture the unmanaged profiles table if it exists (drift) so step f can
-- decide whether to backfill from it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    EXECUTE 'CREATE TABLE _legacy_staging.profiles AS TABLE public.profiles';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop RLS policies (every policy by name — no silent survival).
--    The policies below were created by 20260616000000_enable_rls_security.sql.
--    DROP POLICY IF EXISTS is idempotent if any was removed in Studio.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "categories_select_all"        ON public.categories;
DROP POLICY IF EXISTS "categories_admin_write"       ON public.categories;
DROP POLICY IF EXISTS "products_select_all"          ON public.products;
DROP POLICY IF EXISTS "products_admin_write"         ON public.products;
DROP POLICY IF EXISTS "orders_select_own_or_admin"   ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own"            ON public.orders;
DROP POLICY IF EXISTS "orders_admin_update"          ON public.orders;
DROP POLICY IF EXISTS "orders_admin_delete"          ON public.orders;
DROP POLICY IF EXISTS "order_items_select_own_or_admin" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_own"          ON public.order_items;
DROP POLICY IF EXISTS "order_items_admin_modify"        ON public.order_items;

-- Storage policies on the products bucket (from 20260616000000).
DROP POLICY IF EXISTS "products_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "products_admin_insert"  ON storage.objects;
DROP POLICY IF EXISTS "products_admin_update"  ON storage.objects;
DROP POLICY IF EXISTS "products_admin_delete"  ON storage.objects;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Drop tables in FK-safe order.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.order_items;
DROP TABLE IF EXISTS public.orders;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.categories;
DROP TABLE IF EXISTS public.profiles;  -- the drift table, if present

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Drop the email-based admin gate. The new schema replaces it with a
--    role-based has_role() reading profiles.role by auth.uid().
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.is_admin();

-- Drop any handle_new_user trigger/function that may have come from the
-- unmanaged profiles work in Studio. The new schema installs its own.
-- The Supabase quickstart template names the trigger `on_auth_user_created`
-- (confirmed on this remote); we also defensively drop `handle_new_user` in
-- case future quickstart versions rename it. CASCADE on the function drop
-- catches any other unknown dependents we don't have names for.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user      ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Remove the seeded default admin (committed credential `admin@kakeez.com` /
--    `admin` from 20260615000001_seed_admin.sql). The new admin is created
--    manually via Supabase Studio Authentication → Users in F.0 step g, with
--    a real password that never enters git.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM auth.users WHERE email = 'admin@kakeez.com';

-- ─────────────────────────────────────────────────────────────────────────────
-- Note: storage bucket `products` is intentionally KEPT. The 88 image URLs
-- under it remain valid because 0003_etl.sql preserves product UUIDs and the
-- bucket name. Renaming to `product-images` is deferred to Phase 6.
-- ============================================================================
