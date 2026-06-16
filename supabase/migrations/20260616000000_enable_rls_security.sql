-- ============================================================================
-- SECURITY HARDENING: Enable Row Level Security (RLS) on all public tables
-- ----------------------------------------------------------------------------
-- BEFORE this migration the tables had NO RLS, which on hosted Supabase means
-- the public anon key (shipped in client JS) could READ every customer's name
-- and email out of `orders`, and INSERT/UPDATE/DELETE any product, category or
-- order. This migration locks that down:
--   * categories / products : world-readable, admin-only writes
--   * orders / order_items   : a user sees & creates only their own rows;
--                              admin sees & manages everything
--   * storage (products)     : world-readable, admin-only writes
--
-- This migration is IDEMPOTENT (safe to re-run). If you applied the earlier
-- migrations through the Supabase SQL editor rather than the CLI, you can run
-- this file the same way, or `supabase db push` once the project is linked.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Admin helper. A single source of truth for "is the caller an admin?".
-- Uses the verified email claim from the Supabase-issued JWT, so it cannot be
-- spoofed by a normal client. To add more admins, extend the IN-list (or swap
-- this for an `admins` table lookup later).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() ->> 'email') IN ('admin@kakeez.com'),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS. Once enabled, the default is DENY; only the policies below pass.
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- CATEGORIES : public read, admin write
-- ===========================================================================
DROP POLICY IF EXISTS "categories_select_all"   ON public.categories;
DROP POLICY IF EXISTS "categories_admin_write"   ON public.categories;

CREATE POLICY "categories_select_all"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "categories_admin_write"
  ON public.categories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===========================================================================
-- PRODUCTS : public read, admin write
-- ===========================================================================
DROP POLICY IF EXISTS "products_select_all"  ON public.products;
DROP POLICY IF EXISTS "products_admin_write"  ON public.products;

CREATE POLICY "products_select_all"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "products_admin_write"
  ON public.products FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===========================================================================
-- ORDERS : a signed-in user may create and read ONLY their own orders
--          (matched on the verified email claim); admin sees/updates all.
-- ===========================================================================
DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own"          ON public.orders;
DROP POLICY IF EXISTS "orders_admin_update"        ON public.orders;
DROP POLICY IF EXISTS "orders_admin_delete"        ON public.orders;

CREATE POLICY "orders_select_own_or_admin"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR customer_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY "orders_insert_own"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR customer_email = (auth.jwt() ->> 'email')
  );

CREATE POLICY "orders_admin_update"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "orders_admin_delete"
  ON public.orders FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ===========================================================================
-- ORDER_ITEMS : tied to the parent order's ownership.
-- ===========================================================================
DROP POLICY IF EXISTS "order_items_select_own_or_admin" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_own"          ON public.order_items;
DROP POLICY IF EXISTS "order_items_admin_modify"        ON public.order_items;

CREATE POLICY "order_items_select_own_or_admin"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "order_items_insert_own"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_email = (auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "order_items_admin_modify"
  ON public.order_items FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===========================================================================
-- STORAGE : the `products` bucket stays world-readable, but writes are
--           restricted to admin (the previous policy allowed ANY signed-in
--           user to upload/overwrite/delete product images).
-- ===========================================================================
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert"   ON storage.objects;
DROP POLICY IF EXISTS "Auth Update"   ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete"   ON storage.objects;

CREATE POLICY "products_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

CREATE POLICY "products_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'products' AND public.is_admin());

CREATE POLICY "products_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'products' AND public.is_admin());

CREATE POLICY "products_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'products' AND public.is_admin());
