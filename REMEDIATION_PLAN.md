# Kakeez Remediation Plan

Date: 2026-06-16

This plan turns the audit findings into implementation phases. The order is intentional: first remove launch-blocking security and money-flow risks, then stabilize admin/data quality, then improve SEO, performance, accessibility, and deployment readiness.

## Phase 0: Safety Setup

Goal: create a clean baseline before changing core auth, checkout, and database behavior.

Tasks:
- Create a working branch, for example `codex/remediation-roadmap`.
- Back up the Supabase database before applying migrations.
- Confirm whether the RLS hardening migration has actually been applied to the live Supabase project.
- Rotate the live `admin@kakeez.com` password immediately if that account exists.
- Remove or replace the seeded default admin migration for future environments.
- Add `.env.example` with fake Supabase values.
- Decide which environment is safe for testing order creation: local Supabase, staging, or a disposable project.

Acceptance criteria:
- No known default admin password works anywhere.
- The team has a rollback path for schema changes.
- Local/staging environment is ready for checkout and RLS testing.

## Phase 1: Checkout and Order Security

Goal: stop trusting browser cart data for order totals, prices, discounts, and line items.

Tasks:
- Change the cart store so persisted cart data contains only product ID, quantity, and selected options.
- Add server-side checkout entry point using a Server Action, Route Handler, or Supabase RPC.
- Validate the authenticated user on the server.
- Fetch products from the database by ID during checkout.
- Recalculate subtotal, discount, delivery, and grand total on the server.
- Reject missing, unpublished, deleted, or out-of-stock products.
- Insert `orders` and `order_items` transactionally.
- Store order item snapshots: product name, unit price, quantity, and image at purchase time.
- Make order creation fail if any order item cannot be inserted.
- Add basic duplicate-submit protection by disabling submit and using an idempotency key.

Acceptance criteria:
- Editing localStorage price/quantity cannot change the final server-created order total.
- Failed item insert does not leave an orphan order.
- Checkout shows an error instead of success when validation fails.
- Cart is cleared only after a confirmed successful transaction.

## Phase 2: Database Model and RLS Hardening

Goal: make the database enforce ecommerce rules instead of relying on UI discipline.

Tasks:
- Add `profiles` or `admin_users` table keyed by `auth.users.id`.
- Replace email-based `is_admin()` with a database role lookup by `auth.uid()`.
- Add `user_id` to `orders` and migrate ownership away from `customer_email`.
- Add check constraints:
  - product price must be positive.
  - order total must be non-negative.
  - item quantity must be positive.
  - order status must be one of the allowed values.
- Add indexes:
  - `products(category_id)`.
  - `orders(user_id)`.
  - `orders(created_at)`.
  - `order_items(order_id)`.
- Add product status fields such as `draft`, `published`, `archived`.
- Update public product RLS so only published products are readable by anonymous users.
- Restrict direct client writes to `orders` and `order_items` once server checkout is in place.

Acceptance criteria:
- Non-admin users cannot become admins or write catalog data.
- Public users cannot read draft/archived products.
- Users can read only their own orders.
- Direct browser Supabase calls cannot create arbitrary order totals.

## Phase 3: Server-Side Route Protection

Goal: protect private routes before client JavaScript loads.

Tasks:
- Add a server-side Supabase auth pattern compatible with this Next.js 16 project.
- Add `proxy.ts` or protected server layouts for:
  - `/admin/*`
  - `/checkout`
  - future `/account/*`
- Redirect logged-out users before rendering protected route shells.
- Redirect non-admin users before rendering admin shells.
- Add noindex metadata for admin, checkout, account, and auth-only pages.
- Clear sensitive client state on logout.

Acceptance criteria:
- Logged-out direct navigation to `/admin` never renders admin shell content.
- Non-admin direct navigation to `/admin/products` is blocked server-side.
- Checkout access requires a valid session server-side.
- Browser back after logout does not reveal protected data.

## Phase 4: Admin Reliability and Validation

Goal: make admin CRUD safe, typed, and resilient.

Tasks:
- Move admin product/category/order mutations behind server actions or protected route handlers.
- Add validation schemas for product, category, upload, and order status updates.
- Enforce image upload rules:
  - allowed MIME types: PNG, JPG, WebP.
  - maximum size, for example 5 MB.
  - UUID filenames.
  - explicit content type.
- Prevent category deletion when products exist, or require product reassignment.
- Add order status transition rules.
- Add order status history/audit records.
- Replace customer aggregation from orders with real profiles/customers where appropriate.
- Make settings page either functional or remove/label it clearly as unavailable.

Acceptance criteria:
- Invalid product/category input is rejected server-side.
- Oversized or wrong-type uploads fail before storage write.
- Admin order status changes are validated and auditable.
- Accidental category deletion cannot silently destroy products.

