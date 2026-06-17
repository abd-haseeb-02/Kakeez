-- ============================================================================
-- Drift-capture file (ECOMMERCE_CMS_PLAN.md §F.0 step b).
--
-- This migration existed on the remote project (kakeez-bakeshop,
-- ref crzqqvbvaguttrkzvpqh) but was NOT in the repo. `supabase db pull`
-- captured it locally on 2026-06-17. Committing it here brings the repo
-- migration ledger back in sync with the remote ledger.
--
-- Origin: applied on remote 2026-06-19 to revert a previously-attempted
-- WooCommerce-style schema that was never fully built out.
--
-- IMPORTANT: this migration is informational only — Phase 0's
-- `drop_legacy.sql` (next migration in the sequence) drops the legacy
-- tables this file targets anyway. The unmanaged `public.profiles` table
-- observed on the live database was NOT created by this migration —
-- inspect its column set in Supabase Studio before Phase 0's
-- `drop_legacy.sql` runs (the new `profiles` schema may need backfill
-- from a column we don't yet know about).
-- ============================================================================

-- Revert WooCommerce Schema

DROP TABLE IF EXISTS public.product_category_mapping CASCADE;
DROP TABLE IF EXISTS public.product_links CASCADE;
DROP TABLE IF EXISTS public.variation_options CASCADE;
DROP TABLE IF EXISTS public.product_variations CASCADE;
DROP TABLE IF EXISTS public.product_attributes CASCADE;
DROP TABLE IF EXISTS public.attribute_terms CASCADE;
DROP TABLE IF EXISTS public.attributes CASCADE;
DROP TABLE IF EXISTS public.product_galleries CASCADE;
-- Revert Products Table modifications (optional, but we'll drop the new columns to be safe)
ALTER TABLE public.products
DROP COLUMN IF EXISTS type,
DROP COLUMN IF EXISTS sku,
DROP COLUMN IF EXISTS regular_price,
DROP COLUMN IF EXISTS sale_price,
DROP COLUMN IF EXISTS manage_stock,
DROP COLUMN IF EXISTS status;
-- Note: We do not drop `stock_quantity` because the old schema already had it.;
