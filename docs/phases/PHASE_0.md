# Phase 0 — Foundation & Clean Schema Rebuild

**Status:** LIVE
**Commits:** [`9c6fae7`](https://github.com/abd-haseeb-02/Kakeez/commit/9c6fae7) (code foundation) + [`8a98ca3`](https://github.com/abd-haseeb-02/Kakeez/commit/8a98ca3) (DB rewrite)
**Plan reference:** [`ECOMMERCE_CMS_PLAN.md`](../../ECOMMERCE_CMS_PLAN.md) §F.0

Phase 0 split into two commits because the destructive DB ops required
a real prod connection. Code foundation was prepared first (so the
migration SQL could be reviewed in the PR), DB rewrite executed second.

## Done

### Code foundation (`9c6fae7`)

- **`@supabase/ssr` 3-client pattern** under `src/lib/supabase/`:
  - `browser.ts` — anon client for `"use client"` files.
  - `server.ts` — cookie-aware `createServerClient` for Server
    Components, Route Handlers, Server Actions, `proxy.ts`.
  - `admin.ts` — service-role client gated by `import 'server-only'`.
  - `../supabase.ts` kept as a back-compat shim re-exporting the
    browser client so existing call sites compile unchanged.
- **`src/lib/money.ts`** — `rupeesToMinor()`, `minorToRupees()`,
  `formatPkr()`, `sumMinor()`. Internal math never touches floats.
- **`.env.example`** — documents `SUPABASE_SERVICE_ROLE_KEY` as
  server-only with a "never expose as `NEXT_PUBLIC_*`" comment.
- **COD-only UI cleanup** (§G.X.8 #1–3):
  - `src/app/checkout/page.tsx:31` — `useState<"cod" | "card">` →
    `useState<"cod">` (setter dropped).
  - `src/app/checkout/page.tsx:212-227` — Card / JazzCash / Easypaisa
    button row deleted; replaced with a single COD notice card.
    `CreditCard` import removed.
  - `src/app/admin/settings/page.tsx` — Payments tab shows
    "Cash on Delivery only — at launch" notice with a pointer to the
    future Operations → COD Risk tab.
- **`ECOMMERCE_CMS_PLAN.md` v2** — locked-in decisions, live CLI
  audit, variations spec (§B.1.X), custom-cake flow (§B.1.Y), COD
  ops (§G.X), clean schema rebuild plan (§F.0).
- **Drift capture** — `supabase/migrations/20260619000000_revert_woocommerce.sql`
  pulled from remote by `db pull` and given a capture-header
  comment (F.0 step b).
- **5 destructive migrations** STAGED for review (not pushed to DB
  yet in this commit).

### DB rewrite (`8a98ca3`)

Migrations applied to prod via `npx supabase db push --include-all
--linked` in the documented order:

1. **`20260617000001_drop_legacy.sql`** — extracted every legacy row
   into `_legacy_staging`, then dropped `public.{products, categories,
   orders, order_items, profiles}` + the email-based `is_admin()` +
   the seeded `admin@kakeez.com` auth user + the orphan
   `on_auth_user_created` trigger (CASCADE on the function drop
   catches future template variants).
2. **`20260617000002_create_new.sql`** — full new schema with
   integer-minor money, role-based identity, M:M categories,
   variations engine tables, custom-cake quote table, snapshot-bearing
   order items, COD-only orders/payments with column-level CHECKs,
   inventory ledger, COD ops tables (`cash_drops`, `cash_disputes`,
   `cod_blocklist`), notifications, `store_settings`. Every FK
   indexed. Phase-0 RPC stubs (`create_order`, `update_order_status`,
   `confirm_custom_order_quote`) ship returning `'NOT IMPLEMENTED'`
   so policy surface is correct from day 1.
3. **`20260617000003_etl.sql`** — backfilled 88 products preserving
   UUIDs; `decimal price * 100 → base_price_minor`; one
   `product_images` row per product (storage path unchanged); one
   `product_categories` row each. Slugs generated from name with
   `row_number()` collision suffix (handles duplicate "Cookies"
   names). The 1 stale order with 0 line items archived to
   `legacy_orders_archive` as evidence of the pre-Phase-1 non-
   transactional bug.
4. **`20260617000004_seed.sql`** — defaults the storefront can't
   launch without: `tax_rates` (No tax 0%, PK exempt), `delivery_zones`
   (Karachi), `delivery_methods` (Standard Karachi 9900 paisa flat),
   `store_settings` (currency PKR, brand Kakeez, `cod_only=true`,
   COD caps, custom-order caps, default lead time, support channel
   placeholders), all 5 variation attributes + 31 values seeded
   (size, flavor, shape, tiers, dietary).
5. **`20260617000005_rls.sql`** — RLS enabled on every public table.
   Public anon read on published catalog + active delivery / tax
   rows. Customer owns own profile / addresses / cart / orders
   (reads) / wishlist. Staff sees orders / inventory / customers;
   admin manages catalog / settings / coupons / roles. Hard
   `REVOKE INSERT, UPDATE, DELETE` on every money/stock/order table
   from anon AND authenticated — writes go through the SECURITY
   DEFINER RPCs only. Storage: `products` bucket public read +
   staff-write; new private `custom-order-uploads` bucket with
   owner-prefixed paths per §B.1.Y.5.

### Smoke tests verified (§F.0 step i)

- Anon catalog reads: 88 products, 4 categories, 88 product_images,
  88 product_categories, 5 attributes, 31 attribute_values
  (exact: 10 sizes + 10 flavors + 5 shapes + 3 tiers + 3 dietary),
  1 delivery zone, 1 delivery method @ 9900 paisa, 7 public
  store_settings, 1 tax rate.
- Anon `POST /orders` → 401 Unauthorized (table-level REVOKE
  enforced).
- Random product's `product_images.storage_path` returns 200
  `image/png` — UUID preservation kept every legacy URL valid.
- Slugs unique and clean: `cookies-1..5`, `cup-cakes-1..5`,
  `simple-cakes-1..N`, etc.
- `store_settings.cod_only = true`.

## Workarounds applied during push

- **Supabase `pg_dump` silently fails on Windows** → `db dump`
  output zero bytes; documented fallback is Studio SQL editor for
  the drift capture (already executed by `db pull`).
- **`db push` hits IPv6 timeouts intermittently** → solved by
  retrying with backoff. No code change.
- **`on_auth_user_created` trigger blocked the function drop** —
  the migration assumed a `handle_new_user` trigger name; actual
  name on the remote was `on_auth_user_created` (Supabase quickstart
  template). Fixed in commit by dropping both names AND adding
  `CASCADE` on the function drop to catch any other unknown
  dependents.
- **`kakeez_rpc_executor` role-owner pattern** (F.0 risk #7) hit
  Supabase's `0LP01 ADMIN option cannot be granted back to your
  own grantor`. RPCs ship owned by `postgres` for now — strictly
  no worse than the pre-rebuild state (which also used SECURITY
  DEFINER as postgres). Tracked as a Phase 4+ hardening item.

## Remaining

- **`kakeez_rpc_executor` dedicated role** for RPC ownership —
  deferred to a future hardening pass.
- Storage bucket rename `products → product-images` — deferred to
  Phase 6 (current bucket name is referenced by 88 image URLs;
  rename requires a coordinated `UPDATE product_images SET
  storage_path = replace(storage_path, '/products/', '/product-images/')`).
- `_legacy_staging` schema cleanup — keep around for 24+ hours,
  drop manually in Studio after smoke tests pass continuously.
  (Not yet dropped; safe to leave for now.)
