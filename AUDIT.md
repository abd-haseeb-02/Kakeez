# Kakeez Ecommerce Audit Report

Date: 2026-06-16
Scope: Next.js 16 App Router storefront/admin, Supabase schema/RLS/storage, Zustand cart, auth, checkout, SEO, deployment readiness.

## A. Executive Summary

Overall health score: 5/10.

The app is visually built out and the production Next build succeeds, but it is not launch-ready for ecommerce. The biggest blocker is that checkout writes orders directly from client-side Zustand state using the browser Supabase anon client. RLS limits who can insert, but prices, discounts, quantities, and totals remain client-trusted. A customer can alter local storage or browser JS and create a discounted or inconsistent order.

What is working well:
- App Router only; no mixed Pages Router.
- Public `.env.local` values are not tracked by git.
- RLS hardening migration exists for products, categories, orders, order_items, and product storage.
- Product/category/order admin screens exist.
- `next build` passes on Next 16.2.9.

Must fix before launch:
- Move order creation and order item creation to a server-side checkout path that recalculates price, stock, discount, and delivery from database state.
- Remove the seeded `admin@kakeez.com` / `admin` credential and replace hard-coded email admin checks with a real admin role model.
- Fix lint failures; `npm run lint` currently exits with 32 errors.
- Add server-side route protection/proxy for admin and checkout, not just client redirects.
- Add real payment/webhook integration or make the UI clear that only cash-on-delivery is supported.

## B. Critical Issues

### Client-trusted checkout totals and item prices

Severity: Critical

Files:
- `src/app/checkout/page.tsx:62`
- `src/app/checkout/page.tsx:87`
- `src/app/checkout/page.tsx:105`
- `src/store/useCart.ts:23`

What is wrong: checkout calculates `subtotal`, promo discount, delivery, and `grandTotal` from persisted Zustand cart state, then inserts `orders.total_amount` and `order_items.unit_price` directly from the browser. The cart store persists product `price` and `quantity` in localStorage under `kakeez-cart`.

Why it matters: users can modify localStorage/devtools and create orders with arbitrary totals, stale prices, impossible quantities, deleted products, or fake discounts.

How to reproduce: add a product, edit `localStorage["kakeez-cart"]` to set `price` to `1` or `quantity` to a large/negative value, then place the order. The order insert uses that manipulated value.

Recommended fix: create a server action or route handler for checkout. Accept only product IDs, quantities, selected options, address, and promo code. On the server, fetch products by ID, validate stock/status, compute integer-cent totals, insert order and items in a transaction/RPC, and return the order ID. Do not accept `unit_price` or `total_amount` from the client.

Example:

```ts
// app/checkout/actions.ts
"use server"

export async function createOrder(input: {
  items: { productId: string; quantity: number }[]
  promoCode?: string
  address: string
}) {
  // validate session server-side
  // fetch products by ids
  // reject missing/unpublished/out-of-stock products
  // compute prices/discount/delivery on the server
  // insert order + order_items in a transaction/RPC
}
```

### Default admin credential is committed and seeded

Severity: Critical

File: `supabase/migrations/20260615000001_seed_admin.sql:25`

What is wrong: the migration creates `admin@kakeez.com` with password `admin`.

Why it matters: this is a known admin credential in git history. If this migration has run in any shared, preview, or production database and the password was not rotated, admin access is compromised.

How to reproduce: attempt Supabase email/password login with `admin@kakeez.com` / `admin`.

Recommended fix: delete the seed-user migration for future environments, rotate the live admin password, and create admins through Supabase dashboard or a protected server-only admin bootstrap script. Treat any database where this was used as exposed until rotated.

### Admin authorization is hard-coded to an email address

Severity: Critical

Files:
- `src/app/admin/layout.tsx:30`
- `src/components/shop/Navbar.tsx:26`
- `supabase/migrations/20260616000000_enable_rls_security.sql:24`

What is wrong: both UI and RLS define admin as `auth.jwt()->>'email' IN ('admin@kakeez.com')`.

Why it matters: role management cannot be audited, delegated, revoked cleanly, or protected with least privilege. It also couples production authorization to one email string across client code and SQL.

How to reproduce: search for `admin@kakeez.com`; admin checks are duplicated in client and database policy.

Recommended fix: add `admin_users` or `profiles.role` with strict RLS so only existing admins/service role can assign roles. In RLS, use an `is_admin()` function that checks the table by `auth.uid()`, not mutable email identity.

## C. High Priority Issues

### Protected routes are only client-protected

Severity: High

