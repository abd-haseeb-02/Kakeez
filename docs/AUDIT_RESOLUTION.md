# AUDIT.md â†’ Resolution Map

A cross-reference from every finding in [`../AUDIT.md`](../AUDIT.md)
(dated 2026-06-16) to the commit / migration / file where it was
resolved. Findings still open carry a NOT YET tag and a one-line
plan.

The original [`REMEDIATION_PLAN.md`](../REMEDIATION_PLAN.md) phased
the same fixes; the phase numbers below refer to the
Kakeez-execution phases documented in
[`phases/`](./phases) (NOT the remediation-plan phases â€” the
mappings happen to overlap but aren't identical).

---

## B â€” Critical

### B.1 Client-trusted checkout totals and item prices

**Files audited:** `src/app/checkout/page.tsx:62-105`, `src/store/useCart.ts:23`
**Status:** RESOLVED in Phase 1
**Commit:** [`07dbef4`](https://github.com/abd-haseeb-02/Kakeez/commit/07dbef4)
**Migration:** `20260617000006_create_order_rpc.sql`

The `create_order` RPC body re-reads `products.base_price_minor +
COALESCE(product_variations.price_delta_minor, 0)` from the database
and IGNORES any `price` value sent from the browser. The order +
items + payment + history are wrapped in one plpgsql block â€”
atomic, no orphan rows. The cart shape is intentionally kept
backward-compatible (see the security-rationale comment block at
the top of `src/store/useCart.ts`); the guarantee lives on the
server, not in the cart shape. See
[`phases/PHASE_1.md`](./phases/PHASE_1.md) for the full RPC
invariant list.

### B.2 Default admin credential committed and seeded

**File audited:** `supabase/migrations/20260615000001_seed_admin.sql:25`
**Status:** RESOLVED in Phase 0 (delete) + Phase 3 (replacement bootstrap)
**Commits:** [`8a98ca3`](https://github.com/abd-haseeb-02/Kakeez/commit/8a98ca3) + [`107de8b`](https://github.com/abd-haseeb-02/Kakeez/commit/107de8b)

Phase 0's `20260617000001_drop_legacy.sql` `DELETE FROM auth.users
WHERE email = 'admin@kakeez.com'`. The legacy seed migration file
is retained in the repo for ledger consistency (Supabase tracks
applied versions; deleting the file would orphan the row) but the
auth user it created is gone.

Phase 3's `20260617000007_bootstrap_admin.sql` re-creates the admin
the right way â€” random 24-char password generated at migration time
via `extensions.gen_random_bytes(18)`, printed to the CLI log
(captured in gitignored `tmp/admin_push.log`), never in the repo.
Idempotent: if the email already exists the migration just elevates
the profile role.

### B.3 Admin authorization hard-coded to an email address

**Files audited:** `src/app/admin/layout.tsx:30`, `src/components/shop/Navbar.tsx:26`, `supabase/migrations/20260616000000_enable_rls_security.sql:24`
**Status:** RESOLVED in Phases 0 + 3 + 4 part 2
**Commits:** [`8a98ca3`](https://github.com/abd-haseeb-02/Kakeez/commit/8a98ca3), [`107de8b`](https://github.com/abd-haseeb-02/Kakeez/commit/107de8b), [`9216dfb`](https://github.com/abd-haseeb-02/Kakeez/commit/9216dfb)

- Phase 0 dropped the email-based `is_admin()` and re-created it
  as a `STABLE SECURITY DEFINER` function reading
  `profiles.role = 'admin'` by `auth.uid()`. The 9 admin / staff
  RLS policies in `0005_rls.sql` all use the new function +
  `has_role()` helper, never the email.
- Phase 3 swapped the admin layout's email check for a
  `profiles.role IN ('admin', 'staff')` lookup.
- Phase 3 also swapped the Navbar's email check for the same
  profile lookup.
- Phase 4 part 2's `set_profile_role` RPC is the only path to
  change a role (the column has a hard `REVOKE UPDATE` from
  authenticated), and `/admin/staff` exposes that in the UI.

---

## C â€” High

### C.1 Protected routes are only client-protected

**Files audited:** `src/app/admin/layout.tsx:28`, `src/app/checkout/page.tsx:40`
**Status:** RESOLVED in Phase 4 part 2
**Commit:** [`9216dfb`](https://github.com/abd-haseeb-02/Kakeez/commit/9216dfb)

`src/proxy.ts` (Next 16's renamed middleware) intercepts every
`/admin/*` (except `/admin/login`), `/account/*`, and `/checkout`
request server-side. Calls `auth.getUser()` against the cookie-bound
client; unauthed requests get a 307 to `/admin/login` or `/`
respectively. Original path preserved as `?next=` for future
post-login redirect. RLS remains the data-layer backstop.

### C.2 Order creation is not transactional

**File audited:** `src/app/checkout/page.tsx:87`
**Status:** RESOLVED in Phase 1
**Commit:** [`07dbef4`](https://github.com/abd-haseeb-02/Kakeez/commit/07dbef4)

The `create_order` RPC wraps `orders` insert + every `order_items`
insert + `payments` insert + `order_status_history` insert in one
plpgsql block. Any error rolls the whole order back. The 1
stale orphan order from the pre-Phase-1 system is archived to
`legacy_orders_archive` as institutional memory.

### C.3 RLS allows users to insert arbitrary order totals

**File audited:** `supabase/migrations/20260616000000_enable_rls_security.sql:92`
**Status:** RESOLVED in Phases 0 + 1
**Commits:** [`8a98ca3`](https://github.com/abd-haseeb-02/Kakeez/commit/8a98ca3) + [`07dbef4`](https://github.com/abd-haseeb-02/Kakeez/commit/07dbef4)

`0005_rls.sql` `REVOKE INSERT, UPDATE, DELETE ON public.orders FROM
anon, authenticated` â€” direct INSERT is impossible from PostgREST.
The only path to create an order is the `create_order` SECURITY
DEFINER RPC, which server-computes the total. Defense in depth:
`orders.payment_method` has a column-level `CHECK = 'cod'`.

### C.4 Product image upload lacks real validation

**File audited:** `src/app/admin/products/page.tsx:55`
**Status:** RESOLVED in Phase 2
**Commit:** [`d92d9bc`](https://github.com/abd-haseeb-02/Kakeez/commit/d92d9bc)

The new admin product editor:
- MIME allowlist (`image/png|jpeg|webp|avif`) on the `<input
  accept>` AND in the upload handler.
- 5 MB size cap rejected before upload begins.
- `crypto.randomUUID()` filenames (replaces `Math.random()`).
- Explicit `contentType` passed to `supabase.storage.upload()`.
- Storage RLS (Phase 0 `0005_rls.sql`) restricts the `products`
  bucket to staff-write â€” admins only.

### C.5 Lint fails (32 errors, 14 warnings)

**Status:** RESOLVED in the current working tree.

`npm run lint` now exits 0 cleanly. The prior warnings around raw
`<img>` previews, root Google Font loading, the unused footer prop,
and stable admin effect dependencies have been resolved or narrowed
with explicit suppressions. `npm run typecheck` also exits 0.

---

## D â€” Medium

### D.1 No product slug route / SEO-friendly URLs

**File audited:** `src/app/product/[id]/page.tsx:36`
**Status:** RESOLVED in Phase 2
**Commit:** [`d92d9bc`](https://github.com/abd-haseeb-02/Kakeez/commit/d92d9bc)

Route renamed to `/product/[slug]`. Slugs generated for all 88
ETL'd products in Phase 0's `0003_etl.sql` with a
`row_number()`-based collision suffix to handle duplicate names.
ProductCard navigation uses `slug`; the homepage passes it through.
Backward-compatible: param matches by slug first, falls back to
UUID lookup so every shared `/product/<uuid>` link still resolves.

### D.2 Invalid product URLs do not call `notFound()`

**File audited:** `src/app/product/[id]/page.tsx:102`
**Status:** RESOLVED in the current working tree.

`/product/[slug]/page.tsx` is now a Server Component wrapper that
checks published product existence by slug or UUID before rendering
the existing client detail component. Invalid product URLs call
Next.js `notFound()` and return a real 404 status.

### D.3 No published / draft model

**Files audited:** `supabase/migrations/20260615000000_initial_schema.sql:13`, `20260616000000_enable_rls_security.sql:66`
**Status:** RESOLVED in Phase 0
**Commit:** [`8a98ca3`](https://github.com/abd-haseeb-02/Kakeez/commit/8a98ca3)

`products.status` is a CHECK-constrained text column with
`('draft', 'published', 'archived')`. Public RLS only sees
`status='published'`. Admin editor exposes the three values as a
button group. All 88 ETL'd products were set to `published`.

### D.4 No stock enforcement

**Files audited:** `supabase/migrations/20260615000000_initial_schema.sql:22`, `src/app/product/[id]/page.tsx:204`, `src/store/useCart.ts:45`
**Status:** PARTIAL.

The `create_order` RPC supports it: when `track_inventory = true`,
it row-locks the stockable unit (product or variation), validates
stock, decrements transactionally, writes an `inventory_movements`
ledger row. None of the 88 ETL'd products have `track_inventory =
true` â€” the admin product editor doesn't expose the flag yet (Phase
2 follow-up). Once it does, the RPC starts enforcing immediately.

### D.5 Category deletion cascades to products

**Files audited:** `supabase/migrations/20260615000003_fix_cascade.sql:3`, `src/app/admin/products/page.tsx:178`
**Status:** RESOLVED in Phase 0 + Phase 2
**Commits:** [`8a98ca3`](https://github.com/abd-haseeb-02/Kakeez/commit/8a98ca3) + [`d92d9bc`](https://github.com/abd-haseeb-02/Kakeez/commit/d92d9bc)

The new `product_categories` table has `ON DELETE RESTRICT` against
`categories(id)` â€” Postgres refuses the delete if any product
still references the category. Phase 2's admin editor catches the
`23503` foreign-key violation and surfaces "This category still has
products attached. Reassign or delete them first" instead of a
silent cascade.

### D.6 No payment / webhook backend despite card UI

**File audited:** `src/app/checkout/page.tsx:31`
**Status:** RESOLVED (re-scoped â€” COD-only at launch)
**Commit:** [`9c6fae7`](https://github.com/abd-haseeb-02/Kakeez/commit/9c6fae7)

User decision per the v2 plan: **COD-only at launch**. The Card /
JazzCash / Easypaisa UI is REMOVED from code in Phase 0 (not just
hidden). The `payments` table and the `orders.payment_method`
CHECK are shaped so adding a PSP later is a one-line CHECK
relaxation + `ALTER TYPE ... ADD VALUE`, not a restructure. The
admin Settings â†’ Payments tab shows the locked-in COD notice.

### D.7 Schema lacks ecommerce constraints and indexes

**File audited:** `supabase/migrations/20260615000000_initial_schema.sql:5`
**Status:** RESOLVED in Phase 0
**Commit:** [`8a98ca3`](https://github.com/abd-haseeb-02/Kakeez/commit/8a98ca3)

`0002_create_new.sql` ships every FK with a btree index + partial
indexes for hot query paths (e.g.
`idx_products_status_published_at WHERE status='published'`,
`idx_orders_active_created_at WHERE status NOT IN ('delivered',
'cancelled')`, `idx_notifications_user WHERE read_at IS NULL`).
Money types are integer `bigint` `*_minor` (paisa). CHECK
constraints on every status enum, on positive prices, positive
quantities. `orders.user_id` is the ownership key (email is just a
contact snapshot). Trigram + GIN indexes seeded for the future
search work.

---

## E â€” Low

### E.1 SEO is mostly static

**File audited:** `src/app/layout.tsx:4`
**Status:** PARTIAL.

Product pages now have route-level metadata, canonical URLs, Product
JSON-LD, and real invalid-product 404s. `robots.ts` and `sitemap.ts`
are implemented, and the sitemap includes published
`/category/[slug]` routes. Category pages now generate route-level
metadata. Remaining SEO work: expand shop/menu metadata coverage as
the catalog grows and add broader content/error-state polish.

### E.2 Images bypass `next/image` in places

**Files audited:** `src/components/shop/ProductCard.tsx:52`, `src/app/admin/products/page.tsx:287,384`
**Status:** RESOLVED in the current working tree.

The remaining lint-reported raw image previews in account, admin,
product-card, and order surfaces were converted to `next/image` with
stable dimensions/sizes.

### E.3 Custom fonts loaded via `<head><link>`

**File audited:** `src/app/layout.tsx:16`
**Status:** RESOLVED in the current working tree.

The three Google Fonts (Cormorant Garamond, Playfair Display, Space
Grotesk) now load through `next/font/google` in the root layout and
feed the existing CSS font variables.

---

## Security / Launch checklists from AUDIT.md sections G + H

The original audit's section G (Security checklist) and H (Ecommerce
launch checklist) were a snapshot from 2026-06-16. The current
state for each row:

| Item                                  | Pre-rebuild status        | Now (post-Phase 4)                                |
| ------------------------------------- | ------------------------- | ------------------------------------------------- |
| RLS enabled                           | Pass                      | Pass â€” every public table + storage policies      |
| Service role safe                     | Pass                      | Pass â€” `import 'server-only'` on admin client     |
| Auth protected server-side            | **Fail**                  | **Pass** â€” Phase 4 part 2 `proxy.ts`              |
| Admin routes protected                | Partial (email-gated)     | **Pass** â€” role-gated, RLS + UI + proxy           |
| User order isolation                  | Partial (email-keyed)     | **Pass** â€” `user_id`-keyed, RLS on every row      |
| No client-trusted prices              | **Fail**                  | **Pass** â€” Phase 1 RPC                            |
| Webhooks verified                     | Fail (no webhooks)        | N/A â€” COD-only locked in                          |
| Env vars safe                         | Pass                      | Pass                                              |
| No exposed secrets                    | Partial (committed admin) | **Pass** â€” Phase 0 dropped seed + Phase 3 NOTICE  |
| No dangerous file upload              | **Fail**                  | **Pass** â€” Phase 2 MIME + size + UUID filename    |
| Product pages working                 | Partial                   | **Pass** - slug/UUID routes plus real invalid-product 404 |
| Category pages working                | Fail                      | **Pass** â€” `/category/[slug]` server route + sitemap |
| Cart working                          | Partial                   | **Pass** â€” server-authoritative pricing           |
| Checkout working                      | **Fail**                  | **Pass** - Phase 1 RPC + Phase 4 proxy + server totals preview |
| Payment working                       | **Fail**                  | **Pass** for COD; PSP is future scope             |
| Orders working                        | Partial                   | **Pass** â€” Phase 3 detail + transitions + history |
| Admin product CRUD working            | Partial                   | **Pass** â€” Phase 2 part 1 single-image / -category|
| Admin order management working        | Partial                   | **Pass** â€” Phase 3 valid-transition gating        |
| Auth flows working                    | Partial                   | **Pass** â€” forgot/reset + cart-clear + min 8      |
| SEO ready                             | Fail                      | Partial - product/category metadata, real product 404, robots/sitemap |
| Mobile ready                          | Needs manual verification | Partial - 2026-06-18 pass covered navbar, home, checkout, single product, and footer; full device QA still pending |
| Error states ready                    | Fail                      | Partial - product/category notFound paths are real; broader `error.tsx` polish pending |
| Production env vars ready             | Needs manual verification | Use `.env.example` as the checklist               |
