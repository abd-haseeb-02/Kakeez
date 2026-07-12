# Phase 4 — Customers, Accounts & Auth (parts 1 + 2)

**Status:** parts 1 + 2 LIVE (full Phase 4 has a few items deferred to
Phase 5)
**Commits:** [`19b21e8`](https://github.com/abd-haseeb-02/Kakeez/commit/19b21e8) (part 1) + [`9216dfb`](https://github.com/abd-haseeb-02/Kakeez/commit/9216dfb) (part 2)
**Plan reference:** [`ECOMMERCE_CMS_PLAN.md`](../../ECOMMERCE_CMS_PLAN.md) §F Phase 4 + §B.3
**Migrations applied:** `20260617000009_admin_user_rpcs.sql`

Phase 4 ships the customer account area, the password reset loop,
server-side route protection, and the staff/role management UI.

## Done — part 1 (`19b21e8`)

### `/account` customer area

Auth-gated client shell + nested pages (server protection landed in
part 2, see below):

- **`src/app/account/layout.tsx`** — checks the session, loads the
  user's profile name, renders a left nav with active-state
  highlighting, and a sign-out button that **clears the cart** via
  `useCart.clearCart()` before signing out.
- **`src/app/account/page.tsx`** — dashboard with three summary
  cards (recent order count, saved address count, last-order date)
  plus a list of the 3 most recent orders.
- **`src/app/account/orders/page.tsx`** — full order history list
  with status chips (color-coded by state), order-number, line item
  preview, payment status, total.
- **`src/app/account/orders/[id]/page.tsx`** — customer detail view
  with snapshot line items, full money breakdown, delivery address
  snapshot, COD payment status, full status timeline. Subscribes to
  a per-order realtime channel so the customer sees their order
  status change live as the kitchen / rider progresses it.
- **`src/app/account/addresses/page.tsx`** — full CRUD for `addresses`
  rows. Default-shipping toggle enforces single-default-per-user by
  clearing other defaults before promotion. Add / edit modal with
  recipient_name, phone_e164, line1, line2, area, city, postal_code,
  landmark, label.
- **`src/app/account/profile/page.tsx`** — edit full_name and
  phone_e164; separate panel to change password (min 8 chars
  enforced client-side via `auth.updateUser({ password })`).

### Password reset loop

- **`src/app/forgot-password/page.tsx`** — request page. Calls
  `auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })`.
  Always responds with the same "if an account exists..." message
  (no enumeration).
- **`src/app/reset-password/page.tsx`** — lands here after the
  recovery email link. The Supabase SDK consumes the recovery token
  from the URL automatically (`detectSessionInUrl`). Min-8-char
  client check + confirm field. On success, auto-redirects home
  after 2 s. Renders an "Link expired" state if the session check
  comes back empty.

### Auth popup hardening

`src/components/shop/UserAuthPopup.tsx`:

- **Min 8 chars** enforced on sign-up (input `minLength` + a
  defensive guard in the submit handler).
- **"Forgot password?"** link in login mode → `/forgot-password`.
- **Phone-to-profile sync** — Supabase `signUp` only fires the
  `handle_new_user` trigger which copies `full_name` from
  `raw_user_meta_data`. The popup now also issues a follow-up
  `profiles.update` to persist `phone_e164`, AND inserts an
  `addresses` row with `is_default_shipping = true` if the sign-up
  form had a non-empty address. Both are best-effort; failures here
  don't undo the signup.

### Navbar role gate + cart-clear-on-signout

`src/components/shop/Navbar.tsx`:

- Replaced the hard-coded
  `setIsAdmin(session.user.email === "admin@kakeez.com")` with a
  `profiles.role` lookup. Admin AND staff get the admin link.
- `supabase.auth.onAuthStateChange` listener checks for `event ===
  'SIGNED_OUT'` and calls `clearCart()` before re-applying the
  session — closes the "shared-device leak" of the previous
  customer's cart into the next visitor's session.

## Done — part 2 (`9216dfb`)

### `src/proxy.ts` — Next 16 server-side route protection

The Next 16 successor to `middleware.ts` (read
`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`
before editing — the contract is intentionally lightweight per Next's
own guidance).

- Uses `@supabase/ssr`'s `createServerClient` with the request
  cookies; calls `auth.getUser()` (which refreshes the session
  cookie in flight per the supabase/ssr Next.js guide) and gates:
  - `/admin/*` → `/admin/login` if no session (excludes
    `/admin/login` itself so the entry point stays public).
  - `/account/*` → `/` if no session.
  - `/checkout` → `/` if no session.
- Preserves the requested path as a `?next=` query param so a future
  login enhancement can land users back where they intended.
- Matcher excludes `_next/static`, `_next/image`, `favicon.ico`,
  `/assets/`, `/images/` so every CSS / JS / asset request doesn't
  round-trip the auth check.
- Verified via curl: 8 public routes return 200, 9 gated routes
  return 307 with the right redirect targets.

### Admin user / role RPCs (`20260617000009`)

Role changes can't go through plain `UPDATE` — the role column has
a hard `REVOKE UPDATE (role) FROM authenticated` in `0005_rls.sql`.
Three new SECURITY DEFINER RPCs handle the privileged operations:

- **`admin_list_users()`** — `is_admin()`-gated. Joins `profiles`
  with `auth.users` so the staff page can render emails (auth.users
  isn't directly readable from PostgREST as an authenticated user).
  Returns email, role, full_name, phone_e164, cod_trust_level,
  no_show_count, blocked_at, blocked_reason, email_confirmed_at,
  last_sign_in_at, created_at. Ordered admin > staff > customer.
- **`set_profile_role(p_user_id, p_new_role)`** — the only path to
  change a role. Enum-validated (`customer` / `staff` / `admin`).
  **Anti-lockout guard**: refuses to demote the last admin
  (raises `cannot_demote_last_admin`).
- **`admin_set_user_blocked(p_user_id, p_blocked, p_reason)`** —
  per-user side of the COD risk gate. Phase 5's create_order RPC
  will read `profiles.blocked_at` alongside `cod_blocklist`.

### `/admin/staff` Staff & Roles page

`src/app/admin/staff/page.tsx`:

- Searchable user table (email / name / phone search).
- Header counts: `N admin · M staff · K customer`.
- Inline role `<select>` calls `set_profile_role`. Friendly toast
  errors including "There must be at least one admin" on the
  anti-lockout case.
- Block / unblock button with reason prompt; row highlights red
  while blocked. `cod_trust_level` + `no_show_count` shown for COD
  ops context (no-show count rendered as a small amber pill).
- "you" badge on the current user's row so admins don't lock
  themselves out by mistake.

### Admin layout sidebar

`src/app/admin/layout.tsx` adds "Staff & Roles" with the `ShieldCheck`
icon to the menu items list.

## Verified

- `20260617000009_admin_user_rpcs.sql` applied to prod.
- `npm run build` green; output shows `Proxy (Middleware)` registered.
- curl probe: `200` on `/`, `/menu`, `/contact`, `/catering`,
  `/product/cookies-1`, `/forgot-password`, `/reset-password`,
  `/admin/login` (all 8 public routes).
- curl probe: `307` on `/admin`, `/admin/staff`, `/admin/orders`,
  `/admin/products`, `/account`, `/account/orders`,
  `/account/addresses`, `/account/profile`, `/checkout` (all 9
  gated routes). Redirect targets:
  - `/admin/*` → `/admin/login?next=<encoded path>`.
  - `/account/*` → `/?next=<encoded path>`.
  - `/checkout` → `/`.
- Zero runtime console errors.

## Remaining

These were originally scoped under Phase 4 but require external
services or project-level config:

- **Email-only verification** — Phone code verification was removed from
  checkout/signup. Customer phone numbers are kept only as delivery contact
  details.
- **Server-side password policy bump** — needs the Supabase project's
  password_requirements setting bumped from default 6 → 8. That's
  done via the Supabase Dashboard's Auth → Policies (or via the
  Management API), not via migration.
- **Email confirmation flip** — `supabase/config.toml`
  `[auth.email] enable_confirmations` is currently `false`. Flipping
  it is a single line but changes the post-signup UX (users have
  to confirm via email before signing in). Holding for an explicit
  ops decision.
- **`/admin/login` consumes `?next=`** — proxy.ts already preserves
  the original path; the login page doesn't read it yet, so post-
  login the user lands on `/admin` instead of the deep-link they
  came from.
- **Cancel-from-customer button** on `/account/orders/[id]` —
  needs a customer-side cancel RPC that enforces the pre-baking
  grace window (admin can cancel today via `update_order_status`).

## Files touched

### Part 1

| File                                              | Net change |
| ------------------------------------------------- | ---------- |
| `src/app/account/layout.tsx`                      | NEW        |
| `src/app/account/page.tsx`                        | NEW        |
| `src/app/account/orders/page.tsx`                 | NEW        |
| `src/app/account/orders/[id]/page.tsx`            | NEW        |
| `src/app/account/addresses/page.tsx`              | NEW        |
| `src/app/account/profile/page.tsx`                | NEW        |
| `src/app/forgot-password/page.tsx`                | NEW        |
| `src/app/reset-password/page.tsx`                 | NEW        |
| `src/components/shop/UserAuthPopup.tsx`           | hardened   |
| `src/components/shop/Navbar.tsx`                  | role + cart-clear |

### Part 2

| File                                                       | Net change |
| ---------------------------------------------------------- | ---------- |
| `src/proxy.ts`                                             | NEW        |
| `src/app/admin/staff/page.tsx`                             | NEW        |
| `src/app/admin/layout.tsx`                                 | sidebar edit |
| `supabase/migrations/20260617000009_admin_user_rpcs.sql`   | NEW migration |