Files:
- `src/app/admin/layout.tsx:28`
- `src/app/checkout/page.tsx:40`
- build output: `/admin`, `/admin/orders`, `/admin/products`, `/checkout` are static shells.

What is wrong: admin and checkout protection happens in `useEffect()` after client JS loads. There is no Next proxy/middleware or server component check.

Why it matters: unauthorized users can fetch the route shell and rely entirely on RLS to block data. That is better than no RLS, but it is fragile and creates flicker, SEO leakage, and no centralized access policy.

Recommended fix: add `proxy.ts` or server-side layout checks per the local Next 16 auth docs. Use Supabase SSR cookie helpers or a server-side auth pattern. Keep RLS as the database backstop.

### Order creation is not transactional

Severity: High

File: `src/app/checkout/page.tsx:87`

What is wrong: the app inserts `orders`, then inserts `order_items`. If item insertion fails, it only logs a warning and still clears the cart and shows success.

Why it matters: admins can receive paid/confirmed orders with no line items or incomplete line items.

How to reproduce: create a cart with only placeholder/non-UUID IDs or force `order_items` insert failure; the page still reaches success.

Recommended fix: order creation and items insertion must be one database transaction/RPC. If any item fails, roll back the order and show an error.

### RLS allows users to insert arbitrary order totals for their own email

Severity: High

File: `supabase/migrations/20260616000000_enable_rls_security.sql:92`

What is wrong: `orders_insert_own` checks only that `customer_email` matches the JWT email. It does not constrain status, total, or other business fields.

Why it matters: RLS protects ownership, not business integrity. Any signed-in user can insert a pending order for themselves with arbitrary total if they can call Supabase.

Recommended fix: revoke direct client inserts into `orders` and `order_items`; perform order writes through a security-definer RPC or server route that validates and computes fields. If direct inserts remain, add restrictive `WITH CHECK` constraints for allowed status and generated totals, but server-side checkout is still required.

### Product image upload lacks real validation

Severity: High

File: `src/app/admin/products/page.tsx:55`

What is wrong: the UI says images are PNG/JPG/WebP up to 5MB, but code accepts `image/*` and uploads the selected file without checking size, MIME, extension allowlist, dimensions, or path collision.

Why it matters: an admin or compromised admin account can upload oversized or unexpected files into a public bucket. This can create storage abuse, broken pages, or content-type risks.

Recommended fix: enforce MIME and size checks client-side and server/storage-side. Use UUID filenames, normalize extensions, set `contentType`, and reject files over the configured limit.

### Lint fails

Severity: High

Command: `npm run lint`

Result: 32 errors, 14 warnings.

Examples:
- `src/app/admin/page.tsx:26` function accessed before declaration under React hooks immutability rule.
- `src/app/page.tsx:100` render-time reassignment of `currentTop`.
- Many `@typescript-eslint/no-explicit-any` errors.
- `src/components/shop/SimplePage.tsx:17` uses `<a>` for internal navigation.

Why it matters: CI should block on lint for a launch candidate. Several warnings also point to accessibility/performance issues.

Recommended fix: type Supabase rows, move functions above effects or wrap in `useCallback`, avoid render mutation, escape JSX apostrophes, remove unused imports, and replace internal `<a>` with `Link`.

## D. Medium Priority Issues

### No product slug route or SEO-friendly product URLs

Severity: Medium

File: `src/app/product/[id]/page.tsx:36`

What is wrong: products are routed by UUID-like ID only. The product table has no product slug field.

Why it matters: ecommerce product URLs should be readable, stable, canonical, and redirectable after name changes.

Recommended fix: add unique `products.slug`, route as `/products/[slug]`, keep old slug redirects if needed, and preserve ID internally.

### Invalid product URLs do not call `notFound()`

Severity: Medium

File: `src/app/product/[id]/page.tsx:102`

What is wrong: missing products render a normal component saying “Product not found” rather than using Next `notFound()`.

Why it matters: fake/deleted product pages should return a real 404 and avoid indexable soft-404 pages.

Recommended fix: convert the product page to server-first fetching where possible and call `notFound()` for invalid IDs/slugs.

### No published/draft model

Severity: Medium

Files:
- `supabase/migrations/20260615000000_initial_schema.sql:13`
- `supabase/migrations/20260616000000_enable_rls_security.sql:66`

What is wrong: `products_select_all` exposes all products, and the schema has no `status`/`published_at` field.

Why it matters: drafts, archived products, deleted products, and out-of-season products cannot be hidden from public users.

Recommended fix: add `status text check (status in (...))`, use public RLS `status = 'published'`, and let admins see all statuses.

### No stock enforcement

Severity: Medium

