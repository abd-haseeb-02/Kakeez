-- ============================================================================
-- Phase 0 / Migration 3 of 5 — ETL FROM _legacy_staging
-- (ECOMMERCE_CMS_PLAN.md §F.0 step f)
-- ============================================================================
-- Backfills the 88 real products + 4 categories captured by 0001_drop_legacy.sql
-- into the new schema (0002_create_new.sql). The 1 stale order from the legacy
-- system is archived to legacy_orders_archive — it would not survive the new
-- CHECK constraints (decimal vs integer minor, customer_phone NOT NULL, etc.),
-- but it is institutional memory of the non-transactional checkout bug.
--
-- Critical invariant: product UUIDs PRESERVED. The live storage bucket
-- `products` references images by paths derived from these IDs. Re-generating
-- ids would break every existing image URL on the storefront. Categories
-- preserve their IDs too so any external bookmarks survive.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Categories (4 rows). parent_id stays NULL — the legacy schema was flat.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.categories (id, name, slug, image_storage_path, status, created_at)
SELECT
  id,
  name,
  slug,
  NULL,                -- legacy categories table had no image column
  'published',
  created_at
FROM _legacy_staging.categories;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Products (88 rows). Preserve id. Decimal price → integer minor.
--    Default type='physical' (variations added later via admin UI),
--    status='published', track_inventory=false (Kakeez is made-to-order).
--    Slugs generated from name with row_number() collision suffix (the live
--    catalog has duplicate names — at least two "Chocolate Cake" entries).
-- ─────────────────────────────────────────────────────────────────────────────
WITH base AS (
  SELECT
    p.id,
    p.name,
    p.description,
    ROUND(p.price * 100)::bigint            AS base_price_minor,
    p.image_url,
    p.category_id,
    p.is_best_seller,
    p.stock_quantity,
    p.created_at,
    -- Slug: lowercase, alnum-only, collapse runs of non-alnum to hyphen, trim.
    NULLIF(
      TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(p.name, '[^a-zA-Z0-9]+', '-', 'g'))),
      ''
    ) AS slug_base
  FROM _legacy_staging.products p
),
numbered AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY slug_base ORDER BY created_at) AS dup_n
  FROM base
)
INSERT INTO public.products (
  id, type, status, name, slug, description,
  base_price_minor, track_inventory, stock_quantity,
  is_perishable, is_best_seller, is_featured,
  published_at, created_at
)
SELECT
  id,
  'physical',
  'published',
  name,
  CASE WHEN dup_n = 1
       THEN COALESCE(slug_base, 'product-' || SUBSTRING(id::text, 1, 8))
       ELSE COALESCE(slug_base, 'product-' || SUBSTRING(id::text, 1, 8)) || '-' || dup_n
  END AS slug,
  description,
  base_price_minor,
  false,            -- made-to-order; admin flips to true per-product in Phase 2 UI
  0,
  true,             -- bakery default: cakes/pastries perishable
  COALESCE(is_best_seller, false),
  false,
  created_at,
  created_at
FROM numbered;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Product images (one row per product with a non-null image_url).
--    storage_path carries the raw image_url; Phase 6 renames bucket and
--    rewrites these paths.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.product_images (product_id, storage_path, position, is_featured, created_at)
SELECT
  id,
  image_url,
  0,
  true,
  created_at
FROM _legacy_staging.products
WHERE image_url IS NOT NULL AND image_url <> '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Product → category M:M (one join row per product that had a category_id).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.product_categories (product_id, category_id, position)
SELECT id, category_id, 0
FROM _legacy_staging.products
WHERE category_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Archive the 1 stale order (with 0 line items — proves the non-transactional
--    checkout bug from AUDIT.md §B5). It would fail the new orders CHECK
--    constraints, so a separate archive table holds it for ops reference.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.legacy_orders_archive (
  legacy_id        uuid PRIMARY KEY,
  customer_name    text,
  customer_email   text,
  total_amount     numeric(10, 2),
  status           text,
  archive_reason   text NOT NULL,
  legacy_created_at timestamptz,
  archived_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.legacy_orders_archive
  (legacy_id, customer_name, customer_email, total_amount, status, archive_reason, legacy_created_at)
SELECT
  id,
  customer_name,
  customer_email,
  total_amount,
  status,
  'pre_rebuild_evidence_non_transactional_checkout_bug',
  created_at
FROM _legacy_staging.orders;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. _legacy_staging schema is intentionally NOT dropped here. Per F.0 step
--    (i), it stays for 24 h after smoke tests pass, then is dropped manually
--    in Studio. Keeping it around enables ETL re-runs if smoke tests find
--    a corrupted row.
-- ============================================================================
