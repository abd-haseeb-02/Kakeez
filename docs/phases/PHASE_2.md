# Phase 2 — Catalog Depth (part 1)

**Status:** part 1 LIVE (the variations matrix builder and a few other
items are part 2, not yet started)
**Commit:** [`d92d9bc`](https://github.com/abd-haseeb-02/Kakeez/commit/d92d9bc)
**Plan reference:** [`ECOMMERCE_CMS_PLAN.md`](../../ECOMMERCE_CMS_PLAN.md) §F Phase 2 + §B.1.X + §B.1.Y

Phase 2 unblocks admin catalog management (broken since the schema
rebuild) and lights up the storefront-facing variation picker the
DB schema already supports. Migration count: 0 (no new SQL — the
B.1.X tables were created in Phase 0's `0002_create_new.sql`).

## Done

### Admin product editor revamp (`src/app/admin/products/page.tsx`)

Complete rewrite on top of the new schema:

- **Reads** — `products` joined with `product_categories(categories(name))`
  + `product_images(storage_path, position, is_featured)`. Hero image
  derived from the featured row.
- **Mutations**:
  - Create: insert `products` with `type='physical'`,
    `status` (draft / published / archived), slug auto-generated
    via a kebab-case regex with a `Math.random` base36 suffix for
    uniqueness, then insert one `product_images` row (featured,
    position 0) and one `product_categories` row.
  - Edit: `UPDATE products`, then conditionally replace the
    featured image and/or the category row if changed.
  - Delete: `DELETE products` — CASCADE handles `product_images`,
    `product_categories`, `product_attributes`, variations.
- **Server-validated image upload** (closes AUDIT.md §C High):
  - MIME allowlist: `image/{png,jpeg,webp,avif}` only.
  - 5 MB max enforced before upload.
  - Filenames generated via `crypto.randomUUID()` (replaces
    `Math.random()` which was not crypto-strength and could
    collide).
  - Storage RLS in Phase 0 already restricts the `products` bucket
    to staff-write; this adds client-side validation as the first
    gate.
- **Category delete** — handles the new `ON DELETE RESTRICT` FK on
  `product_categories`. Postgres `23503` foreign key violation
  surfaces as "This category still has products attached. Reassign
  or delete them first" instead of a silent cascade.
- **Inline error banner** — when an admin write is RLS-blocked
  (which happens until they're elevated to `role='admin'` in
  `profiles`), the banner explicitly shows the Studio SQL to fix
  it (this banner was the workaround before Phase 3's bootstrap
  migration; the bootstrap now does the same thing via CLI).
- All money formatting now goes through `formatPkr()` from
  `src/lib/money.ts`. Form input is rupees, persisted to
  `base_price_minor` via `rupeesToMinor()` with the underneath-the-
  input hint showing the integer paisa.

### Storefront slug routing

`src/app/product/[id]/page.tsx` → `src/app/product/[slug]/page.tsx`.
The new page:

- Tries lookup by slug first; if no match AND the param matches the
  UUID regex, falls back to lookup by id. This preserves every old
  shared `/product/<uuid>` link (e.g. from WhatsApp DMs / Instagram
  bio).
- `ProductCard` accepts an optional `slug` prop and navigates to it.
- Homepage passes `product.slug` through.

### Storefront variation picker scaffolding

In the new product detail page:

- Fetches `product_variations` + `product_attributes` + their
  `attribute_values` whenever a product page loads.
- If the product has any attributes, renders a chip group per
  attribute in `display_order`.
- **Progressive disabling** per §B.1.X.7 — a value is greyed +
  struck-through when no active variation matches the current
  selections plus that candidate.
- Live price = `base_price_minor + selectedVariation.price_delta_minor`,
  updated on every chip click.
- Add-to-cart **disabled** until every required attribute is picked
  AND the combo resolves to an active variation. CTA text mirrors
  state ("Pick Size", "Pick Flavor", "ADD TO CART - Rs. 3,650").
- `variationId` + `variationLabel` snapshotted into the cart so the
  `create_order` RPC can pass them through to `order_items`.

The 88 ETL'd products are all `type='physical'` with no
`product_variations` rows yet, so the picker stays hidden for them
— it activates the moment admin creates a variation row.

## Verified

- `npm run build` green; .next stale-route cache cleared after the
  `[id]` → `[slug]` rename.
- Homepage accessibility snapshot still shows all 88 products at
  correct prices.
- `/product/cookies-1`, `/product/customized-cake-65`,
  `/admin/products` all return 200 in dev.
- Zero runtime console errors.

## Remaining (Phase 2 part 2)

- **Variations matrix builder** at `/admin/products/[id]/variations`
  — the §B.1.X.6 spec (multi-select attributes → Cartesian product
  matrix → sparse-mode `Active` toggles → bulk ops → soft-delete
  protects history). Schema is ready; UX is a substantial new page.
- **Multi-image gallery** in the product editor — drag-reorder,
  per-image alt text. Schema (`product_images.position`) is ready.
- **M:M category multi-select** in the product form — `product_categories`
  is M:M; the editor uses a single category for parity with the
  legacy flow.
- **Tags + tag UI** — schema not yet created (`tags` /
  `product_tags`).
- **Nested categories** (`categories.parent_id`) — column exists
  with `ON DELETE RESTRICT` but the admin UI doesn't expose
  parent picking.
- **Custom-cake quote flow UI** (§B.1.Y) — schema (`custom_order_requests`)
  exists; the customer + admin pages don't.
- **`/shop` page** — server-rendered catalog browse with filters
  (Phase 6 SEO).
- **`/category/[slug]` pages** — server-rendered per-category
  listing (Phase 6 SEO).

## Files touched

| File                                              | Lines  | Net change |
| ------------------------------------------------- | ------ | ---------- |
| `src/app/admin/products/page.tsx`                 |   712  | rewrite    |
| `src/app/page.tsx`                                |    11  | edit       |
| `src/app/product/[id]/page.tsx`                   |  -243  | delete     |
| `src/app/product/[slug]/page.tsx`                 |   393  | NEW        |
| `src/components/shop/ProductCard.tsx`             |     4  | edit       |