Files:
- `supabase/migrations/20260615000000_initial_schema.sql:22`
- `src/app/product/[id]/page.tsx:204`
- `src/store/useCart.ts:45`

What is wrong: `stock_quantity` exists but quantity increment is unlimited and checkout does not validate stock.

Why it matters: users can order unavailable quantities.

Recommended fix: validate stock server-side during checkout, show stock state in UI, cap quantity controls, and reserve/decrement stock transactionally.

### Category deletion cascades to products

Severity: Medium

Files:
- `supabase/migrations/20260615000003_fix_cascade.sql:3`
- `src/app/admin/products/page.tsx:178`

What is wrong: deleting a category permanently deletes all products in it.

Why it matters: accidental category cleanup can destroy live catalog data and break existing order references/product pages.

Recommended fix: prefer soft delete/archive categories, restrict deletion if products exist, or require explicit product reassignment.

### No payment/webhook backend despite card UI

Severity: Medium

File: `src/app/checkout/page.tsx:31`

What is wrong: the checkout UI lets users choose `card`, but no payment provider, payment session route, webhook verification, idempotency, or payment status model exists.

Why it matters: users can believe they selected card payment, but all orders are created as `pending` with no payment record.

Recommended fix: remove card UI until integrated, or add provider-backed session creation and verified webhook as payment source of truth.

### Schema lacks ecommerce constraints and indexes

Severity: Medium

File: `supabase/migrations/20260615000000_initial_schema.sql:5`

Issues:
- No `orders.user_id`; ownership is email-based.
- No check constraints for positive prices/quantities.
- No status check constraint for orders.
- No indexes on `products.category_id`, `orders.customer_email`, `orders.created_at`, or `order_items.order_id`.
- `order_items.product_id` is nullable because the FK column is not `NOT NULL`.
- No address, phone, payment, coupon, shipping, variant, inventory ledger, or order status history tables.

Recommended fix: add constraints and indexes, move ownership to `auth.users.id`, and use snapshot fields for all order item display data.

## E. Low Priority Issues

### SEO is mostly static

Severity: Low

File: `src/app/layout.tsx:4`

What is wrong: there is only global metadata. Product/category metadata, canonical URLs, robots, sitemap, product structured data, and noindex for admin/cart/checkout are missing.

Recommended fix: implement `generateMetadata`, `robots.ts`, `sitemap.ts`, product JSON-LD, and `noindex` metadata for private/admin/checkout pages.

### Images bypass optimization in multiple admin/product card views

Severity: Low

Files:
- `src/components/shop/ProductCard.tsx:52`
- `src/app/admin/products/page.tsx:287`
- `src/app/admin/products/page.tsx:384`

What is wrong: raw `<img>` is used instead of `next/image`; one preview image has no `alt`.

Recommended fix: use `Image` where layout allows; add alt text or empty alt for decorative previews.

### Custom fonts are loaded manually in `<head>`

Severity: Low

File: `src/app/layout.tsx:16`

What is wrong: lint warns that custom font loading in page/head style is discouraged.

Recommended fix: use `next/font/google` or local font assets for stable performance and fewer render-blocking requests.

## F. Architecture Recommendations

Suggested folder structure:

```txt
src/
  app/
    (storefront)/
    (auth)/
    admin/
    api/
  components/
    storefront/
    admin/
    ui/
  lib/
    supabase/
      browser.ts
      server.ts
      admin.ts
    ecommerce/
      pricing.ts
      checkout.ts
      validation.ts
  server/
    actions/
    queries/
  store/
    cart.ts
  types/
    database.ts
```

Supabase client pattern:
- `browser.ts`: anon browser client for public reads and user auth only.
- `server.ts`: cookie/session-aware server client for route protection and user-owned reads.
- `admin.ts`: service-role client, server-only, never imported by client components.

Route protection pattern:
- Use Next 16 `proxy.ts` or server layouts for `/admin/*`, `/checkout`, and future `/account/*`.
- RLS remains mandatory as a second layer.

State management pattern:
- Zustand may keep UI state and cart drafts.
- Persist only product ID, quantity, and options. Do not persist or trust price, role, payment status, discount, or inventory.
- Clear cart on logout and revalidate/merge cart on login.

Checkout/order architecture:
- Client submits draft cart.
- Server validates session/address/promo.
- Server fetches products and computes total.
- Database transaction inserts order and order_items, snapshots product name and unit price.
- Payment session is created only after server-calculated amount.
- Webhook verifies payment, is idempotent, and updates order/payment status.

## G. Security Checklist

