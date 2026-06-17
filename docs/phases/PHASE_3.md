# Phase 3 — Order Lifecycle Operations + Admin Bootstrap

**Status:** LIVE
**Commit:** [`107de8b`](https://github.com/abd-haseeb-02/Kakeez/commit/107de8b)
**Plan reference:** [`ECOMMERCE_CMS_PLAN.md`](../../ECOMMERCE_CMS_PLAN.md) §F Phase 3 + §B.2 + §G.X.2–7
**Migrations applied:** `20260617000007_bootstrap_admin.sql`, `20260617000008_order_status_rpcs.sql`

Phase 3 makes the order lifecycle managable end-to-end and ships a
clean way to create the first admin without committing credentials.

## Done

### Admin bootstrap (`20260617000007_bootstrap_admin.sql`)

Closes the chicken-and-egg from Phase 0+1+2 — the schema rebuild
deleted the legacy seeded admin, but no admin meant every new
admin-write path was RLS-blocked.

- **Generates a random 24-char password at migration runtime** via
  `translate(encode(extensions.gen_random_bytes(18), 'base64'),
  '+/=', 'xyz')` — different every push, nothing committed.
- Inserts `admin@kakeez.com` into `auth.users` with the bcrypted
  password.
- `handle_new_user()` trigger from `20260617000002` fires and
  creates the corresponding `profiles` row with `role='customer'`;
  a `DO` block then elevates it to `role='admin'`.
- `RAISE NOTICE` prints the generated password to the CLI log so
  the operator captures it once (the log lives in `tmp/` which is
  gitignored).
- **Idempotent** — if `admin@kakeez.com` already exists in
  `auth.users`, the migration just elevates the profile row without
  touching the password.
- Verified live: sign-in as `admin@kakeez.com` succeeds, PostgREST
  returns `profile.role = 'admin'`.

### `update_order_status` RPC (`20260617000008`)

Replaces the Phase-0 `'NOT IMPLEMENTED'` stub.

- **`order_status_transitions` reference table** (data, not code)
  with 15 allowed `(from, to)` pairs covering the full §G.X.3
  state machine: pending_confirmation → confirmed → preparing →
  ready_for_dispatch → out_for_delivery → {delivered, failed_delivery,
  disputed}; failed_delivery → {out_for_delivery, cancelled};
  disputed → {delivered, cancelled}; cancellations from every
  pre-dispatch state.
- **`update_order_status(order_id, to_status, reason)`**:
  - Auth + `is_staff()` role gate.
  - Row-locks the order for serialized concurrent transitions.
  - Validates the target via `EXISTS` on `order_status_transitions`
    — illegal jumps like cancelled→delivered are rejected at the
    DB layer, not just the UI.
  - Writes `order_status_history` (`from_status`, `to_status`,
    `reason`, `actor_id`, `actor_role`).
  - On `cancelled`: voids `payments` (sets to `voided`), updates
    `orders.payment_status = voided`, writes a zero-amount
    `pre_collection_cancel` row in `refunds` for audit-shape
    consistency. Restocks **non-perishable** items by reading the
    original decrement out of `inventory_movements` and inserting a
    `cancellation` reason row — perishables (cakes, pastries) are
    waste-logged, not restocked (§G.X.5).
  - On `delivered`: flips `payments.status = collected` (with
    `collected_amount_minor`, `collected_by`, `collected_at`) and
    `orders.payment_status = paid` (§G.X.2 — method-agnostic
    payment status convention).
  - Returns the updated `orders` row.
- `EXECUTE` granted to `authenticated`. RLS still gates non-staff
  via the `staff_required` raise inside the function.

### `/admin/orders/[id]` order detail page

`src/app/admin/orders/[id]/page.tsx` (NEW, ~395 lines):

- Renders customer + delivery address snapshot, line items with
  hero image / variation label / perishable + custom badges, money
  breakdown including discount and tax (zero today), `payments`
  record with collection details when delivered.
- **Status transitions are buttons, not a dropdown** — generated
  from the `order_status_transitions` table for the order's current
  status. Admins literally cannot pick an invalid next state.
- Calls `update_order_status` RPC, surfaces friendly errors via
  the global toast.
- Per-order realtime channel keeps the page in sync if another
  admin tab moves the same order.
- Restock notice on cancelled orders that had non-perishables.

### Global toast provider

`src/components/ui/Toast.tsx` (NEW) — replaces the bespoke
top-right banner that used to live only on the dashboard.

- `ToastProvider` mounts at the admin layout root.
- `useToast()` exposed via React context with a safe no-op fallback
  for non-admin pages.
- Three variants: `info`, `success`, `warn` — with Bell / CheckCircle
  / AlertTriangle icons and matching color palette.
- Stackable, auto-dismissing after 6 s by default, dismiss button on
  each.
- Glass effect + brown / amber / emerald tones matched to the admin
  dark theme.

### Orders list page upgraded

`src/app/admin/orders/page.tsx`:

- **Subscribes to realtime INSERT + UPDATE** (was unsubscribed
  before — only the dashboard had realtime).
- Toasts on new orders ("New order KKZ-000123 — Rs. 4,500 — Maham
  Khan") and on every status change.
- Row click navigates to the new detail page; the inline status
  dropdown stops event propagation so admins can still triage from
  the list.
- Status mutations now call `update_order_status` RPC (was a direct
  `UPDATE` that would have failed silently against the post-Phase-0
  REVOKE).
- Status enum updated to match the new 9-value set; the icon
  switch handles every state.
- Money column uses `formatPkr(total_minor)`.

### Admin layout role-based gate

`src/app/admin/layout.tsx` — replaced the hard-coded
`session.user.email === "admin@kakeez.com"` check with a
`profiles.role` lookup. Admin AND staff pass the shell gate; the
per-page RLS still does its thing.

## Verified

- Both migrations applied to prod via `npx supabase db push --include-all
  --linked`.
- `npm run build` green; new dynamic route `/admin/orders/[id]`
  registered.
- `/admin`, `/admin/orders`, `/admin/orders/[id]`, `/` all return
  200 in dev.
- Zero runtime console errors.
- Sign-in as `admin@kakeez.com` works end-to-end.

## Remaining (Phase 3 part 2 / merged into Phase 4)

- **Customer-side cancel grace window RPC** — admins can cancel via
  the existing RPC today; customers need their own gated path that
  respects the pre-baking grace window. The `/account/orders/[id]`
  page from Phase 4 displays state but doesn't expose a cancel
  button yet.
- **Rider `mark_outcome` RPC** per §G.X.3 — delivered / refused /
  not-home / cash_short / counterfeit / overpayment. Needs a
  rider role + an auth flow that doesn't exist yet (rider role
  isn't enumerated in the `profiles.role` CHECK either — would
  need a small ALTER TYPE).
- **Low-stock dashboard widget + stock adjustment UI** — schema
  (`inventory_movements`, `products.track_inventory`,
  `products.low_stock_threshold`) is ready. No admin UI exposes
  the flag yet.
- **Cash reconciliation view** per §G.X.7 — `cash_drops` and
  `cash_disputes` tables exist; no admin UI lets ops record drops
  or view the daily variance.

## Files touched

| File                                            | Lines  | Net change |
| ----------------------------------------------- | ------ | ---------- |
| `supabase/migrations/20260617000007_bootstrap_admin.sql` |  78 | NEW migration |
| `supabase/migrations/20260617000008_order_status_rpcs.sql` | 189 | NEW migration |
| `src/components/ui/Toast.tsx`                   |  104  | NEW        |
| `src/app/admin/orders/[id]/page.tsx`            |  395  | NEW        |
| `src/app/admin/orders/page.tsx`                 |   83  | edit       |
| `src/app/admin/page.tsx`                        |   35  | edit       |
| `src/app/admin/layout.tsx`                      |   22  | edit       |