## Phase 5: Lint, Types, and Code Quality

Goal: get CI-quality feedback green before broader feature work.

Tasks:
- Fix all current `npm run lint` errors.
- Replace broad `any` types with Supabase row types or local interfaces.
- Move functions used by effects above the effect or wrap them with `useCallback`.
- Refactor render-time mutation in `src/app/page.tsx`.
- Escape JSX apostrophes.
- Remove unused imports.
- Replace internal `<a>` navigation with `Link`.
- Replace raw `<img>` where practical with `next/image`, or document exceptions.
- Add a CI script that runs build and lint.

Acceptance criteria:
- `npm run lint` passes.
- `npm run build` still passes.
- No new TypeScript strictness regressions are introduced.

## Phase 6: Product, Category, and Catalog Improvements

Goal: make the storefront more ecommerce-native and SEO-friendly.

Tasks:
- Add product slugs and route products as `/products/[slug]`.
- Add category pages as `/category/[slug]` or `/categories/[slug]`.
- Use `notFound()` for invalid product/category slugs.
- Add canonical redirects from old product IDs to slugs if needed.
- Add product publish/archive workflow in admin.
- Add stock display and quantity limits in product and cart UI.
- Add pagination or server-side limits for large product lists.
- Replace homepage N+1 product fetching with a more efficient query.

Acceptance criteria:
- Invalid product/category URLs return real 404 responses.
- Product URLs are readable and stable.
- Draft products never appear publicly.
- Product listing remains fast as catalog size grows.

## Phase 7: Payment, Webhooks, and Notifications

Goal: only expose payment methods that are truly supported.

Tasks:
- Decide whether launch supports cash-on-delivery only or online payments.
- If online payments are not ready, remove card/JazzCash/Easypaisa UI.
- If online payments are required:
  - add payment session creation server-side.
  - add payment records table.
  - verify webhook signatures.
  - make webhooks idempotent.
  - verify paid amount and currency against server-calculated order total.
  - update payment/order status only from verified webhook events.
- Add order confirmation email flow.
- Ensure email failures do not corrupt order creation.

Acceptance criteria:
- Client cannot mark an order paid.
- Refreshing success pages cannot duplicate orders.
- Webhook replay cannot duplicate payment/order side effects.
- Payment UI matches real supported payment methods.

## Phase 8: SEO, Performance, and Accessibility

Goal: prepare the storefront for real users and search engines.

Tasks:
- Add dynamic metadata for products and categories.
- Add `robots.ts` and `sitemap.ts`.
- Add product structured data.
- Add unique image alt text for catalog images.
- Add noindex for private/admin/checkout pages.
- Move public catalog fetching to server components where practical.
- Optimize fonts using `next/font` or local assets.
- Audit mobile layouts, especially absolute `vw` sections.
- Fix clickable `div`s that should be buttons.
- Add modal focus handling and keyboard navigation.
- Run a contrast and keyboard pass on checkout, auth popup, cart drawer, and admin.

Acceptance criteria:
- Product/category pages have unique title and description.
- Sitemap includes only public published routes.
- Admin/private routes are not indexable.
- Core mobile flows are usable.
- Keyboard users can complete login, cart, and checkout.

## Phase 9: Tests and Release Readiness

Goal: protect the work from regressions and make launch repeatable.

Tasks:
- Add unit tests for pricing and checkout validation.
- Add integration tests for order creation failure/success.
- Add RLS tests for:
  - public product read.
  - draft product hidden.
  - own order read.
  - other user's order denied.
  - admin catalog write allowed.
  - non-admin catalog write denied.
- Add E2E tests for:
  - login/logout.
  - add to cart.
  - checkout.
  - admin product create/edit.
  - admin order status update.
- Add deployment checklist for Vercel env vars, domains, preview DB isolation, and build command.
- Run final build, lint, and audit.

Acceptance criteria:
- Build, lint, and tests pass.
- RLS isolation tests pass.
- Preview deploy uses safe/staging environment variables.
- Launch checklist is signed off.

## Suggested Work Order

1. Phase 0: Safety Setup.
2. Phase 1: Checkout and Order Security.
3. Phase 2: Database Model and RLS Hardening.
4. Phase 3: Server-Side Route Protection.
5. Phase 5: Lint, Types, and Code Quality.
6. Phase 4: Admin Reliability and Validation.
7. Phase 6: Product, Category, and Catalog Improvements.
8. Phase 7: Payment, Webhooks, and Notifications.
9. Phase 8: SEO, Performance, and Accessibility.
10. Phase 9: Tests and Release Readiness.

Phase 4 and Phase 5 can overlap after the checkout/database work is stable. Phase 7 can be skipped for initial launch only if the store clearly launches as cash-on-delivery only.