| Item | Status | Notes |
|---|---:|---|
| RLS enabled | Pass | Migration enables RLS for four public tables. Needs manual verification against live Supabase. |
| Service role safe | Pass | No service role key found in code. |
| Auth protected server-side | Fail | Admin/checkout checks are client-side. |
| Admin routes protected | Partial | RLS backs data writes/reads, but routes are client-gated and role is hard-coded email. |
| User order isolation | Partial | RLS isolates by email, but no `user_id` ownership. |
| No client-trusted prices | Fail | Checkout trusts Zustand prices/totals. |
| Webhooks verified | Fail | No payment webhook exists. |
| Env vars safe | Pass | `.env.local` is ignored/untracked; only public Supabase URL/anon key present. |
| No exposed secrets | Partial | No service secrets found, but default admin password is committed. |
| No dangerous file upload | Fail | Product upload lacks validation. |

## H. Ecommerce Launch Checklist

| Item | Status | Notes |
|---|---:|---|
| Product pages working | Partial | ID route works; no slug/404/metadata/status model. |
| Category pages working | Fail | No `/category/[slug]` pages; homepage sections only. |
| Cart working | Partial | Basic persisted cart works; stale/tampered data not handled. |
| Checkout working | Fail | Client-trusted and non-transactional. |
| Payment working | Fail | No payment integration/webhook. |
| Orders working | Partial | Orders can be inserted and viewed, but integrity is weak. |
| Admin product CRUD working | Partial | CRUD exists; validation/upload/revalidation gaps. |
| Admin order management working | Partial | Status updates exist; no transition rules/audit history. |
| Auth flows working | Partial | Login/signup/logout exist; no reset/verify/account flows. |
| SEO ready | Fail | Missing dynamic metadata/sitemap/robots/structured data. |
| Mobile ready | Needs manual verification | Heavy `vw` absolute layout needs viewport testing. |
| Error states ready | Fail | No `error.tsx`, `not-found.tsx`, or consistent API/form error handling. |
| Production env vars ready | Needs manual verification | Local env exists; Vercel env cannot be verified from repo. |

## Route Inventory

| Route | File | Access | Data | Rendering | Status |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Public | Client Supabase categories/products | Static shell + client fetch | Needs performance/SEO refactor |
| `/menu` | `src/app/menu/page.tsx` | Public | Static | Static | Basic |
| `/contact` | `src/app/contact/page.tsx` | Public | Static | Static | Basic |
| `/catering` | `src/app/catering/page.tsx` | Public | Static | Static | Basic |
| `/product/[id]` | `src/app/product/[id]/page.tsx` | Public | Client Supabase product | Dynamic route | Needs slug/404/metadata |
| `/checkout` | `src/app/checkout/page.tsx` | Auth required | Client Supabase/orders | Static shell + client auth | Risky |
| `/admin/login` | `src/app/admin/login/page.tsx` | Public | Supabase Auth | Static shell | Basic |
| `/admin` | `src/app/admin/page.tsx` | Admin | Client Supabase orders/products | Static shell + client auth | Risky |
| `/admin/products` | `src/app/admin/products/page.tsx` | Admin | Client Supabase/storage | Static shell + client auth | Risky |
| `/admin/orders` | `src/app/admin/orders/page.tsx` | Admin | Client Supabase orders | Static shell + client auth | Risky |
| `/admin/customers` | `src/app/admin/customers/page.tsx` | Admin | Client Supabase orders aggregation | Static shell + client auth | Risky |
| `/admin/settings` | `src/app/admin/settings/page.tsx` | Admin | Static stub | Static shell + client auth | Incomplete |

## Environment Variable Map

| Variable | Public/private | Used in | Status |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `src/lib/supabase.ts:3` | OK to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | `src/lib/supabase.ts:4` | OK to expose if RLS is correct |
| `OPENAI_API_KEY` | Private | `supabase/config.toml` placeholder | Local config placeholder only |
| `S3_SECRET_KEY` | Private | `supabase/config.toml` placeholder | Local config placeholder only |
| `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN` | Private | `supabase/config.toml` placeholder | Local config placeholder only |

`.env.local` is ignored and not tracked by git. No `.env.example` exists; add one with fake values.

## Dependency and Package Audit

Package manager: npm (`package-lock.json` only).

Notable versions:
- Next.js 16.2.9
- React 19.2.4
- Supabase JS 2.108.2
- Zustand 5.0.14
- Tailwind CSS 4

`npm audit --omit=dev --json`:
- 2 moderate vulnerabilities: PostCSS advisory via Next's bundled dependency. `npm audit` suggests an invalid downgrade path, so do not apply blindly. Monitor/upgrade Next when a patched compatible release is available.

