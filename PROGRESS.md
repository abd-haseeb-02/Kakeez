# Kakeez — Build Progress

**Last updated:** 2026-06-18
**Head:** `master` after the storefront/admin UI stabilization sprint
**Live Supabase project:** `kakeez-bakeshop` (`crzqqvbvaguttrkzvpqh`, Postgres 17, ACTIVE_HEALTHY)

This file is the single index for everything that's been built since the
audit in [`AUDIT.md`](./AUDIT.md). Each phase has a dedicated companion
doc under [`docs/phases/`](./docs/phases) covering files changed, DB
changes, verification, and follow-up. The audit-finding-to-commit map
lives in [`docs/AUDIT_RESOLUTION.md`](./docs/AUDIT_RESOLUTION.md).

The plan that drives all this is [`ECOMMERCE_CMS_PLAN.md`](./ECOMMERCE_CMS_PLAN.md).

---

## Snapshot

| Phase | Status   | Commit         | Doc                                                          |
| ----- | -------- | -------------- | ------------------------------------------------------------ |
| 0     | LIVE     | `8a98ca3`      | [`docs/phases/PHASE_0.md`](./docs/phases/PHASE_0.md)         |
| 1     | LIVE     | `07dbef4`      | [`docs/phases/PHASE_1.md`](./docs/phases/PHASE_1.md)         |
| 2     | part 1   | `d92d9bc`      | [`docs/phases/PHASE_2.md`](./docs/phases/PHASE_2.md)         |
| 3     | LIVE     | `107de8b`      | [`docs/phases/PHASE_3.md`](./docs/phases/PHASE_3.md)         |
| 4     | part 1+2 | `19b21e8` + `9216dfb` | [`docs/phases/PHASE_4.md`](./docs/phases/PHASE_4.md)  |
| UI/admin stabilization | done | current commit | This file + `WOOCOMMERCE_CMS_PLAN.md` |
| 5     | not started | —           | (Phase 5 plan in `ECOMMERCE_CMS_PLAN.md` §F Phase 5)         |
| 6     | not started | —           | (Phase 6 plan in `ECOMMERCE_CMS_PLAN.md` §F Phase 6)         |

`LIVE` means both the code is on `master` AND any required DB
migrations have been applied to prod. `part N` means scope is split
across multiple commits and the rest is documented under "Remaining"
in the phase doc.

## What's running on prod

- **88 products** preserved via Phase 0 ETL (UUIDs intact so the
  legacy `products` storage bucket still resolves every image URL).
- **4 categories**, **88 product_images**, **88 product_categories**,
  **5 attributes** (size, flavor, shape, tiers, dietary), **31
  attribute_values**.
- **1 admin user** (`admin@kakeez.com`) with a random Phase 3-generated
  password (see [`docs/phases/PHASE_3.md`](./docs/phases/PHASE_3.md)
  — rotate via Studio).
- **15 migrations** total in the repo (5 legacy + the orphan
  `20260619000000` drift capture + 9 Phase 0–4 migrations).

## 2026-06-18 UI/admin stabilization sprint

This was a product-polish sprint on top of the Phase 0-4 foundation,
not a schema-roadmap phase.

Completed:

- Pulled the latest `master` safely after preserving the local
  untracked migration that blocked the merge.
- Added realtime order support with
  `supabase/migrations/20260617044152_enable_orders_realtime.sql`.
- Fixed the local admin login/reset path for the dummy admin email
  case, without depending on a real inbox.
- Reworked the admin UI into a dark, modern operations console while
  preserving the existing data behavior.
- Restored the home hero as a slider: the mask stays fixed while the
  slide image and text move.
- Rebuilt the home page into one responsive layout instead of separate
  desktop/mobile artboards.
- Added root image assets to the category tabs, removed the old tab
  underline treatment, and added hover states.
- Removed the sale/banner section above `Follow @kakeezbakers`.
- Restored the product-grid green panel with white side margins and
  top/bottom decorative SVG layers.
- Made the navbar responsive with a mobile menu while preserving the
  desktop visual size.
- Tightened the cart drawer sizing while keeping the existing design
  language.
- Reworked checkout responsiveness.
- Aligned the single product page max width with the home/footer width,
  removed the legacy single-product hero/category banner, fixed the
  duplicate-image gallery behavior, and removed old `vw` sizing from
  the product page itself.

Verified:

- `npm run build` passes.
- Browser checks confirmed the home hero slider, welcome imagery,
  product-grid panel width, and single-product width alignment at
  desktop sizes.

Still not done:

- `npm run lint` is still not confirmed green; lint/types cleanup
  remains tracked as open audit work.
