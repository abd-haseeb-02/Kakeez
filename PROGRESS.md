# Kakeez â€” Build Progress

**Last updated:** 2026-06-21
**Head:** current working tree after audit-continuation fixes
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
| 5     | part 1   | current working tree | [`docs/phases/PHASE_5.md`](./docs/phases/PHASE_5.md) |
| 6     | not started | â€”           | (Phase 6 plan in `ECOMMERCE_CMS_PLAN.md` Â§F Phase 6)         |

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
  â€” rotate via Studio).
- **19 migrations** total in the repo, including the current Phase 5
  checkout-economics migration.

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

## 2026-06-21 audit continuation

Completed:

- `npm run lint`, `npm run typecheck`, and `npm run build` all pass cleanly.
- Added server-rendered `/category/[slug]` pages with metadata and sitemap coverage.
- Wrapped product detail with a Server Component so invalid product URLs now return a real `notFound()` 404 while preserving the existing client detail experience.
- Replaced root Google Font `<link>` tags with `next/font/google` variables.
- Converted the remaining raw admin/account/shop image previews touched by lint to `next/image`.
- Added server-side checkout totals preview for live product prices, active variation deltas, coupon validation, and delivery fee calculation.
- Added `/admin/catalog` for hierarchical category management and global attributes/values.
- Added editable delivery/tax settings in `/admin/settings`.
- Applied the Phase 5 tax totals and notification queue migrations to the linked Supabase project.
- Added phone OTP verification groundwork: hashed OTP storage, server actions, signup/checkout verification UI, and checkout blocking until `profiles.phone_verified_at` is set. Test OTPs are logged to the server console for now.
- Added `/api/notifications/process` to process queued notification rows through Google SMTP and WhatsApp Cloud API once env vars are configured; dry-run mode logs messages for testing.

Still not done:

- The storefront is still partly Client Component based. Product 404 is now server-backed, but broader server-rendered catalog queries remain future work.
- Full WooCommerce-depth CMS features are not complete: multi-image galleries, variable-product editor, linked products, bundles, reporting, and deeper staff workflows remain on the roadmap.
- Checkout economics now have server-previewed prices/coupons/delivery/tax, order-time tax persistence, optional delivery-slot capture, and admin delivery/tax settings.

## How money flows now (Phase 1 invariants)

- Cart sends ONLY `{productId, variationId, qty, options}` to the
  server. Prices in localStorage are display-only â€” the
  `create_order` RPC re-reads `products.base_price_minor +
  product_variations.price_delta_minor` from the DB.
- `orders.payment_method` has a column-level `CHECK = 'cod'` â€”
  non-COD orders are rejected at the DB layer, not just the UI.
- Order creation + line item snapshots + payment record + history
  row are wrapped in one plpgsql block. No more "1 order, 0 items"
  (the live evidence row from before Phase 1 is archived in
  `legacy_orders_archive`).

## Security posture vs the AUDIT.md baseline

| AUDIT.md finding                                  | Resolved in   |
| -------------------------------------------------- | ------------- |
| B Critical 1 â€” client-trusted checkout totals      | Phase 1       |
| B Critical 2 â€” committed `admin@kakeez.com` / `admin` | Phase 0 + 3 |
| B Critical 3 â€” admin email hard-coded in RLS + UI  | Phase 0 + 3 + 4-2 |
| C High â€” admin/checkout client-only protection     | Phase 4 part 2 (`proxy.ts`) |
| C High â€” non-transactional order creation          | Phase 1       |
| C High â€” RLS allows arbitrary order totals          | Phase 0 + 1   |
| C High â€” image upload lacks validation             | Phase 2       |
| C High - lint fails (32 errors)                    | resolved - lint exits 0 cleanly |
| D Medium â€” no product slug routes                  | Phase 2       |
| D Medium - invalid product URLs do not `notFound()` | resolved - current working tree |
| D Medium â€” no draft/published model                | Phase 0 (`products.status`) |
| D Medium â€” no stock enforcement                    | partial â€” Phase 1 RPC supports; UI flag pending |
| D Medium â€” category cascade destroys products      | Phase 0 (`ON DELETE RESTRICT`) |
| D Medium â€” no payment backend                      | N/A â€” COD-only locked in |
| D Medium â€” schema lacks constraints / indexes      | Phase 0       |
| E Low â€” SEO is mostly static                       | partial â€” product/category metadata + sitemap |
| E Low - `<img>` bypasses next/image                | resolved - current working tree |
| E Low - fonts loaded via `<head><link>`            | resolved - current working tree |

Full mapping with commit references and remediation notes in
[`docs/AUDIT_RESOLUTION.md`](./docs/AUDIT_RESOLUTION.md).

## What's next

Phase 5 - Checkout Economics, per
[`ECOMMERCE_CMS_PLAN.md`](./ECOMMERCE_CMS_PLAN.md):

- Server-side checkout preview now covers product prices, active variation deltas, coupon validation, delivery fee calculation, and configured default tax.
- `create_order` now persists configured tax totals through the Phase 5 tax migration.
- Notification queueing and sender route are wired. Remaining: add real Google SMTP and WhatsApp Cloud API credentials, then set `NOTIFICATIONS_DRY_RUN=false`.
- Next implementation slice: product variation editor and multi-image gallery.
- Phone OTP first-order COD (Twilio Verify) per G.X.4.
- Server-side password policy bump (Supabase project setting -> >=8).
- Email verification flip in `config.toml`.

Beyond that, Phase 6 covers reviews, wishlist, search, reporting,
SEO, accessibility - also fully scoped in the plan.

## Working with this branch

```bash
# Run dev server
npm install      # picks up @supabase/ssr + server-only added in Phase 0
npm run dev      # next dev (Turbopack, port 3000)

# Push a new migration (Phase 0+ convention â€” repo is source of truth)
npx supabase migration new <slug>
# edit supabase/migrations/<ts>_<slug>.sql
npx supabase db push --include-all --linked

# Build + typecheck (also runs on every phase verification)
npm run build
```

The CLI is already linked to `crzqqvbvaguttrkzvpqh`. The Windows
silent-pg_dump bug is documented in
[`docs/phases/PHASE_0.md`](./docs/phases/PHASE_0.md) Â§Workarounds.