`npm outdated --json`:
- Patch/minor updates available for `react`, `react-dom`, `lucide-react`.
- Major updates available for `eslint`, `typescript`, and `@types/node`; defer majors until planned.

Packages to consider removing:
- `dotenv` is not used by app code; Next loads `.env*` automatically.
- `clsx` and `tailwind-merge` were not observed in `src`; remove if unused.

## Supabase Database and RLS Report

Tables present:
- `categories`: has `id`, `name`, unique `slug`, `created_at`.
- `products`: has `id`, `name`, `description`, `price`, `image_url`, `category_id`, `is_best_seller`, `is_upsell`, `stock_quantity`, `created_at`.
- `orders`: has `id`, `customer_name`, `customer_email`, `total_amount`, `status`, `created_at`.
- `order_items`: has `id`, `order_id`, `product_id`, `quantity`, `unit_price`.

RLS:
- Public read on categories/products.
- Admin-only writes on categories/products.
- Authenticated users can select/insert orders for matching email.
- Admin can update/delete orders.
- Order items tied to parent order email.

Risk summary:
- RLS is a good improvement over open tables.
- It does not enforce checkout business correctness.
- Admin role should not be hard-coded email.
- Ownership should be `user_id uuid references auth.users(id)` rather than email.
- Live Supabase policies still need dashboard/SQL verification; repo migration presence is not proof of production state.

## Data Fetching and Caching

Current pattern: almost all data is fetched from client components with `@supabase/supabase-js` browser client.

Risks:
- Public product/category pages miss server rendering/SEO opportunities.
- Admin/customer/order data depends on client auth and RLS.
- Homepage performs N+1 product queries, one per category.
- No explicit no-store/dynamic policy for account/admin data.
- Product updates do not use Next revalidation because pages are client-fetched.

Recommended fix: server-render public catalog pages, use joined/paginated queries, and move admin/account data reads behind server-side auth checks.

## Auth and Session Flow

Implemented:
- Email/password login/signup through Supabase Auth.
- Logout in navbar/admin layout.
- Checkout redirects guests to `/`.

Missing:
- Forgot password.
- Reset password.
- Email verification flow UX.
- Account profile/order history pages.
- Server-side session refresh/proxy.
- Logout clearing persisted cart.
- Multi-tab/session expiry handling.

## Zustand Store Audit

Store: `src/store/useCart.ts`.

State fields: `items` with `id`, `name`, `price`, `quantity`, `image`, `description`.

Persistence: `persist` to localStorage as `kakeez-cart`.

Risk:
- Persists server-trusted fields (`price`, possibly stale product metadata).
- No versioning/migration.
- No cross-tab sync logic.
- `updateQuantity` accepts arbitrary quantity.
- Cart is not revalidated before checkout.

Recommendation: persist only product ID, quantity, and selected options; fetch live price/stock server-side at checkout and optionally refresh cart display on load.

## Admin CRUD Reliability

Products:
- Create/edit/delete exists.
- No server validation.
- No image size/type validation.
- No cache revalidation needed currently because storefront is client-fetched, but this should change with server-rendered catalog.

Orders:
- Admin can update status directly.
- No valid transition rules.
- No audit trail.
- No shipping/payment status separation.

Customers:
- Derived from orders, not actual profiles/users.
- Works for basic display but cannot manage user accounts.

Settings:
- Stub/non-functional.

## SEO, Performance, Accessibility

SEO gaps:
- No dynamic metadata for products/categories.
- No sitemap/robots.
- Admin/checkout not marked noindex.
- No product structured data.
- No canonical URLs.

Performance gaps:
- Many full-page client components.
- Homepage fetches categories then products per category.
- Raw `<img>` in places.
- Heavy absolute `vw` layout may cause mobile problems.

Accessibility gaps:
- Several clickable `div`s instead of buttons.
- Modal focus trapping is missing.
- Some image alt text is missing/decorative inconsistently.
- Needs keyboard navigation and color contrast pass.

## Verification Performed

Commands run:

```bash
npm run build
npm run lint
npm audit --omit=dev --json
npm outdated --json
git ls-files .env .env.local '.env*'
git log --all -G"SUPABASE|NEXT_PUBLIC_SUPABASE|service_role|sk_|pk_|admin@kakeez|crypt\\('admin'" --oneline -- . ':!node_modules' ':!.next'
```

Results:
- `npm run build`: passed.
- `npm run lint`: failed with 32 errors and 14 warnings.
- `npm audit --omit=dev`: 2 moderate advisories.
- `.env.local`: not tracked.
- Git history includes the admin seed credential migration.

