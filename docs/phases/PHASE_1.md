# Phase 1 — Secure Core Commerce

**Status:** LIVE
**Commit:** [`07dbef4`](https://github.com/abd-haseeb-02/Kakeez/commit/07dbef4)
**Plan reference:** [`ECOMMERCE_CMS_PLAN.md`](../../ECOMMERCE_CMS_PLAN.md) §F Phase 1 + §G.X.1
**Migration applied:** `20260617000006_create_order_rpc.sql`

Phase 1 closes AUDIT.md §B Critical 1 (client-trusted checkout) and
§B High (non-transactional order creation) — the two findings that
made the storefront not launch-safe.

## Done

### `create_order` RPC — server-authoritative checkout

`supabase/migrations/20260617000006_create_order_rpc.sql` replaces the
Phase-0 `'NOT IMPLEMENTED'` stub with a real body. Key invariants the
RPC enforces (all in one plpgsql block, atomic):

- **Auth gate** — `auth.uid()` must be set. RAISEs `auth_required`
  on `errcode = 28000` if not.
- **COD lock** — `p_payment_method <> 'cod'` is rejected. Defense
  in depth on top of the `orders.payment_method CHECK = 'cod'`
  column constraint.
- **Cart shape sanity** — rejects null / non-array / empty / rows
  missing `productId` or with `quantity <= 0`. Different `errcode`
  per condition so the server action surfaces friendly messages.
- **Re-reads every product + variation from the DB.** The
  client-sent `price` is ignored entirely. `unit_minor =
  products.base_price_minor + COALESCE(variation.price_delta_minor,
  0)`. A user editing `localStorage["kakeez-cart"]` cannot change
  what they're charged.
- **Stock check + decrement** (only when `track_inventory = true`).
  Row-locks the stockable unit with `FOR UPDATE`, decrements
  atomically, writes an `inventory_movements` ledger row with
  `reason = 'order'`. The 88 ETL'd products all have
  `track_inventory = false` so this path is currently a no-op on
  prod — wires up the moment admin flips the flag in Phase 2.
- **Order number** — `'KKZ-' || lpad(nextval('order_number_seq'), 6, '0')`.
  KKZ-000001, KKZ-000002, etc. Human-friendly for WhatsApp
  support.
- **Snapshot fields** on every order item: `product_name_snapshot`,
  `product_sku_snapshot`, `image_storage_path_snapshot` (looked up
  from the featured `product_images` row), `is_perishable_snapshot`,
  `unit_price_minor_snapshot`, `line_total_minor_snapshot`,
  `options_snapshot jsonb`. Re-rendering a 2025 order in 2027
  reads snapshots, never joins live catalog rows.
- **Delivery fee** read from the first active row of
  `delivery_methods` — Phase 5 replaces this with zone-aware lookup
  via `compute_delivery_minor()`.
- **Payment** — inserts a `payments` row with `provider = 'cod'`,
  `method = 'cod'`, `status = 'pending_collection'`.
- **History** — writes the initial `order_status_history` row with
  `to_status = 'pending_confirmation'`, `actor_role = 'customer'`.
- **Grant** — `EXECUTE` granted to `authenticated`. Anon is
  rejected at the PostgREST grant layer (verified: 401 from the
  REST endpoint when called anon-key only).

### Server action wrapping the RPC

`src/app/checkout/actions.ts` (NEW):

- Forwards ONLY `{productId, variationId, qty, customMessage}` from
  the client cart. `name`, `image`, `price` are explicitly
  discarded.
- Sanitizes the cart payload: validates UUIDs, clamps quantity to
  `[1, 99]`, truncates `customMessage` to 200 chars.
- Maps every `errcode` raised by the RPC to a user-friendly message
  (e.g. `out_of_stock` → "Sorry — one of your items just sold
  out. Please remove it and try again.").
- Server-side `auth.getSession()` check before burning the RPC
  call, so unauthenticated submissions return a clean
  `auth_required` instead of a Postgres error.

### Checkout page rewired

`src/app/checkout/page.tsx`:

- `handlePlaceOrder` no longer issues `supabase.from('orders').insert(...)`
  followed by a "warn-and-continue" `order_items.insert(...)` — the
  exact pattern that produced the 1 stale `orders` row with 0
  `order_items` archived in `legacy_orders_archive`. It calls
  `placeOrder(...)` server action.
- Cart structure stayed backward-compatible (see the explainer in
  `src/store/useCart.ts` — the security guarantee lives on the
  server, not in the cart shape).

### Read-side query adapters (storefront unbroken on new schema)

Several pages queried columns the new schema doesn't have. Updated
in this commit:

- **`src/app/page.tsx`** — homepage `eq('category_id', cat.id)` →
  `inner join product_categories` + filter; image derived from
  `product_images` featured row; price derived from
  `base_price_minor / 100`.
- **`src/app/product/[id]/page.tsx`** (later moved to `[slug]` in
  Phase 2) — same join + projection.
- **`src/components/shop/CartDrawer.tsx`** — popular products
  fetch updated.
- **`src/app/checkout/page.tsx`** — popular items panel updated.
- **`src/app/admin/orders/page.tsx`** — uses
  `order_items.product_name_snapshot` instead of joining
  `products(name)`. Status enum updated to the new 9-value set.
- **`src/app/admin/page.tsx` (dashboard)** — projects `total_minor`
  to legacy `total_amount` for the existing render shape; realtime
  payload projected the same way.

## Verified

- `npm run build` green on Next 16.2.9 with TS strict.
- All 14 routes render.
- Homepage accessibility snapshot showed all 88 products under 4
  categories with correct prices (Cookies 1 = Rs. 3925 matches DB
  `base_price_minor = 392500`).
- Anon RPC call to `/rest/v1/rpc/create_order` returns 401
  (`GRANT EXECUTE ... TO authenticated` only) — the defense-in-depth
  `auth_required` check inside the function never fires for anon.

## Remaining

- Customer-side cancel grace window — Phase 3 added admin cancel,
  but customers can't self-cancel via UI yet (the `/account/orders/[id]`
  page in Phase 4 lists state but doesn't expose a cancel button).
- Stock decrement is wired but not exercised — no products have
  `track_inventory = true` until admin flips the flag (Phase 2
  follow-up will surface this in the product editor).
- Apply-promo path — `p_promo_code` is accepted by the RPC and
  ignored; `apply_promo_minor()` lands in Phase 5 alongside the
  coupon redemption flow.
- `compute_delivery_minor` replacing the first-active-row delivery
  fee read — Phase 5 zone-aware logic.
- Server-side `proxy.ts` protection for `/checkout` — added in
  Phase 4 part 2 commit `9216dfb`.