- The storefront is still largely Client Component based. Product
  `notFound()`, dynamic metadata, sitemap, server-rendered catalog
  queries, and SEO structured data remain future work.
- Full WooCommerce-depth CMS features are not complete: multi-image
  galleries, variable-product editor, category/attribute management UI,
  coupons, delivery zones, taxes, reporting, and deeper staff workflows
  remain on the roadmap.
- Checkout economics are still not fully server-previewed with coupons,
  taxes, delivery zones, or delivery slots.
- The legacy `ProductCard` component still contains absolute `vw`
  sizing for any old caller, although the current home grid no longer
  uses it.

## How money flows now (Phase 1 invariants)

- Cart sends ONLY `{productId, variationId, qty, options}` to the
  server. Prices in localStorage are display-only — the
  `create_order` RPC re-reads `products.base_price_minor +
  product_variations.price_delta_minor` from the DB.
- `orders.payment_method` has a column-level `CHECK = 'cod'` —
  non-COD orders are rejected at the DB layer, not just the UI.
- Order creation + line item snapshots + payment record + history
  row are wrapped in one plpgsql block. No more "1 order, 0 items"
  (the live evidence row from before Phase 1 is archived in
  `legacy_orders_archive`).

## Security posture vs the AUDIT.md baseline

| AUDIT.md finding                                  | Resolved in   |
| -------------------------------------------------- | ------------- |
| B Critical 1 — client-trusted checkout totals      | Phase 1       |
| B Critical 2 — committed `admin@kakeez.com` / `admin` | Phase 0 + 3 |
| B Critical 3 — admin email hard-coded in RLS + UI  | Phase 0 + 3 + 4-2 |
| C High — admin/checkout client-only protection     | Phase 4 part 2 (`proxy.ts`) |
| C High — non-transactional order creation          | Phase 1       |
| C High — RLS allows arbitrary order totals          | Phase 0 + 1   |
| C High — image upload lacks validation             | Phase 2       |
| C High — lint fails (32 errors)                    | NOT YET — see [`docs/AUDIT_RESOLUTION.md`](./docs/AUDIT_RESOLUTION.md) |
| D Medium — no product slug routes                  | Phase 2       |
| D Medium — invalid product URLs don't `notFound()` | partial — Phase 2 |
| D Medium — no draft/published model                | Phase 0 (`products.status`) |
| D Medium — no stock enforcement                    | partial — Phase 1 RPC supports; UI flag pending |
| D Medium — category cascade destroys products      | Phase 0 (`ON DELETE RESTRICT`) |
| D Medium — no payment backend                      | N/A — COD-only locked in |
| D Medium — schema lacks constraints / indexes      | Phase 0       |
| E Low — SEO is mostly static                       | Phase 6 (planned) |
| E Low — `<img>` bypasses next/image                | partial — Phase 2 admin remediated |
| E Low — fonts loaded via `<head><link>`            | Phase 6 (planned) |

Full mapping with commit references and remediation notes in
[`docs/AUDIT_RESOLUTION.md`](./docs/AUDIT_RESOLUTION.md).

## What's next

Phase 5 — Checkout Economics, per
[`ECOMMERCE_CMS_PLAN.md`](./ECOMMERCE_CMS_PLAN.md):

- Server-side coupon validation/redemption (replaces the client
  `PROMOS` dict still in `checkout/page.tsx`).
- Real tax rates and delivery zones/methods with city-aware lookup
  (currently `create_order` reads the first active method = flat
  PKR 99 Karachi).
- Optional delivery time slots.
- Transactional emails via Resend Edge Function (order_confirmed,
  status updates, password reset polishing).
- Phone OTP first-order COD (Twilio Verify) per G.X.4.
- Server-side password policy bump (Supabase project setting → ≥8).
- Email verification flip in `config.toml`.

Beyond that, Phase 6 covers reviews, wishlist, search, reporting,
SEO, accessibility — also fully scoped in the plan.

## Working with this branch

```bash
# Run dev server
npm install      # picks up @supabase/ssr + server-only added in Phase 0
npm run dev      # next dev (Turbopack, port 3000)

# Push a new migration (Phase 0+ convention — repo is source of truth)
npx supabase migration new <slug>
# edit supabase/migrations/<ts>_<slug>.sql
npx supabase db push --include-all --linked

# Build + typecheck (also runs on every phase verification)
npm run build
```

The CLI is already linked to `crzqqvbvaguttrkzvpqh`. The Windows
silent-pg_dump bug is documented in
[`docs/phases/PHASE_0.md`](./docs/phases/PHASE_0.md) §Workarounds.
