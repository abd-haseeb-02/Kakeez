# Kakeez → Full-Featured E-Commerce CMS — Master Plan

**Date:** 2026-06-17  **Version:** v2 (post user-decisions + full live-CLI audit)
**Status:** PLAN ONLY — for review and approval. No implementation or code changes are included.
**Target:** Evolve the current Next.js 16 + Supabase storefront scaffold into a WooCommerce-depth e-commerce CMS, scoped sensibly to a bakery/local-delivery business.
**Project under review:** `C:\Users\MSI\Documents\Kakeez` (Next.js `16.2.9`, React `19.2.4`, Tailwind v4, Supabase JS `2.108.2`, Zustand 5, npm).
**Live Supabase project:** `kakeez-bakeshop` (`ref: crzqqvbvaguttrkzvpqh`, ACTIVE_HEALTHY, Postgres 17, region `us-east-1`).

> **How this relates to the existing docs.** The repo already contains `AUDIT.md` and `REMEDIATION_PLAN.md` (dated 2026-06-16). Those are a focused **security / launch-readiness** review of the *current* store. This document **supersedes and extends** them: it folds in their critical findings as Phase 0/1 prerequisites, then lays out the much larger **feature-and-architecture roadmap** to reach WooCommerce parity. Where the two overlap (client-trusted checkout, hard-coded admin, RLS), this plan treats those as non-negotiable foundations, not optional.

---

## 0. v2 Changelog — What Changed Since v1

v1 (earlier today) ended with an "open questions" list. v2 closes three of them, replaces guesses with verified live-DB facts, and replaces the placeholder Phase 0 with a fully-specified clean schema rebuild.

### 0.1 Decisions locked in by the project owner

| Decision | Locked-in answer | Impact on the plan |
|---|---|---|
| **Variations engine** | YES — Kakeez sells custom cakes; full variation engine required (size / flavor / shape / tiers / dietary). | The variations engine is now a Phase 2 core deliverable, not an "if needed" option. Detailed spec lives in **[§B.1.X](#b1x-variations-engine-cake-specific-locked-in-scope)**. A complementary bespoke-quote flow handles the rest — see **[§B.1.Y](#b1y-custom-cake-orderquote-flow)**. |
| **Payments** | **COD-only at launch.** No PSP integration. | Card / JazzCash / Easypaisa UI is **removed from code** in Phase 0 (not just disabled). The schema is shaped so adding a PSP later is additive, not breaking. COD operations (rider outcomes, cash reconciliation, fraud guards) are first-class — see **[§G.X](#gx-cod-only-operations-locked-in-scope-at-launch)**. |
| **Schema rebuild** | ALLOWED — clean rewrite OK, 88 live products must be preserved. | Phase 0 is rewritten as a **drop-and-recreate with ETL** rather than additive `ALTER` migrations. Detailed step sequence in **[§F.0](#f0-phase-0-revised--clean-schema-rebuild-with-etl-of-88-live-products)**. |

### 0.2 Live CLI audit completed

The Supabase CLI is wired up (`npx supabase`, v2.106.0, logged in). The project is now linked (`supabase link --project-ref crzqqvbvaguttrkzvpqh`). What the live database actually contains, as of 2026-06-17:

| Table | Row count | Notes |
|---|---:|---|
| `public.products` | **88** | Real catalog data — must be ETL-preserved with UUIDs intact (storage paths depend on them). |
| `public.categories` | 4 | Preserve UUIDs. |
| `public.orders` | **1** | Stale test order. **Critically: `order_items` for this order = 0 rows** → live proof that the non-transactional checkout bug from `AUDIT.md` already manifested in production. Archive, don't drop. |
| `public.order_items` | 0 | (Same finding as above.) |
| `public.profiles` | **1** | **NOT in any repo migration** — schema drift. Created out-of-band in Studio. |

**Migration drift:** the remote ledger shows a sixth migration `20260619000000` that does not exist in the local repo. Inspection shows it `DROP`s a previously-attempted WooCommerce-style schema; the unmanaged `profiles` table came from a *separate* manual change in Studio. Phase 0 step (b) reconciles both before any rebuild.

**Index/perf telemetry from live DB:** only PK + `categories.slug` unique exist. `products` table bloat ratio = **1.8×** (high churn even at 88 rows). `orders_pkey` shows 0 index scans (only seq scans — fine at 1 row, broken at scale). Cache hit rate 1.00 (trivial at 11 MB total DB size). FK indexes (per Part D) are non-optional once the rebuild lands.

### 0.3 Open questions still standing

Q3 (email provider), Q4 (delivery zones), Q5 (tax rate), Q6 (review moderation), Q7 (digital/virtual scope), Q8 (i18n), Q10 (staff role timing) — see [Appendix](#appendix--open-questions). None block Phase 0.

---

## Table of Contents

0. [v2 Changelog — What Changed Since v1](#0-v2-changelog--what-changed-since-v1)
1. [Executive Summary](#1-executive-summary)
2. [Scope, Assumptions & Decisions — status](#2-scope-assumptions--decisions-needed)
3. [Part A — Codebase Audit](#part-a--codebase-audit)
   - [A.1 Next.js Frontend Audit](#a1-nextjs-frontend-audit)
   - [A.2 Supabase Backend Audit (live CLI findings)](#a2-supabase-backend-audit)
   - [A.3 Foundational Refactors](#a3-foundational-refactors-must-precede-feature-work)
4. [Part B — Target Feature Set (WooCommerce parity)](#part-b--target-feature-set-woocommerce-parity)
   - [B.1 Product Management](#b1-product-management)
   - **[B.1.X Variations Engine — cake-specific spec (locked-in)](#b1x-variations-engine-cake-specific-locked-in-scope)** ✨ new in v2
   - **[B.1.Y Custom-Cake Order/Quote Flow](#b1y-custom-cake-orderquote-flow)** ✨ new in v2
   - [B.2 Orders Management](#b2-orders-management)
   - [B.3 Users & Customer Management](#b3-users--customer-management)
   - [B.4 Inventory Management](#b4-inventory-management)
   - [B.5 Secondary Commerce Features](#b5-secondary-commerce-features)
5. [Part C — Database Schema Plan](#part-c--database-schema-plan)
6. [Part D — Supabase Optimization](#part-d--supabase-optimization)
7. [Part E — Frontend Architecture Plan](#part-e--frontend-architecture-plan)
8. [Part F — Phased Roadmap](#part-f--phased-roadmap)
   - **[F.0 Phase 0 (revised) — Clean Schema Rebuild with ETL of 88 Live Products](#f0-phase-0-revised--clean-schema-rebuild-with-etl-of-88-live-products)** ✨ new in v2
9. [Part G — Cross-Cutting Concerns](#part-g--cross-cutting-concerns)
   - **[G.X COD-Only Operations (locked-in scope at launch)](#gx-cod-only-operations-locked-in-scope-at-launch)** ✨ new in v2
10. [Appendix — Open Questions](#appendix--open-questions)

---

## 1. Executive Summary

The current app is a **visually complete storefront scaffold** with a working dark-themed admin, but as an e-commerce platform it is an early prototype. It has four tables (`categories`, `products`, `orders`, `order_items`), a single browser-side Supabase anon client, and every page rendered client-side. There is no server data layer, no transactional checkout, no real role model, and no inventory, variations, coupons, tax, shipping, reviews, payments, or reporting beyond client-side aggregation.

Reaching WooCommerce-level depth is therefore **mostly additive**, but it sits on top of **three foundational changes that must come first**:

1. **A server-side data/auth layer** (`@supabase/ssr`: browser + server + service-role clients) replacing the lone anon client. Everything else — secure checkout, route protection, admin mutations, reporting — depends on this.
2. **A real authorization model** (`profiles.role` keyed by `auth.uid()`), replacing the hard-coded `admin@kakeez.com` email check that is duplicated in client code and RLS, and removal of the committed default admin password.
3. **Server-authoritative money & orders** (integer minor units, server-recomputed totals, transactional order creation via RPC), replacing client-trusted Zustand totals.

Once those land, the catalog/orders/inventory/secondary features can be built incrementally behind a stable, secure spine. The roadmap below is sequenced so the store stays shippable at each milestone.

**Estimated shape:** ~7 phases. Phases 0–2 are foundation/security (no new customer features but unblock everything). Phases 3–6 deliver the WooCommerce feature surface. This is a substantial build — think "rewrite the data layer and grow the schema ~4×," not "add a few tables."

---

## 2. Scope, Assumptions & Decisions Needed

### Assumptions (state-and-proceed)

- **Business model:** single-vendor (one bakery), not a multi-vendor marketplace. The schema is designed single-store but leaves room for a `store_id` later.
- **Currency:** PKR (`Rs.`), single currency. Money is modeled in **integer minor units (paisa)** internally; display formatting happens at the edge.
- **Primary product type:** physical, perishable, **locally delivered** goods. Digital/virtual product *types* are included in the schema for completeness (the user asked for multiple product types), but features like downloadable-file delivery are low priority for this business and flagged as such.
- **Locale:** Pakistan. "Shipping" effectively means **local delivery zones** (by area/city), not international carrier integration. "Tax" means a simple configurable sales/GST rate, not a multi-jurisdiction tax engine.
- **Next.js 16 specifics** (middleware/`proxy`, `params` as Promise, caching directives, `cacheComponents`) must be verified by implementers against `node_modules/next/dist/docs/` per the repo's `AGENTS.md`. This plan describes intent; it does not hard-code Next 16 API surface that may have shifted from older docs.

### Decisions — status (v2)

**Locked in** (see [§0.1](#01-decisions-locked-in-by-the-project-owner)):

- ✅ **Payments — COD-only at launch.** No PSP. Card/JazzCash/Easypaisa UI removed in Phase 0. Schema is PSP-ready for Phase 6+.
- ✅ **Variations — YES.** Kakeez sells custom cakes; full variation engine in Phase 2 (B.1.X), plus a parallel bespoke quote flow (B.1.Y) because not every custom cake fits an attribute picker.
- ✅ **Schema rebuild — ALLOWED.** Phase 0 is a clean drop-and-recreate with ETL of 88 live products (F.0).

**Still open** (do not block Phase 0):

- **Email provider:** Resend / Supabase SMTP / SendGrid for transactional email.
- **Reviews moderation:** auto-publish vs admin-approved; verified-purchase only?

---

# Part A — Codebase Audit

## A.1 Next.js Frontend Audit

### Structure (as-is)

```
src/
  app/
    layout.tsx                 root layout (fonts via <head> <link>, global metadata only)
    globals.css
    page.tsx                   home — "use client", N+1 fetch, absolute-vw layout
    menu/page.tsx              static (SimplePage)
    contact/page.tsx           static
    catering/page.tsx          static
    product/[id]/page.tsx      "use client", client fetch, no notFound()
    checkout/page.tsx          "use client", client-trusted totals, non-transactional
    admin/
      layout.tsx               "use client" auth gate (email === admin@kakeez.com)
      login/page.tsx
      page.tsx                 dashboard — realtime INSERT subscription, client stats
      products/page.tsx        CRUD, single image, no validation
      orders/page.tsx          list + status select (NO realtime here)
      customers/page.tsx       derived from orders (no real profiles)
      settings/page.tsx        mostly stub ("Module Coming Soon")
  components/shop/             Navbar, UserAuthPopup, CartDrawer, Hero, Footer,
                              SimplePage, ProductCard
  lib/supabase.ts             single anon browser client
  store/useCart.ts            Zustand cart, persisted to localStorage ("kakeez-cart")
```

### What's correct / conventional

- **App Router only** — no mixed Pages Router. Good baseline.
- Path alias `@/*` → `src/*` is configured.
- `next.config.ts` correctly allow-lists `*.supabase.co` storage for `next/image`, and pins the Turbopack root.
- Dynamic route uses the Next 16 `params`-as-Promise pattern (`React.use(params)` in `product/[id]/page.tsx`).
- TypeScript `strict` is on.

### Deviations & problems (frontend)

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F1 | **High** | **Everything is a Client Component.** No use of Server Components for public catalog/SEO; all data is fetched in `useEffect` with the anon client. Loses SSR, streaming, caching, and metadata-on-data. | `"use client"` at top of every `page.tsx` |
| F2 | **High** | **Client-side-only route protection.** Admin and checkout gate via `useEffect` + `router.push` after JS loads → flicker, shell leakage, no server enforcement. | `admin/layout.tsx:28`, `checkout/page.tsx:40` |
| F3 | **High** | **N+1 homepage queries.** Loops categories and issues one `products` query per category. | `page.tsx:58-69` |
| F4 | **High** | **Brittle absolute-`vw` layout.** Product positions are computed in JS (`top`/`left` in `vw`), and the page height is injected via `dangerouslySetInnerHTML`. Effectively a pixel-perfect static export, not a responsive/maintainable layout; mobile is unaddressed. | `page.tsx:82-131,286-289`, `ProductCard.tsx` |
| F5 | Medium | **`stock_quantity` is never edited in the admin product form.** The column exists but the UI form (`formData`) omits it — inventory is invisible to admins today. | `admin/products/page.tsx:23-30` |
| F6 | Medium | **No `notFound()` / `error.tsx` / `not-found.tsx`.** Invalid product renders a soft-404 component; no route-level error boundaries. | `product/[id]/page.tsx:94` |
| F7 | Medium | **Pervasive `any`.** `useState<any[]>`, `error: any`, untyped Supabase rows throughout admin/storefront. Repo lint reportedly fails (32 errors). | `orders/page.tsx:8`, `products/page.tsx:8`, etc. |
| F8 | Medium | **Raw `<img>` in admin & cards** instead of `next/image`; one preview `<img>` has no `alt`. | `ProductCard.tsx:52`, `admin/products/page.tsx:287,384` |
| F9 | Medium | **Hard-coded business logic in the client.** Promo codes (`KAKEEZ10`, `WELCOME`), delivery charge (`Rs.99`), and the admin identity all live in client constants. | `checkout/page.tsx:12-14`, `Navbar.tsx:27` |
| F10 | Low | **Fonts loaded via `<head><link>`** rather than `next/font` (render-blocking, no self-hosting/subsetting). | `layout.tsx:16-20` |
| F11 | Low | **Stray root-level image imports.** `page.tsx` imports `../../cakes.png` etc. from the repo root; these assets belong in `src/assets/` or `public/`. There is also a junk file literally named `sh -T git@github.com` in the repo root (accidental SSH command output) — should be deleted. | `page.tsx:11-14`, repo root listing |
| F12 | Low | **No global toast system.** The "New Order" alert is a bespoke inline banner on the dashboard only; the user's requested toast-on-new-order needs a real notification primitive. | `admin/page.tsx:74-82` |

## A.2 Supabase Backend Audit

### CLI inspection performed (v2 — completed)

The Supabase CLI is available via `npx supabase` (**v2.106.0**), and now linked to the live project. What was actually verified:

- `supabase projects list` → two projects (`AI-Rental-Hub` INACTIVE, **`kakeez-bakeshop`** ACTIVE_HEALTHY, Postgres 17, region `us-east-1`).
- `supabase link --project-ref crzqqvbvaguttrkzvpqh` ✅ succeeded.
- `supabase migration list --linked` shows **drift**: local has 5 migrations; remote has those 5 **+ `20260619000000`** — a remote-only migration absent from the repo. Inspection (see [§F.0 step b](#f0-phase-0-revised--clean-schema-rebuild-with-etl-of-88-live-products)) shows it `DROP`s a previously-attempted WooCommerce-style schema.
- `supabase inspect db table-stats --linked` shows **88 products**, **4 categories**, **1 stale order with 0 order_items** (live proof of the non-transactional checkout bug), **1 profiles row** — and the `profiles` table is **not in any migration file**, repo-side or remote-side. Someone created it manually in Studio at some point, separately from `20260619`.
- `supabase inspect db unused-indexes --linked` confirms only PK + `categories.slug` unique indexes; `orders_pkey` has zero index scans (seq-scan only — trivially fine at 1 row, broken at any scale).
- `supabase inspect db bloat --linked` shows `public.products` at **1.8× bloat** — significant update-churn at just 88 rows.
- `supabase db dump --linked --schema public` produces **empty files** on Windows (bundled `pg_dump` mismatch with Postgres 17). Workaround documented in [§F.0 step b](#f0-phase-0-revised--clean-schema-rebuild-with-etl-of-88-live-products): pull the orphan migration content via Studio SQL editor → paste into repo. `psql` is not installed locally; PostgREST `/rest/v1/` root requires a *secret* key (publishable/anon key rejected), so further read-side introspection from this machine requires Studio access.
- `config.toml` is the default scaffold with: Realtime enabled, Storage limit 50 MiB, Auth email confirmations **disabled** (`enable_confirmations = false`), min password length **6**, anonymous sign-ins disabled, refresh-token rotation on. All four of those defaults change in Phase 4 (auth hardening).

### Schema (as written in migrations)

```
categories(id uuid pk, name text, slug text unique, created_at timestamptz)
products(id uuid pk, name text, description text, price decimal(10,2),
         image_url text, category_id uuid → categories ON DELETE CASCADE,
         is_best_seller bool, is_upsell bool, stock_quantity int default 0,
         created_at timestamptz)
orders(id uuid pk, customer_name text, customer_email text,
       total_amount decimal(10,2), status text default 'pending',
       created_at timestamptz)                    -- REPLICA IDENTITY FULL, in supabase_realtime publication
order_items(id uuid pk, order_id uuid → orders ON DELETE CASCADE,
            product_id uuid → products (nullable), quantity int, unit_price decimal(10,2))
```

### RLS & storage (as written)

- `is_admin()` = `(auth.jwt()->>'email') IN ('admin@kakeez.com')` — `SECURITY DEFINER`, hard-coded email.
- categories/products: public `SELECT`, admin-only write.
- orders/order_items: authenticated user can `SELECT`/`INSERT` rows where `customer_email = jwt email`; admin can update/delete.
- storage `products` bucket: public read, admin-only write.
- Realtime: `orders` has `REPLICA IDENTITY FULL` and is in the `supabase_realtime` publication.

### Problems (backend)

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| B1 | **Critical** | **Committed default admin credential.** Migration seeds `admin@kakeez.com` / `admin` directly into `auth.users`. Known password in git history. | `20260615000001_seed_admin.sql` |
| B2 | **Critical** | **Admin identity is a hard-coded email** in both RLS (`is_admin()`) and client code. Not auditable/revocable; couples authz to one string in two places. | `20260616000000_enable_rls_security.sql:24`, `Navbar.tsx:27`, `admin/layout.tsx:33` |
| B3 | **Critical** | **No business-rule integrity on orders.** `orders_insert_own` only checks email ownership — a signed-in user can insert an order with **any** `total_amount`/`status`. Combined with client-trusted checkout, totals are untrustworthy. | `20260616000000_enable_rls_security.sql:92` |
| B4 | **High** | **Money as `DECIMAL` set from the client.** `total_amount` / `unit_price` are written directly from browser cart state; floats + client trust. | `checkout/page.tsx:88-112` |
| B5 | **High** | **Order creation is not transactional.** Insert `orders`, then `order_items`; item failure only `console.warn`s and still shows success → orphan orders with no/partial line items. | `checkout/page.tsx:97-121` |
| B6 | **High** | **Ownership keyed by email, not `user_id`.** No `orders.user_id → auth.users`. Email is mutable and weak as an ownership key; breaks once accounts can change email. | schema + RLS |
| B7 | Medium | **Destructive cascade.** Deleting a category `ON DELETE CASCADE` deletes all its products (and the admin UI warns but still does it), which also orphans historical `order_items.product_id`. | `20260615000003_fix_cascade.sql`, `admin/products/page.tsx:178` |
| B8 | Medium | **No product status model.** No `status`/`published_at`; `products_select_all USING (true)` exposes everything. No drafts/archive. | schema + RLS |
| B9 | Medium | **No constraints/indexes.** No positive-price/qty checks, no status enum, no FKs indexed (`products.category_id`, `orders.created_at`, `order_items.order_id`). `order_items.product_id` nullable. | `20260615000000_initial_schema.sql` |
| B10 | Medium | **Storage upload is unsafe.** Filenames are `Math.random()`-based (collision-prone, not crypto-random), `accept="image/*"`, no MIME/size/extension enforcement server-side. | `admin/products/page.tsx:55-72` |
| B11 | Medium | **Realtime is half-wired & coarse.** Dashboard subscribes to `postgres_changes` INSERT only; the **orders page does not subscribe at all**; status-change (UPDATE) events aren't handled; `postgres_changes` is RLS-scoped (works only because admin passes `is_admin()`). | `admin/page.tsx:29-42`, `orders/page.tsx` |
| B12 | Low | **Auth hardening gaps.** Email confirmation disabled, min password 6, no password-reset/verify flows, no SMTP configured (emails go to Inbucket locally only). | `config.toml`, `UserAuthPopup`/`login` |

## A.3 Foundational Refactors (must precede feature work)

These are the load-bearing changes. **No WooCommerce feature should be built before these are in place**, because each new feature would otherwise inherit the same insecurity/architecture debt.

1. **Adopt `@supabase/ssr` and a 3-client pattern** (`lib/supabase/{browser,server,admin}.ts`). Public reads → server components; user/admin reads & all writes → server-side with cookie session; privileged operations → service-role client, **server-only**.
2. **Real role model:** `profiles` table (1:1 with `auth.users`) with `role enum`. Rewrite `is_admin()` / add `has_role()` to read by `auth.uid()`. Remove the seeded admin migration; rotate the live password.
3. **Server-authoritative money & checkout:** integer minor units everywhere; a `checkout` Server Action / `create_order` RPC that recomputes totals from DB and writes order + items atomically; revoke direct client `INSERT` on `orders`/`order_items`.
4. **Server route protection** (`middleware`/`proxy` + server-layout checks) for `/admin/*`, `/checkout`, `/account/*`; RLS remains the DB backstop.
5. **Establish the CLI migration workflow** (link project, `db pull`, migrations forward-only, seed via `supabase/seed.sql`). Convert "run in SQL editor" into versioned migrations.
6. **Lint/types green + CI** so the larger build doesn't accrete regressions.

---

# Part B — Target Feature Set (WooCommerce parity)

Each capability below lists **what WooCommerce does**, **what we build**, and **relevance** for this bakery use case. Schema specifics are consolidated in [Part C](#part-c--database-schema-plan).

## B.1 Product Management

### B.1.1 Simple & variable products (attributes, combinations) — **locked-in scope (v2)**
- **Build:** a product can be **Simple** (single SKU/price) or **Variable**. Global & per-product **attributes** (Size, Flavor, Shape, Tiers, Dietary) with **values**; a Variable product generates **variations** = a specific combination of attribute values, each with its own SKU, price-delta, stock, image, and weight.
- **Model summary:** `attributes`, `attribute_values`, `product_attributes`, `product_variations`, `variation_attribute_values`, plus a separate `order_item_addons` junction (see B.1.X).
- **Status:** **LOCKED IN**. Full design with cake-specific attributes, DDL, indexes, admin matrix-builder UX, customer picker UX, and edge cases is in **[§B.1.X below](#b1x-variations-engine-cake-specific-locked-in-scope)**.
- **Pairing:** bespoke custom cakes (Spider-Man themed, photo references, multi-tier sculpted) bypass this engine entirely and go through the quote flow in **[§B.1.Y](#b1y-custom-cake-orderquote-flow)**.

### B.1.2 Product types: physical / digital-downloadable / virtual
- **Build:** `products.type enum('physical','digital','virtual')`. Physical → requires shipping/inventory; virtual → no shipping (e.g., a "cake decorating class" booking); digital → downloadable asset(s) via `product_downloads` + signed-URL delivery from a **private** storage bucket.
- **Relevance:** Physical = core. Virtual = plausible (classes, gift cards). Digital = low for a bakery; implement schema, defer the download-delivery UI.

### B.1.3 Multi-image gallery with ordering + featured image
- **Build:** `product_images(product_id, storage_path, alt, position, is_featured)`. Replaces the single `products.image_url`. Admin: drag-to-reorder, set featured, per-image alt text. Variation-level image override supported via `product_variations.image_id`.
- **Relevance:** High — cakes are visual; multiple angles matter.

### B.1.4 Inventory per product & per variation
- **Build:** stock tracked on the **stockable unit** (simple product *or* a variation): `track_inventory bool`, `stock_quantity int`, `low_stock_threshold int`, `backorder_policy enum('no','notify','yes')`, `stock_status enum('in_stock','out_of_stock','on_backorder')`. Decrement transactionally at order placement (see Inventory, §B.4).
- **Relevance:** High, but note perishability — bakeries often make-to-order. Support a **"made to order / no stock tracking"** mode per product (just set `track_inventory=false`).

### B.1.5 Categories & tags (nested/hierarchical)
- **Build:** add `categories.parent_id` (self-referential) for unlimited nesting, plus `position`, `description`, `image`. Add `tags` + `product_tags` (many-to-many). Many-to-many `product_categories` so a product can live in multiple categories (WooCommerce behavior) — supersedes the single `products.category_id`.
- **Relevance:** High. Today categories are flat and single-assignment with a destructive cascade.

### B.1.6 Attributes & custom fields
- **Build:** global attributes (reusable) + custom per-product fields via a typed `product_meta(product_id, key, value, type)` table (the WooCommerce "custom fields/metadata" analog) for things like "Serves (people)", "Allergens", "Prep time".
- **Relevance:** Medium-high (allergens, serving size are real bakery needs).

### B.1.7 Product states + bulk actions
- **Build:** `products.status enum('draft','published','archived')` + `published_at`. Public RLS exposes only `published`. Admin list supports **bulk actions** (publish/unpublish/archive/delete, set category, adjust price/stock) and **filtering/search**.
- **Relevance:** High — currently no draft concept; everything is live.

## B.1.X Variations Engine (cake-specific, locked-in scope)

> Scope: applies to catalog SKUs where the customer picks from a fixed set of options (1lb chocolate-fudge round, eggless 2lb pineapple, etc.). For freeform requests ("Spider-Man cake for 30 people, my daughter's name in Urdu calligraphy") see the **[Custom Cake Quote Flow](#b1y-custom-cake-orderquote-flow)** — that path bypasses this engine entirely.

### 1. Concrete attributes for Kakeez

The engine ships seeded with the attributes a Karachi/Lahore bakery actually sells. These are data rows, not enums — admin can add `mango` flavor in June without a migration.

| Attribute | Type | Values (seed) | Notes |
|---|---|---|---|
| `size` | single-select | `0.5lb`, `1lb`, `2lb`, `3lb`, `4lb`, `5lb`, `half-sheet`, `full-sheet`, `6-cupcakes`, `12-cupcakes` | Pakistani bakeries price by pound, not inches. Sheet sizes for office/event orders. |
| `flavor` | single-select | `chocolate-fudge`, `vanilla`, `red-velvet`, `pineapple`, `coffee`, `kit-kat`, `oreo`, `lotus-biscoff`, `mango` (seasonal), `strawberry` | Kit-Kat / Lotus are top sellers in PK market — do not omit. |
| `shape` | single-select | `round`, `square`, `heart`, `rectangle`, `number` (for "21st birthday" digit cakes) | `heart` and `number` carry a delta — odd molds. |
| `tiers` | single-select | `single`, `2-tier`, `3-tier` | Only valid when size ≥ 3lb. Engine enforces via UX (Section 7), not DDL. |
| `dietary` | single-select | `regular`, `eggless`, `sugar-free` | `eggless` is high-demand in PK (~25% of orders) — must be a first-class variant, not a checkbox add-on. |
| `custom_message` | add-on (text) | free text up to 40 chars | Charged flat PKR 0 (included). Lives on order line, not variation. |
| `candles` | add-on (qty) | 0–30 | Flat PKR 50/each. |
| `fondant_topper` | add-on (single) | `none`, `name-plaque`, `figurine`, `photo-print` | PKR 300 / 800 / 1200. Photo-print requires upload. |

Hard rule: `size`, `flavor`, `shape`, `tiers`, `dietary` define a **variation** (one row, one SKU, one price). `custom_message`, `candles`, `fondant_topper` are **add-ons** (do not multiply the matrix).

### 2. DDL

All money in `*_minor` (PKR paisa, `bigint`). Ownership via `user_id → profiles(id)`. Soft-delete via `deleted_at`.

```sql
-- =========================================================================
-- ATTRIBUTES: global library, reusable across products
-- =========================================================================
create table attributes (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,            -- 'size', 'flavor', 'shape'
  label        text not null,                   -- 'Size', 'Flavor'
  label_ur     text,                            -- Urdu label (optional, future)
  kind         text not null check (kind in ('single_select','multi_select')),
  display_order int not null default 0,
  created_at   timestamptz not null default now()
);

create table attribute_values (
  id            uuid primary key default gen_random_uuid(),
  attribute_id  uuid not null references attributes(id) on delete cascade,
  slug          text not null,                  -- '1lb', 'chocolate-fudge'
  label         text not null,                  -- '1 lb', 'Chocolate Fudge'
  label_ur      text,
  swatch_hex    text,                           -- optional color chip for flavor
  display_order int not null default 0,
  is_active     bool not null default true,
  created_at    timestamptz not null default now(),
  unique (attribute_id, slug)
);

-- =========================================================================
-- PRODUCT ↔ ATTRIBUTE wiring: which attributes does THIS product use?
-- =========================================================================
create table product_attributes (
  product_id    uuid not null references products(id) on delete cascade,
  attribute_id  uuid not null references attributes(id) on delete restrict,
  display_order int not null default 0,
  is_required   bool not null default true,
  primary key (product_id, attribute_id)
);

-- =========================================================================
-- VARIATIONS: one row = one buyable SKU
-- Pricing model: base + delta (see Section 3)
-- =========================================================================
create table product_variations (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references products(id) on delete cascade,
  sku                text unique,                       -- 'CHOCFDG-1LB-RND-REG'
  price_delta_minor  bigint not null default 0,         -- can be negative
  compare_at_delta_minor bigint,                        -- struck-through "was" price
  weight_grams       int,                               -- for shipping calc later
  image_url          text,                              -- override product hero
  track_inventory    bool not null default false,       -- see Section 5
  stock_quantity     int not null default 0,            -- only honored if track_inventory
  is_active          bool not null default true,
  deleted_at         timestamptz,                       -- soft-delete; historic order_items keep snapshot
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- the (attribute_value_id...) tuple that identifies this variation
create table variation_attribute_values (
  variation_id        uuid not null references product_variations(id) on delete cascade,
  attribute_id        uuid not null references attributes(id) on delete restrict,
  attribute_value_id  uuid not null references attribute_values(id) on delete restrict,
  primary key (variation_id, attribute_id)
);

-- =========================================================================
-- COLLISION GUARD: a product cannot have two variations with the same
-- (size, flavor, shape, tiers, dietary) combo
-- =========================================================================
-- materialized signature column kept in sync by trigger
alter table product_variations
  add column attr_signature text generated always as (null) stored;  -- placeholder; populated by trigger

create unique index variations_combo_uniq
  on product_variations (product_id, attr_signature)
  where deleted_at is null;
-- attr_signature is recomputed via AFTER INSERT/UPDATE/DELETE trigger on
-- variation_attribute_values, building a stable sorted string like
-- 'flavor:chocolate-fudge|shape:round|size:1lb'

-- =========================================================================
-- INDEXES (the live DB only has PK indexes — every one below is non-optional)
-- =========================================================================
create index attribute_values_attr_idx          on attribute_values(attribute_id) where is_active;
create index product_attributes_product_idx     on product_attributes(product_id);
create index product_attributes_attribute_idx   on product_attributes(attribute_id);
create index variations_product_idx             on product_variations(product_id) where deleted_at is null;
create index variations_product_active_idx      on product_variations(product_id) where deleted_at is null and is_active;
create index vav_variation_idx                  on variation_attribute_values(variation_id);
create index vav_attribute_value_idx            on variation_attribute_values(attribute_value_id);  -- powers "which variations have flavor=chocolate-fudge?"
```

Without `variations_product_active_idx` the customer picker re-scans all variations on every click.

### 3. Pricing model — **base + delta** (chosen)

`products.base_price_minor` + `product_variations.price_delta_minor` = final variation price.

Justification:
- A Chocolate Fudge cake at 1lb is PKR 1,800; at 2lb is PKR 3,400; at 5lb is PKR 8,000. With **base + delta**, raising the entire chocolate-fudge line by PKR 100 (flour cost shock — happens in PK every quarter) is `update products set base_price_minor = base_price_minor + 10000`. With per-variation overrides it is a 7-row update per product, 88 products = 600+ rows. PK ingredient inflation makes bulk repricing the dominant admin operation.
- Delta can be negative — `eggless` is sometimes cheaper than regular, `sugar-free` always costlier.

### 4. Add-on handling — **`order_item_addons` junction** (chosen)

```sql
create table order_item_addons (
  id              uuid primary key default gen_random_uuid(),
  order_item_id   uuid not null references order_items(id) on delete cascade,
  addon_key       text not null,                          -- 'custom_message', 'candles', 'fondant_topper'
  addon_label     text not null,                          -- snapshot at order time
  addon_value     text,                                   -- "Happy Birthday Ayesha" / "12" / "name-plaque"
  unit_price_minor bigint not null,                       -- snapshot
  quantity         int not null default 1,
  created_at       timestamptz not null default now()
);
create index order_item_addons_item_idx on order_item_addons(order_item_id);
```

Justification:
- **Not a separate line item**: a "Happy Birthday Ayesha" message on a cake is a property of the cake, not a thing the customer bought. Separating it onto its own order_items row turns one cake into "1× Cake + 1× Message" on the kitchen ticket — confusing, breaks per-line subtotals.
- **Not folded into the variation**: free text ("Happy Birthday Ayesha") and per-unit qty (12 candles) cannot live in a fixed combinatorial matrix without exploding it.
- Junction table preserves immutable snapshots (label + price + value frozen at checkout, like `order_items.unit_price`), survives later admin edits to the add-on catalog, and renders cleanly on the kitchen ticket: `1× Chocolate Fudge 2lb Round Eggless [+ "Happy Birthday Ayesha"] [+ 12 candles] [+ name plaque]`.

### 5. Stock policy — `track_inventory` on the stockable unit

Most Kakeez cakes are made-to-order: kitchen bakes when the order lands. Cookies, cupcake boxes, and ready-display items track stock. The flag lives on whichever row represents the buyable SKU:

- **Simple product** (no variations, e.g. "Lotus Biscoff Cookie Box — 12pc"): `products.track_inventory bool`, `products.stock_quantity int`.
- **Variable product** (cake with size/flavor): flag and qty live on `product_variations`. The product row's `track_inventory` is ignored.
- Default `false`. When `false`, storefront shows "Made to order — 24hr lead time" and never decrements anything.
- When `true`, the checkout RPC decrements inside the same transaction as `orders` insert (SECURITY DEFINER, row-locks the variation). Insufficient stock → structured error, frontend shows "Only 3 boxes left".
- Admin can flip `track_inventory` at any time without losing the row.

### 6. Admin UX — variation matrix builder

`/admin/products/[id]/variations` page:

1. **Pick attributes** — multi-select dropdown reads from `attributes` table. Admin chooses `size`, `flavor`, `dietary` for "Chocolate Fudge Cake". Saves to `product_attributes`.
2. **Generate matrix** — client computes Cartesian product: `size(7) × flavor(9) × dietary(3) = 189` rows. Renders as a virtualized table (TanStack Table), columns: `Size | Flavor | Dietary | SKU | Δ Price (PKR) | Active | Stock?`.
3. **Sparse mode (critical)** — admin is NOT required to fill all 189 rows. Each row has an `Active` toggle defaulting `off`. Save action only writes rows where `Active=on` OR `Δ Price ≠ 0` OR `SKU set`. This is how Kakeez actually operates: chocolate-fudge in `full-sheet` exists, but `sugar-free + heart + full-sheet` does not — never created, never shown.
4. **Bulk ops** (right-side panel):
   - "Set Δ +500 PKR on all rows where size = 5lb"
   - "Activate all rows where flavor ∈ {chocolate-fudge, vanilla, red-velvet}"
   - "Auto-generate SKUs from `{flavor-slug}-{size}-{dietary}` pattern"
5. **Save** — single server action, upserts into `product_variations` + `variation_attribute_values` in one transaction. Deactivated rows soft-delete (`deleted_at = now()`), not hard-delete, to protect historic `order_items` (see Section 8).
6. **Conflict UI** — if admin tries to add `flavor` to a product that already has 200 published variations, modal warns "This will require regenerating the matrix. Existing 200 variations will be preserved; you'll need to assign the new attribute value to each."

### 7. Customer picker UX — progressive disabling

On `/products/[slug]`:

1. Server sends one payload: product + all active variations + their attribute_value_ids + price_delta + stock state.
2. Client builds a reachability map: `availableValues = { flavor: Set<id>, size: Set<id>, ... }`.
3. Render one chip group per attribute, in `display_order`. Each chip:
   - **Enabled** if at least one active, in-stock variation exists matching current selection.
   - **Greyed + struck-through** if no such variation exists. Tooltip: "Not available with eggless 5lb" (computed from which selection excluded it).
   - **Sold out** badge if reachable but stock-tracked and 0.
4. Live price label: `Rs. {(base + delta).toLocaleString('en-PK')}` updates on every chip click — no debounce, pure local compute.
5. Add-ons render below variation picker once a full combo is selected:
   - Message: textarea, 40-char counter, "Free" badge.
   - Candles: numeric stepper 0–30, label `+ Rs. 50 × {n}`.
   - Fondant: radio with prices inline.
6. CTA disabled until every required attribute has a selection AND that combo resolves to an active variation. Button text mirrors state: "Select size", "Select flavor", "Add to cart — Rs. 3,650".
7. Mobile: chips wrap to 2 rows max per attribute; if more, horizontal scroll with edge fade. Tap target ≥ 44px (Karachi customers shop on Android, often one-handed in the car).

### 8. Edge cases

- **Combination collisions on save**: `variations_combo_uniq` index rejects. Server action catches `unique_violation` and surfaces row-level error "This combination already exists" pointing at the duplicate row in the matrix UI.
- **Removing an attribute from a published product**: blocked if any active variation depends on it. Admin must first deactivate (soft-delete) all variations using that attribute. UI shows count: "12 active variations use 'dietary' — deactivate them first." Hard guarantee: `product_attributes` delete uses `on delete restrict` against existing `variation_attribute_values`.
- **Soft-deleting a variation with historic `order_items`**: `product_variations.deleted_at = now()` only. `order_items` already carry immutable snapshots (`unit_price_minor`, `product_name_snapshot`, `variation_label_snapshot` like "1lb / Chocolate Fudge / Round / Eggless") set at checkout via the SECURITY DEFINER RPC. Re-rendering a 2025 order in 2027 never re-joins the live variation row; it reads the snapshot. This is identical to the snapshot pattern in `order_items.unit_price` today and is the reason hard-delete is never offered.
- **Stock race**: concurrent checkout for the last 1lb chocolate-fudge — the RPC `SELECT … FOR UPDATE` on the variation row inside the orders transaction. Second checkout fails fast, customer sees "Sold out — sorry!".
- **Renaming an attribute value** (`chocolate-fudge` → `belgian-chocolate-fudge`): allowed, slug stays for URL stability, only `label` changes. Existing snapshots on order_items are unaffected (they froze the label at checkout time).
- **Variation with zero `variation_attribute_values` rows**: blocked by a `check` constraint via trigger — empty signature would collide with every other empty one.
- **Add-on price changes after order placed**: irrelevant — `order_item_addons.unit_price_minor` is snapshotted.

### 9. When to use this engine vs the Custom Cake Quote Flow

Use **this variations engine** when:
- The customer's request resolves to a row in `product_variations` (size, flavor, shape, tiers, dietary picked from chips) plus optional add-ons.
- Price is deterministic at picker time.
- COD checkout fires immediately, no human in the loop.

Use the **Custom Cake Quote Flow** (next section) when:
- Customer needs photo upload of a reference cake.
- Customer wants a theme/character/sculpted shape not in the shape attribute (Spider-Man, Frozen, sculpted football).
- Customer wants Urdu/Arabic calligraphy, edible photo print larger than a topper, multi-tier sculpted, or "feeds 50 people, surprise me on design".
- Date is < 24 hours away (rush quote) or > 7 days away with a deposit.
- Total likely > PKR 15,000 (admin wants to confirm feasibility before COD locks them into baking it).

Routing rule on the storefront: every product page has both CTAs when applicable — "Add to cart" (this engine) and "Request custom design" (quote flow). Products tagged `is_quote_only = true` hide the variations picker entirely and show only the quote CTA (e.g., "Tiered Wedding Cake — Custom").

---

## B.1.Y Custom-Cake Order/Quote Flow

Kakeez sells real bespoke cakes (wedding, birthday, themed) where price and feasibility depend on a reference photo + description, not a SKU. The variable-product engine (B.1.X) handles known recipes with size/flavor pickers; this flow handles everything that needs a human quote first.

### Y.1 Decision rule — variable product vs bespoke quote

Use **variable product** (B.1.X) when the cake exists in the catalog and the only variability is parametric:

- Customer picks from a fixed Size set (e.g. 1 lb / 2 lb / 3 lb) and a fixed Flavor set (Chocolate / Vanilla / Red Velvet).
- All combinations have a known price up-front.
- Inventory/lead-time is predictable per variation.
- Example: "Classic Chocolate Fudge" with Size and Flavor attributes.

Use **bespoke quote** (this section) when:

- Customer provides a reference photo and expects custom decoration, fondant work, multi-tier construction, themed toppers, dietary substitutions, or anything not on the menu.
- Final price cannot be computed from attributes alone — staff must look at the photo and decide.
- Required lead time depends on complexity.
- Storefront entry points: a `Customized Cakes` category landing page (the icon already exists at `customized cakes.png`) and a "Request a custom cake" CTA on home.

Rule of thumb: if the customer would ever say "can you make it look like *this*?", route them to bespoke. If the answer is fully captured by dropdowns, keep them in B.1.X.

### Y.2 Schema — `custom_order_requests`

```sql
create type custom_order_status as enum (
  'requested',          -- customer submitted, no staff has looked
  'admin_reviewing',    -- a staff member has opened it (claim)
  'quoted',             -- price + ETA sent to customer, awaiting decision
  'customer_confirmed', -- customer accepted; pre-conversion
  'converted_to_order', -- orders row created, source_request_id set
  'declined',           -- staff said no (reason captured)
  'cancelled'           -- customer or admin cancelled before conversion
);

create table public.custom_order_requests (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete restrict,
  title                    text not null check (char_length(title) between 3 and 120),
  description              text not null check (char_length(description) between 10 and 4000),
  desired_date             date not null,
  desired_size_hint        text,        -- free-form: "for 25 people" / "3 lb" — staff interprets
  desired_flavor_hint      text,
  reference_image_paths    jsonb not null default '[]'::jsonb,
                           -- array of storage object paths under custom-order-uploads/{user_id}/...
                           -- 1..3 entries enforced by CHECK + server action
  status                   custom_order_status not null default 'requested',
  -- Quote fields (filled when status = 'quoted')
  quote_total_minor        integer check (quote_total_minor is null or quote_total_minor > 0),
  quote_valid_until        timestamptz,
  quote_note               text,        -- "Includes 2-tier fondant, delivery Mon AM"
  -- Decline / cancel
  declined_reason          text,
  cancelled_reason         text,
  -- Conversion
  converted_order_id       uuid references public.orders(id) on delete set null,
  -- Audit
  reviewed_by_user_id      uuid references public.profiles(id),
  reviewed_at              timestamptz,
  quoted_by_user_id        uuid references public.profiles(id),
  quoted_at                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint cor_desired_date_future
    check (desired_date >= (created_at::date + interval '2 days')),
  constraint cor_images_count
    check (jsonb_array_length(reference_image_paths) between 1 and 3),
  constraint cor_quote_complete
    check (
      status <> 'quoted'
      or (quote_total_minor is not null
          and quote_valid_until is not null
          and quoted_by_user_id is not null)
    ),
  constraint cor_declined_has_reason
    check (status <> 'declined' or declined_reason is not null),
  constraint cor_converted_has_order
    check (status <> 'converted_to_order' or converted_order_id is not null)
);

create index cor_user_id_idx          on public.custom_order_requests (user_id);
create index cor_status_created_idx   on public.custom_order_requests (status, created_at desc);
create index cor_converted_order_idx  on public.custom_order_requests (converted_order_id);

-- Link from orders side (added in orders DDL):
--   alter table public.orders add column source_request_id uuid references public.custom_order_requests(id) on delete set null;
--   create index orders_source_request_idx on public.orders(source_request_id);
```

Money in `quote_total_minor` paisa. Ownership via `user_id → profiles(id)`. Soft-delete via `status IN ('declined','cancelled')` — rows are never hard-deleted because the photos and chat history are evidence.

### Y.3 Status lifecycle (server-enforced)

```
                              decline
                          ┌──────────────┐
                          ▼              │
   requested ─claim─► admin_reviewing ──quote──► quoted
       │                                            │
       │ cancel (customer, until quoted)            │ confirm (customer)
       ▼                                            ▼
   cancelled                            customer_confirmed
                                                    │
                                                    │ convert (server, atomic)
                                                    ▼
                                          converted_to_order
```

All transitions go through `SECURITY DEFINER` RPCs that re-read `status` under `FOR UPDATE` and reject illegal moves. No client-side direct UPDATE — RLS allows only INSERT (customer, own row) and SELECT.

| from | to | actor | RPC |
|---|---|---|---|
| requested | admin_reviewing | staff | `claim_custom_order_request(id)` |
| requested | cancelled | owner | `cancel_custom_order_request(id, reason)` |
| admin_reviewing | quoted | staff | `submit_custom_order_quote(id, total_minor, valid_until, note)` |
| admin_reviewing | declined | staff | `decline_custom_order_request(id, reason)` |
| admin_reviewing | requested | staff | `release_custom_order_request(id)` (unclaim) |
| quoted | customer_confirmed | owner | `confirm_custom_order_quote(id)` |
| quoted | cancelled | owner | `cancel_custom_order_request(id, reason)` |
| quoted | declined | staff | `decline_custom_order_request(id, reason)` (rare: staff rescinds) |
| customer_confirmed | converted_to_order | server | invoked transactionally inside `confirm_custom_order_quote` |

Quote expiry: a nightly cron (or a check inside `confirm_custom_order_quote`) auto-moves `quoted` rows past `quote_valid_until` back to `admin_reviewing` with a system note, so a stale price can't be confirmed.

### Y.4 RLS

```sql
alter table public.custom_order_requests enable row level security;

create policy cor_select_own on public.custom_order_requests
  for select using (user_id = auth.uid());

create policy cor_select_staff on public.custom_order_requests
  for select using (public.has_role(auth.uid(), 'staff')
                 or public.has_role(auth.uid(), 'admin'));

create policy cor_insert_own on public.custom_order_requests
  for insert with check (user_id = auth.uid() and status = 'requested');

-- No UPDATE/DELETE policies. All mutations go through SECURITY DEFINER RPCs.
```

A `before insert` trigger sanitises `status := 'requested'`, clears quote fields, and rejects `reference_image_paths` entries not under `{user_id}/`.

### Y.5 Storage — `custom-order-uploads` (PRIVATE bucket)

- Bucket: `custom-order-uploads`, **public read = false**.
- Path key: `{user_id}/{request_id_or_pending}/{uuid}.{ext}`.
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp`, `image/heic`.
- Max size: 5 MB per file. Max 3 files per request (enforced both in the server action and by the `cor_images_count` CHECK).
- Storage policies: owner read/write own prefix; staff/admin read all; signed URLs (~5 min TTL) used everywhere to render.
- Orphan sweep: a daily job deletes objects under `*/pending/*` older than 24 h whose owner never finished submission.

### Y.6 Conversion — `confirm_custom_order_quote`

Single `SECURITY DEFINER` RPC, runs in one transaction:

1. `select … for update` on the `custom_order_requests` row. Reject if `status <> 'quoted'`, `quote_valid_until < now()`, or `auth.uid() <> user_id`.
2. Re-check the customer's open-quote/no-show caps (see Y.9).
3. `insert into orders (...) returning id` with `user_id` = request owner; `payment_method = 'cod'`, `payment_status = 'unpaid'`; `status = 'pending_confirmation'`; `source_request_id` = request id; `total_minor = quote_total_minor`.
4. `insert into order_items` — exactly one immutable snapshot row: `name_snapshot = 'Custom cake — ' || title`, `unit_price_minor = quote_total_minor`, `quantity = 1`, `is_custom = true`, `source_request_id` for analytics.
5. Update the request: `status = 'converted_to_order'`, `converted_order_id = new.id`, `updated_at = now()`.
6. Insert into `order_events` and `custom_order_events`.
7. Return the new order id; the route handler redirects the customer to `/account/orders/{id}`.

This is the only place an `orders` row is born from a custom request, and it's atomic — no partial states like the legacy bug that left `order_items` empty.

### Y.7 Storefront UX

**Entry points:** home CTA, `Customized Cakes` category page (icon exists at `customized cakes.png`), and direct route `/custom-cake/new` (auth-required).

**Request form (`/custom-cake/new`):**

- `title` — short label ("Maham's 25th birthday").
- `description` — multiline, 10–4000 chars, placeholder lists what staff need (theme, colours, dietary restrictions, expected servings).
- `desired_date` — date picker, min = today + 48 h (enforced both UI and DB CHECK).
- `desired_size_hint`, `desired_flavor_hint` — free text, optional.
- `reference_image_paths` — drag-and-drop up to 3 photos, ≤5 MB each, MIME-validated client and server. Upload to `custom-order-uploads/{user_id}/pending/{uuid}.ext` *before* submit; submit handler moves them to `{user_id}/{request_id}/` and atomically inserts the row. Orphan sweep (Y.5) reclaims abandoned uploads.
- Submit → server action → RLS-protected `insert` → redirect to `/account/custom-orders/{id}`.

**Customer "My custom orders" — `/account/custom-orders`:** list with status badge, thumbnail, days-until-desired-date. Detail page shows all uploaded photos (signed URLs), timeline, and quote actions.

Anti-spam: rate-limited by `user_id` + IP (max 3 submissions / 24 h); the per-phone cap (Y.9) is the harder gate.

### Y.8 Admin UX — `/admin/custom-orders`

- Queue view, default filter: `status IN ('requested','admin_reviewing','quoted')`, sorted by `created_at asc`.
- Each row: 3 thumbnail photos, customer name + phone, **time-since-request** badge (red after 24 h on `requested`, red after 48 h on `admin_reviewing`), `desired_date` countdown, status pill, size/flavor hints.
- Row actions: **Claim**, **Quote composer** (drawer: price PKR → `*_minor`, `valid_until` default = now + 7 d, `note`), **Decline** (modal asks `declined_reason`), **Release** (unclaim).
- Detail page: customer view + customer's order history + cap status ("2 of 3 open custom orders, 0 prior no-shows") + WhatsApp click-to-chat quick link.
- Realtime: subscribed to `INSERT` and to `UPDATE` where `status = 'customer_confirmed'`. Soft toast + sidebar counter. Extends the same realtime infra used for orders (the orders list still needs to subscribe per the parent plan — do it once for both).

### Y.9 COD-only safeguards (the no-show problem)

Without payment up-front, a confirmed quote is a soft commitment. Mitigations layered cheapest-to-strongest:

1. **Phone OTP on signup** — non-negotiable for custom-order users. `profiles.phone_verified_at` must be non-null to submit.
2. **Configurable per-phone caps** in `store_settings`:
   - `custom_order.max_open_per_phone` (default 2)
   - `custom_order.max_open_per_user` (default 3)
3. **Phone block-list** — `profiles.blocked_at, blocked_reason`. Admin action `block_customer`. Block-list keys also on phone E.164 (catches re-registration with new email + same phone).
4. **Cancellation policy** — `store_settings.custom_order.cancellation_policy_text` shown on confirm screen; `cancellation_lockout_hours` (default 24 h before `desired_date`).
5. **No-show counter** — when admin marks a converted order `no_show`, `profiles.no_show_count` increments. Soft-block at `>= 2`, hard-block (auto-block) at `>= 3`.
6. **Deposit toggle (Phase-2 hook)** — flag `custom_order.require_deposit` defaults to `false` at launch; schema leaves room for `deposit_minor`. When PSP is wired, flips on without migration.

### Y.10 Realtime — per-request customer topic

- Channel: `custom_order:{id}`, scoped to the row.
- Customer's `/account/custom-orders/{id}` page subscribes to `UPDATE` events filtered by `id`. RLS on the realtime publication ensures only the owner sees it.
- Toasts: `admin_reviewing` → "A baker is reviewing your request."; `quoted` → "Your quote is ready" (also fires browser notification if permission granted); `declined` → silent status change, reason on detail page.
- Admin queue subscribes globally — covered in Y.8.

### Y.11 Indexing & migration notes

- The three indexes in Y.2 cover: customer's own list (`user_id`), admin queue (`status, created_at desc`), conversion back-link (`converted_order_id`).
- `orders.source_request_id` index added in the orders DDL.
- Photos in storage are NOT in DB rows, so `reference_image_paths` stays a small `jsonb` array.
- ETL note: the 88 preserved products from the legacy catalog are catalog SKUs (B.1.X variable cakes). None migrate into `custom_order_requests`; that table starts empty.

### Y.12 Open questions deferred to Phase-2

- WhatsApp/SMS notification on `quoted` (Twilio or local Pakistani SMS gateway) — for launch: in-app toast + email via the order receipt pipeline.
- Customer counter-offer / back-and-forth chat thread on a quote — launch supports one quote at a time; if the customer wants changes, admin releases back to `admin_reviewing` and re-quotes.
- Public showcase gallery sourced from past converted custom orders — opt-in per customer.

---

## B.2 Orders Management

### B.2.1 Order lifecycle
- **Build:** richer status model, separating **fulfillment** from **payment**:
  - `orders.status enum('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled','refunded','on_hold','failed')`
  - `orders.payment_status enum('unpaid','paid','partially_refunded','refunded','failed')`
  - Server-enforced **transition rules** (e.g., can't go `completed → preparing`) via a guard in the update RPC.
  - `order_status_history(order_id, from_status, to_status, changed_by, note, created_at)` audit trail.
- **Relevance:** High. Maps cleanly to a bakery flow (the current `baking` becomes `preparing`).

### B.2.2 Real-time order notifications + toasts
- **Build:** a proper realtime notification system:
  - **Recommended:** "**Broadcast from the database**" — a trigger on `orders` (INSERT + status UPDATE) calls `realtime.broadcast_changes` to a private `admin-orders` topic, with **RLS on `realtime.messages`** so only staff/admin can subscribe. This scales better and authorizes better than raw `postgres_changes`. (Document the `postgres_changes` fallback.)
  - A **global toast system** (e.g., a `<Toaster/>` provider) shows "New order #1234 — Rs. 4,500" on insert and "Order #1234 → out for delivery" on status change, with sound/desktop-notification opt-in.
  - Wire realtime into **both** the dashboard and the orders list (today only the dashboard listens).
- **Relevance:** High — explicitly requested.

### B.2.3 Order detail, manual status updates, refunds/cancellations
- **Build:** `/admin/orders/[id]` detail view: customer + addresses, line items with snapshots, totals breakdown (subtotal/discount/tax/shipping), payment & fulfillment timeline, internal notes, and actions (advance status, cancel, **refund** — full or partial via `refunds` table; restock toggle). All mutations via server actions with transition guards + history writes.
- **Relevance:** High. Today the orders page is a flat table with a status `<select>` and no detail view.

## B.3 Users & Customer Management

### B.3.1 Roles & permissions (admin / staff / customer)
- **Build:** `profiles.role enum('customer','staff','admin')` (extensible to `manager`). `staff` can manage orders/products but not settings/users; `admin` full. Enforced in **both** RLS (`has_role()`) and UI/route guards. (Optional future: granular `permissions` table if roles aren't enough.)
- **Relevance:** High — requested; replaces the single hard-coded admin.

### B.3.2 Customer profiles, addresses, order history
- **Build:** `profiles` (name, phone, marketing opt-in, created_at) auto-created on signup via an `auth.users` trigger; `addresses(user_id, label, line1, line2, city, area, postal, phone, is_default_shipping, is_default_billing)`. Customer-facing `/account` with profile, **saved addresses**, and **order history** (real, RLS-scoped — not the current orders-table aggregation).
- **Relevance:** High. Today "customers" are *derived* from the orders table; there is no profile entity.

### B.3.3 Authentication flow review (Supabase Auth)
- **Build:** unify on Supabase Auth with: email confirmation **on**, password reset & "forgot password," optional OTP/magic-link, min password length ≥ 8, OAuth (Google) optional. Clear cart on logout; server session refresh via SSR middleware. Single auth surface (currently there are two: `UserAuthPopup` for shoppers and `/admin/login` for admin).
- **Relevance:** High. Current gaps: no reset/verify, weak password policy, client-only sessions.

## B.4 Inventory Management

- **Build:**
  - **Stock ledger:** `inventory_movements(variant_ref, delta, reason enum('order','restock','adjustment','refund','cancellation'), order_id, created_by, created_at)` — every stock change is an auditable row; current quantity is derived/maintained from it. Prevents the "decrement got lost" class of bug.
  - **Transactional decrement at checkout** inside the `create_order` RPC (row-lock the stockable unit; reject/backorder if insufficient).
  - **Low-stock alerts:** a scheduled job (pg_cron / Edge Function) or a trigger that, when `stock_quantity <= low_stock_threshold`, raises an admin notification (`notifications` table + realtime toast + optional email).
  - **Out-of-stock / backorder handling** per the product flags in §B.1.4; storefront shows badges and disables/relabels the buy button accordingly.
- **Relevance:** High for stocked items; bakeries can opt specific products into "made to order" (no tracking).

## B.5 Secondary Commerce Features

| Feature | Build | Relevance / Notes |
|---|---|---|
| **Coupons / discounts** | `coupons` (code, type `percent`/`fixed_cart`/`fixed_product`/`free_shipping`, value, min spend, usage limits, per-user limit, product/category restrictions, expiry) + `coupon_redemptions`. **Validated & applied server-side** in checkout (replaces hard-coded `KAKEEZ10`/`WELCOME`). | High — promos already exist but are client-trusted. |
| **Tax** | `tax_rates` (name, rate, region, compound?) + per-order tax snapshot. Configurable inclusive/exclusive. Compute server-side at checkout. | Medium — Pakistan sales tax/GST; start with one configurable rate. |
| **Shipping / delivery** | `delivery_zones` (city/area/postal patterns) + `delivery_methods` (flat fee, free over X, per-zone, pickup). Replaces hard-coded `Rs.99`. Optional delivery-time-slot selection (relevant for fresh cakes). | High — local delivery is core. Skip carrier APIs. |
| **Reviews & ratings** | `product_reviews(product_id, user_id, rating 1–5, title, body, status, verified_purchase, created_at)`; aggregate rating cached on product. Admin moderation queue. Replaces the hard-coded `43 reviews` / `stars.svg`. | Medium-high — social proof; needs moderation. |
| **Wishlists** | `wishlists` / `wishlist_items` (user_id, product_id). Guest wishlist in localStorage, merged on login. | Medium. |
| **Search & filtering** | Postgres FTS (`tsvector` on name/description/tags) + trigram for fuzzy; faceted filters (category, price range, attributes, rating, in-stock). Server-driven, URL-as-state. Replaces the inert search icon in the navbar. | High — no search exists today. |
| **Reporting / analytics** | SQL views / materialized views + an `/admin/reports` dashboard: revenue over time, AOV, top products, low-stock, new vs returning customers, coupon usage, conversion funnel (if events tracked). Replaces client-side `reduce()` stats. | Medium-high. |
| **Payment gateway integration** | **DEFERRED to post-launch.** Decision locked: COD-only at launch. Card / JazzCash / Easypaisa UI is removed in Phase 0, not just disabled. The `payments` table ships shaped so adding a PSP later is additive (CHECK widening + enum extension, no restructure). Full operational design — checkout RPC, payment_status convention, rider outcomes, fraud guards, cash reconciliation — is in **[§G.X](#gx-cod-only-operations-locked-in-scope-at-launch)**. | **HIGH (COD ops). PSP integration: post-launch.** |
| **Email notifications** | Transactional emails (order confirmation, status updates, shipping/out-for-delivery, password reset, low-stock to admin, abandoned cart optional) via Resend/SMTP, triggered from server actions/edge functions; templated; failures must not corrupt orders. | High. |
| **SEO fields per product** | `products.slug` (unique), `seo_title`, `seo_description`, `og_image`; storefront `generateMetadata`, `sitemap.ts`, `robots.ts`, JSON-LD `Product`/`Offer`/`AggregateRating`, canonical URLs, `noindex` on admin/checkout/account. | High — none exist today. |

---

# Part C — Database Schema Plan

> Design-level DDL sketches (illustrative, **not** final migrations). Conventions: `uuid` PKs (`gen_random_uuid()`), **money as `integer` minor units** (paisa) named `*_minor`, `timestamptz` with `created_at`/`updated_at` (+ `updated_at` trigger), soft-delete via status/`deleted_at` rather than hard delete for catalog/orders, every table RLS-enabled.

### C.1 Identity, roles, customers

```sql
profiles (
  id uuid pk references auth.users(id) on delete cascade,
  full_name text, phone text,
  role text not null default 'customer'    -- check in ('customer','staff','admin')
    check (role in ('customer','staff','admin')),
  marketing_opt_in boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
)
-- trigger: on auth.users insert -> insert profile(role='customer')

addresses (
  id uuid pk, user_id uuid references profiles(id) on delete cascade,
  label text, recipient_name text, phone text,
  line1 text, line2 text, area text, city text, postal_code text,
  is_default_shipping boolean default false, is_default_billing boolean default false,
  created_at timestamptz default now()
)
```

### C.2 Catalog: categories, tags, attributes

```sql
categories (
  id uuid pk, parent_id uuid references categories(id) on delete restrict,  -- nesting; RESTRICT not CASCADE
  name text not null, slug text unique not null, description text,
  image_path text, position int default 0,
  created_at timestamptz default now()
)

tags (id uuid pk, name text not null, slug text unique not null)

attributes (                              -- e.g., "Size", "Flavor"
  id uuid pk, name text not null, slug text unique not null,
  is_variation boolean default true       -- used to build variations vs informational
)
attribute_values (                        -- e.g., "1 lb", "Chocolate"
  id uuid pk, attribute_id uuid references attributes(id) on delete cascade,
  value text not null, slug text not null, position int default 0,
  unique (attribute_id, slug)
)
```

### C.3 Products, images, variations, downloads, meta

```sql
products (
  id uuid pk,
  type text not null default 'physical' check (type in ('physical','digital','virtual')),
  status text not null default 'draft'   check (status in ('draft','published','archived')),
  name text not null, slug text unique not null,
  short_description text, description text,
  price_minor integer not null check (price_minor >= 0),     -- simple-product base price
  sale_price_minor integer check (sale_price_minor >= 0),
  sale_starts_at timestamptz, sale_ends_at timestamptz,
  sku text unique,
  track_inventory boolean default false,                     -- bakeries: often false (made to order)
  stock_quantity integer default 0,
  low_stock_threshold integer default 0,
  backorder_policy text default 'no' check (backorder_policy in ('no','notify','yes')),
  stock_status text default 'in_stock' check (stock_status in ('in_stock','out_of_stock','on_backorder')),
  weight_grams integer, is_featured boolean default false,
  seo_title text, seo_description text, og_image_path text,
  rating_avg numeric(2,1) default 0, rating_count integer default 0,  -- denormalized cache
  published_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
)

product_categories (product_id uuid references products(id) on delete cascade,
                    category_id uuid references categories(id) on delete cascade,
                    primary key (product_id, category_id))      -- many-to-many

product_tags (product_id, tag_id, primary key (product_id, tag_id))

product_images (
  id uuid pk, product_id uuid references products(id) on delete cascade,
  storage_path text not null, alt text, position int default 0,
  is_featured boolean default false
)

product_attributes (                       -- which attributes this product uses
  product_id uuid references products(id) on delete cascade,
  attribute_id uuid references attributes(id) on delete cascade,
  primary key (product_id, attribute_id)
)

product_variations (
  id uuid pk, product_id uuid references products(id) on delete cascade,
  sku text unique, price_minor integer not null check (price_minor >= 0),
  sale_price_minor integer,
  track_inventory boolean default true, stock_quantity integer default 0,
  low_stock_threshold integer default 0,
  stock_status text default 'in_stock',
  image_id uuid references product_images(id) on delete set null,
  weight_grams integer, position int default 0,
  is_active boolean default true
)
variation_attribute_values (               -- the combination that defines a variation
  variation_id uuid references product_variations(id) on delete cascade,
  attribute_id uuid references attributes(id),
  attribute_value_id uuid references attribute_values(id),
  primary key (variation_id, attribute_id)
)

product_downloads (id uuid pk, product_id uuid, storage_path text, name text)  -- digital only
product_meta (product_id uuid, key text, value text, type text default 'text', -- allergens, serves...
              primary key (product_id, key))
```

### C.4 Cart (server-side, optional but recommended), orders, items, history

```sql
-- Optional server cart (enables abandoned-cart + cross-device). MVP can stay client-side.
carts (id uuid pk, user_id uuid references profiles(id), session_token text, created_at, updated_at)
cart_items (id uuid pk, cart_id uuid, product_id uuid, variation_id uuid, quantity int check (quantity > 0))

orders (
  id uuid pk,
  order_number text unique not null,        -- human-friendly (e.g., KKZ-000123), generated server-side
  user_id uuid references profiles(id),     -- ownership by uid, not email
  email text not null, phone text,          -- snapshot for guest/contact
  status text not null default 'pending'
    check (status in ('pending','confirmed','preparing','ready','out_for_delivery',
                      'completed','cancelled','refunded','on_hold','failed')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','partially_refunded','refunded','failed')),
  payment_method text,                      -- 'cod' | 'stripe' | 'jazzcash' | ...
  -- money snapshots (all server-computed, integer minor units):
  subtotal_minor integer not null, discount_minor integer not null default 0,
  tax_minor integer not null default 0, shipping_minor integer not null default 0,
  total_minor integer not null check (total_minor >= 0),
  currency text not null default 'PKR',
  coupon_code text,
  shipping_address jsonb, billing_address jsonb,    -- snapshots at purchase time
  delivery_method text, delivery_slot tstzrange,    -- optional time-slot
  customer_note text, is_gift boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now()
)

order_items (
  id uuid pk, order_id uuid references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  variation_id uuid references product_variations(id) on delete set null,
  -- SNAPSHOTS (so order history is immutable even if catalog changes):
  name_snapshot text not null, sku_snapshot text, image_path_snapshot text,
  attributes_snapshot jsonb,                 -- {"Size":"2 lb","Flavor":"Chocolate"}
  unit_price_minor integer not null check (unit_price_minor >= 0),
  quantity integer not null check (quantity > 0),
  line_total_minor integer not null
)

order_status_history (
  id uuid pk, order_id uuid references orders(id) on delete cascade,
  from_status text, to_status text not null,
  changed_by uuid references profiles(id), note text, created_at timestamptz default now()
)
```

### C.5 Commerce: coupons, tax, shipping, payments, refunds, inventory, reviews, wishlist, notifications

```sql
coupons (
  id uuid pk, code text unique not null,
  type text check (type in ('percent','fixed_cart','fixed_product','free_shipping')),
  value_minor integer, percent numeric(5,2),
  min_spend_minor integer, usage_limit integer, usage_limit_per_user integer,
  starts_at timestamptz, expires_at timestamptz, is_active boolean default true
)
coupon_restrictions (coupon_id uuid, product_id uuid, category_id uuid)   -- optional scoping
coupon_redemptions (id uuid pk, coupon_id uuid, order_id uuid, user_id uuid, created_at)

tax_rates (id uuid pk, name text, rate numeric(5,2), region text, is_compound boolean default false, is_active boolean)

delivery_zones (id uuid pk, name text, match_type text, match_values text[])   -- by city/area/postal
delivery_methods (id uuid pk, zone_id uuid, name text,
                  type text check (type in ('flat','free_over','pickup')),
                  fee_minor integer, free_over_minor integer, is_active boolean)

payments (
  id uuid pk, order_id uuid references orders(id),
  provider text, provider_ref text,           -- e.g. Stripe PaymentIntent id
  amount_minor integer not null, currency text default 'PKR',
  status text check (status in ('pending','succeeded','failed','refunded')),
  raw jsonb, created_at timestamptz default now()
)
refunds (id uuid pk, order_id uuid, payment_id uuid, amount_minor integer,
         reason text, restock boolean default true, created_by uuid, created_at timestamptz default now())

inventory_movements (
  id uuid pk, product_id uuid, variation_id uuid,
  delta integer not null, reason text check (reason in ('order','restock','adjustment','refund','cancellation')),
  order_id uuid, created_by uuid, created_at timestamptz default now()
)

product_reviews (
  id uuid pk, product_id uuid references products(id) on delete cascade,
  user_id uuid references profiles(id), order_id uuid,
  rating int not null check (rating between 1 and 5),
  title text, body text, verified_purchase boolean default false,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
)

wishlists (id uuid pk, user_id uuid unique references profiles(id) on delete cascade)
wishlist_items (wishlist_id uuid, product_id uuid, primary key (wishlist_id, product_id))

notifications (                       -- admin/staff inbox + drives realtime toasts
  id uuid pk, audience text default 'admin', type text, title text, body text,
  data jsonb, read_at timestamptz, created_at timestamptz default now()
)

store_settings (key text primary key, value jsonb)   -- replaces the stub settings page
```

### C.6 RLS strategy (summary)

| Table(s) | Public (anon) | Customer (authenticated) | Staff | Admin |
|---|---|---|---|---|
| `products` (published), `product_images`, `categories`, `tags`, `attributes`, `attribute_values`, `product_reviews`(approved) | **SELECT** where `status='published'` / `approved` | same | full | full |
| `products`(all statuses), variations, meta, downloads | — | — | manage | manage |
| `profiles` | — | **own** row select/update (not `role`) | read all | manage all (role changes admin-only) |
| `addresses`, `wishlists`, `wishlist_items`, `carts` | — | **own** rows CRUD | — | read |
| `orders`, `order_items`, `order_status_history` | — | **own** SELECT only (by `user_id`); **no direct INSERT** | manage all | manage all |
| `coupons`, `tax_rates`, `delivery_*`, `store_settings` | read active subset (for storefront pricing) | read | manage | manage |
| `payments`, `refunds`, `inventory_movements` | — | own payments read (own orders) | manage | manage |
| `product_reviews` | read approved | **insert own** (verified-purchase enforced server-side), read own | moderate | moderate |
| `notifications` | — | — | read | read |

**Core RLS principles:**
- Writes that carry money or stock (orders, payments, inventory, redemptions) are **not** directly insertable by clients — they go through `SECURITY DEFINER` RPCs / server actions using the service-role client. RLS then mostly governs **reads**.
- `has_role(uid, role)` / `is_staff()` / `is_admin()` helper functions read `profiles.role` by `auth.uid()` (never JWT email).
- Ownership everywhere via `user_id = auth.uid()`.
- All helper functions are `STABLE SECURITY DEFINER SET search_path = public` with minimal logic to keep RLS fast.

---

# Part D — Supabase Optimization

### D.1 Indexing strategy
- **Foreign keys:** index every FK used in joins/filters — `product_categories(category_id)`, `product_images(product_id)`, `product_variations(product_id)`, `order_items(order_id)`, `orders(user_id)`, `inventory_movements(product_id, variation_id)`, `coupon_redemptions(coupon_id,user_id)`.
- **Hot query paths:** `products(status, published_at desc)` partial index `WHERE status='published'`; `orders(status) WHERE status not in ('completed','cancelled')` (active-orders dashboard); `orders(created_at desc)`; `orders(order_number)` unique.
- **Search:** `GIN` on a generated `tsvector` (name + description + tags); `pg_trgm GIN` on `products.name` for fuzzy/autocomplete. Enable `pg_trgm`.
- **Uniqueness:** `products.slug`, `categories.slug`, `coupons.code`, `sku` columns.
- **Avoid over-indexing** write-heavy tables (`inventory_movements`) — index only what reports/joins need.

### D.2 RLS performance
- Wrap `auth.uid()`/`auth.jwt()` calls so they evaluate once per query: `(select auth.uid())` form, and prefer helper functions marked `STABLE`.
- Keep policies **sargable** — compare indexed columns (`user_id = (select auth.uid())`) rather than per-row subqueries where avoidable; for `order_items`, store `user_id` denormalized (or join on indexed `order_id`) to avoid correlated `EXISTS` per row at scale.
- Use `TO authenticated` / `TO anon` role targeting so policies short-circuit by role.
- Benchmark with `EXPLAIN (ANALYZE)` against seed data; add covering indexes where RLS predicates dominate.

### D.3 Storage bucket organization
- Buckets: **`product-images`** (public read, admin/staff write), **`category-images`** (public), **`review-media`** (public, user-write own path), **`downloads`** (**private**, signed-URL delivery for digital products), **`order-attachments`** (private — custom-cake reference images).
- Path convention: `product-images/{product_id}/{uuid}.{ext}`; enforce **server-side** MIME/size validation (PNG/JPG/WebP/AVIF, ≤ 5 MB) and **crypto-random** filenames (replace `Math.random()`). Use storage RLS keyed to `is_staff()`/`is_admin()` and, for user buckets, to `auth.uid()` path prefixes.
- Consider Supabase **image transformation** (Pro) for responsive sizes instead of shipping full-res originals to `next/image`.

### D.4 Database functions/triggers vs Edge Functions
- **In-DB (Postgres functions / triggers / RPC):** order creation & total computation (`create_order`), stock decrement + `inventory_movements`, coupon validation/redemption, `updated_at` triggers, `order_status_history` writes, rating-aggregate maintenance, realtime broadcast triggers, `order_number` generation, `profile` auto-create on signup. Keep money/stock logic here so it's atomic and transactional.
- **Edge Functions (Deno):** anything touching the outside world or secrets — **payment webhooks** (signature verification, idempotency), sending **transactional email** (Resend), generating **signed download URLs**, scheduled jobs not suited to `pg_cron`. Never put provider secrets in the DB/client.
- **Scheduled:** `pg_cron` for low-stock sweeps, abandoned-cart detection, sale price start/end flips, report materialized-view refresh.

### D.5 Realtime channel design
- **Admin order feed:** trigger-based **Broadcast from Database** (`realtime.broadcast_changes`) to a private topic (e.g., `topic:admin-orders`) on `orders` INSERT and status UPDATE, with **RLS on `realtime.messages`** restricting subscription to `is_staff()`/`is_admin()`. Preferred over `postgres_changes` for authorization + scale.
- **Per-customer order tracking:** topic `topic:order:{order_id}` (or `topic:user:{uid}`) so a customer sees their order status change live; RLS limits to the owner.
- **Inventory/low-stock:** broadcast low-stock events to the admin topic; render as toasts from the global notification provider.
- **Client hygiene:** one channel per concern, unsubscribe on unmount (the dashboard already does `removeChannel`), debounce stat refetches (today every insert triggers a full `fetchDashboardData()` — switch to applying the payload + periodic reconcile).

---

# Part E — Frontend Architecture Plan

### E.1 Guiding shift
Move from "**100% client components + anon client in `useEffect`**" to a **server-first** App Router architecture: Server Components fetch public catalog data (SEO + caching + no waterfalls); Client Components handle interactivity (cart, filters, modals); all mutations go through **Server Actions / Route Handlers** with **Zod** validation and the cookie-aware server client.

### E.2 Proposed structure

```
src/
  app/
    (storefront)/
      layout.tsx                      storefront shell (Navbar/Footer, server)
      page.tsx                        home (server: catalog query, no N+1)
      shop/page.tsx                   product listing + filters (server + URL state)
      product/[slug]/page.tsx         server fetch + generateMetadata + JSON-LD + notFound()
      category/[slug]/page.tsx
      cart/page.tsx, checkout/page.tsx
      account/(profile|orders|addresses|wishlist)/page.tsx
      sitemap.ts, robots.ts, opengraph-image.tsx
    (auth)/login, /register, /forgot-password, /reset-password
    admin/
      layout.tsx                      SERVER guard (role check) + client chrome
      page.tsx (dashboard), products/, products/[id]/, orders/, orders/[id]/,
      categories/, attributes/, customers/, coupons/, reviews/, reports/, settings/
    api/
      webhooks/payment/route.ts       (or Edge Function)
  components/
    storefront/ (ProductCard, Gallery, VariationPicker, CartDrawer, FilterSidebar, ...)
    admin/      (DataTable, OrderTimeline, ImageUploader, BulkActions, StatCard, ...)
    ui/         (Button, Toast/Toaster, Dialog, Form fields — design-system primitives)
  lib/
    supabase/ { browser.ts, server.ts, admin.ts }
    money.ts            (minor-unit helpers + PKR formatting)
    validation/         (zod schemas: product, order, checkout, coupon, address)
    queries/            (typed read functions, server)
    actions/            (server actions: checkout, admin CRUD, reviews, ...)
  store/
    useCart.ts          (persist ONLY {productId, variationId, qty} — never price)
  types/
    database.ts         (generated via `supabase gen types typescript`)
```

### E.3 Data fetching & caching
- **Public catalog:** Server Components with tag-based caching; `revalidateTag('products')` after admin writes. Replace the homepage N+1 with a single joined/aggregated query (or a `products_with_featured_image` view).
- **Account/admin:** dynamic, `no-store`, server-side session required.
- **Storefront interactivity:** keep client islands (cart drawer, variation picker, filters); fetch live price/stock at **render** server-side and **re-validate at checkout** server-side.
- **Types:** generate `Database` types from the schema; eliminate `any`.

### E.4 State management
- **Server state:** Server Components + (optionally) TanStack Query for client-side admin tables. Do **not** mirror server data into Zustand.
- **Client state:** Zustand for cart **draft only** (ids + qty + selected options), with a `version` for migrations and cart-merge-on-login. Clear on logout.
- **URL state:** filters, sort, pagination, search, active category, active tab → search params (shareable, server-readable).
- **Forms:** React Hook Form + Zod resolver; same Zod schemas reused in server actions.

### E.5 Design-system note (per repo `web/design-quality` rules)
The current storefront is a single pixel-mapped `vw` layout — beautiful but unmaintainable and not responsive. As features land, migrate page-by-page to a **token-driven, responsive** layout (CSS variables for the existing brown/green palette + the Cormorant/Playfair/Space Grotesk pairing via `next/font`), keeping the established visual identity while removing absolute-`vw` positioning and `dangerouslySetInnerHTML` height hacks.

---

# Part F — Phased Roadmap

Each phase is independently shippable and leaves the store in a working state. Security/architecture phases (0–2) come first by necessity.

### Phase 0 (revised) — Clean Schema Rebuild with ETL of 88 Live Products

> v1's Phase 0 assumed additive `ALTER` migrations. With the user's "anything good for the project" mandate and three locked decisions (variations YES, COD-only, schema rebuild ALLOWED), Phase 0 is **rewritten as a drop-and-recreate rebuild** with an in-DB ETL that preserves the 88 real products and the 4 categories. The 1 stale order with 0 line items is archived as cold evidence of the non-transactional checkout bug (it must never replay against the new RPC). Full detail in [F.0 below](#f0-phase-0-revised--clean-schema-rebuild-with-etl-of-88-live-products).

**Phase 0 in one breath:** snapshot prod → reconcile drift → drop legacy → create new schema (Part C / B.1.X / B.1.Y / G.X) → ETL 88 products → seed COD-only defaults → role-based RLS → smoke-test → tear down legacy staging. PR-by-PR, expected to take 4–6 sittings.

**Exit criteria:**
- Zero default credentials (the committed `admin/admin` seed is deleted).
- Zero schema drift (`supabase migration list` shows local == remote).
- 88 products live and shoppable via anon read; orders/payments writes go only through `SECURITY DEFINER` RPCs.
- COD-only is hard-enforced at the DB layer (CHECK constraint on `payment_method`), not just hidden in UI.
- Storage bucket `products` retained; 88 image URLs still resolve.
- `@supabase/ssr` 3-client pattern in code; admin/checkout routes server-protected; types generated; CI green.

### Phase 1 — Secure Core Commerce *(make today's flow trustworthy)*
- Transactional `create_order` RPC: server recomputes subtotal/discount/tax/shipping, validates stock/status, writes order + snapshotted items atomically; revoke client `INSERT` on orders/order_items.
- Cart store persists ids/qty/options only; checkout re-validates server-side.
- Constraints + indexes from Part C/D; `orders.user_id`; richer order status + history; product `status` + slug.
- **Exit:** localStorage tampering cannot change totals; no orphan orders; drafts hidden from public.

### Phase 2 — Catalog Depth (Products) 
- Multi-image gallery (+ featured, ordering, alt); categories nested + many-to-many; tags; attributes/values.
- Variable products + variations (price/SKU/stock/image per variation); product types; product meta/custom fields.
- Admin: product editor revamp, **bulk actions**, draft/publish/archive, safe category delete (RESTRICT/reassign), server-validated image upload.
- Storefront: `/shop`, `/category/[slug]`, `/product/[slug]` server-rendered + `notFound()` + variation picker.
- **Exit:** simple & variable products fully manageable and shoppable; catalog SEO-ready.

### Phase 3 — Inventory & Orders Operations
- Inventory ledger + transactional decrement/restock; low-stock thresholds, backorders, out-of-stock UI.
- Order detail view, transition rules, cancellations/refunds (+ restock), internal notes.
- **Realtime + toasts:** broadcast-from-DB on insert/status-change to a private admin topic; global `<Toaster/>`; wire dashboard **and** orders list; per-customer order tracking.
- **Exit:** stock is accurate & auditable; admins get live order toasts; full order lifecycle manageable.

### Phase 4 — Customers, Accounts & Auth
- Real `profiles` + addresses; `/account` (profile, addresses, order history, wishlist).
- Auth hardening: email confirm on, password reset/forgot, ≥8-char policy, optional OAuth; cart clear on logout; staff role management UI.
- **Exit:** customers manage their own data; staff/admin separation enforced end to end.

### Phase 5 — Checkout Economics (Coupons, Tax, Shipping, Payments)
- Server-side coupons (replace hard-coded promos), tax rates, delivery zones/methods (replace `Rs.99`), optional delivery slots.
- Payments: COD hardened; **if approved**, integrate provider(s) with verified idempotent webhooks as payment-status source of truth; `payments`/`refunds`.
- Transactional emails (order confirmation, status updates, password reset) via Resend/Edge Functions.
- **Exit:** accurate server-computed pricing; payments reconciled by webhook; customers/admins emailed.

### Phase 6 — Growth Features (Reviews, Wishlist, Search, Reporting, SEO)
- Reviews + moderation + rating aggregates (replace fake `43 reviews`); wishlists; FTS + faceted search/filter (activate the navbar search).
- `/admin/reports` analytics (views/materialized views); full SEO (`sitemap`, `robots`, JSON-LD, per-product metadata); accessibility & responsive layout migration; performance pass (CWV).
- **Exit:** WooCommerce-parity feature surface; discoverable, measurable, accessible store.

> **Sequencing flexibility:** Phase 5 payments can be deferred (launch COD-only) without blocking 6. Phase 6 sub-features are independently shippable. Phases 0–1 cannot be reordered.

---

## F.0 Phase 0 (revised) — Clean Schema Rebuild with ETL of 88 Live Products

The detailed step-by-step for the Phase 0 summary above.

### 0.0 Why clean rebuild beats additive `ALTER` on this codebase

Additive migration was tempting because the table count is small, but four structural mismatches make `ALTER` strictly more work than rebuild:

1. **Money type changes shape.** `price decimal(10,2)` → `price_minor integer` is a *value transformation* (`ROUND(price * 100)`), not a column rename. It has to be done row-by-row regardless, so it might as well be done in ETL.
2. **Category cardinality changes.** `products.category_id uuid` (1:1) → `product_categories(product_id, category_id)` (M:M, with nested `categories.parent_id`). An additive path would leave the legacy FK column dangling with `NOT NULL` semantics that the new code does not honor, then require a second cleanup migration to drop it. ETL writes the join row once and is done.
3. **Variations introduce a new stockable unit.** The current `products.stock_quantity` becomes ambiguous the moment a product has variations. The new schema moves stock to `product_variations.stock_quantity` and adds `products.track_inventory` to gate the legacy semantic. Trying to bolt this on while preserving the old column produces two sources of truth during the transition.
4. **RLS is built on `is_admin()` reading `auth.users.email IN ('admin@kakeez.com')`.** Replacing that with `has_role(uid, 'admin')` reading `profiles.role` requires `DROP POLICY` on every table anyway. Once you have to drop every policy, the marginal cost of dropping the tables underneath them is near zero.

Rebuild also lets us **fix the seeded admin password footgun** in the same Phase 0 PR rather than as a separate scary "rotate prod creds" PR later.

### 0.1 Drift reconciliation up front

Remote migration history has one row that the repo does not: `20260619000000` (DROPs a previously-attempted WooCommerce-style schema — `product_galleries`, `attributes`, `attribute_terms`, `product_attributes`, `product_variations`, `variation_options`, `product_links`, `product_category_mapping` — and removes columns `type`, `sku`, `regular_price`, `sale_price`, `manage_stock`, `status` from `products`). **It does not create the `profiles` table observed on remote.** That means `profiles` was created manually in Studio outside the migration system at some point — we must inspect its actual column set before writing 0001/0002, because re-creating it in 0002 will fail with `relation already exists` if we don't drop it first.

### 0.2 Step sequence

Steps run **in order**. Each has explicit acceptance criteria. Steps b, d, e, f, g, h are committed migrations; the rest are operational.

#### a) Backup — Supabase point-in-time snapshot

- Supabase Dashboard → Project `crzqqvbvaguttrkzvpqh` → Database → Backups → **Create on-demand backup**.
- If on Free tier (no PITR): manual `pg_dump`-equivalent via Studio SQL editor `COPY ... TO STDOUT` of `products`, `categories`, `orders`, `order_items`, `profiles` → `supabase/backups/2026-06-17-pre-rebuild.sql` (worktree only, gitignored from history but kept locally).
- **Acceptance:** backup ID (or filename) pasted into the Phase 0 PR description before any `DROP` executes.

#### b) Reconcile drift — capture `20260619000000` into the repo

`supabase db dump --schema public` exits silently on Windows (pg_dump version mismatch). Workaround:

1. Studio → SQL editor → `SELECT version, name, statements FROM supabase_migrations.schema_migrations WHERE version = '20260619000000';` — copy `statements` verbatim.
2. Paste into `supabase/migrations/20260619000000_remote_drift_capture.sql` with a header comment: `-- Captured from remote on 2026-06-17, source: supabase_migrations.schema_migrations`.
3. Inspect the unmanaged `profiles` table: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles';` — paste a `CREATE TABLE` reconstruction as a comment block at the bottom of the same file.
4. `supabase migration repair --status applied 20260619000000` is NOT needed here (the row is already on remote); the goal is to make the repo file system match the remote ledger so `supabase db push --dry-run` reports "no diff".

- **Acceptance:** `supabase migration list` shows zero remote-only and zero local-only rows; the drift-capture file is committed.

#### c) Decide REBUILD-IN-PLACE vs NEW PROJECT — **recommend in-place**

- **In-place** (recommended): keep project ref `crzqqvbvaguttrkzvpqh`, keep the existing storage bucket `products` (88 product images live there, ETL preserves product UUIDs so existing `image_url` paths stay valid), keep the existing auth users table (rotate the admin password, demote it from email-based admin to role-based admin in `profiles`).
- **New project**: rejected. Would require regenerating the storage bucket and re-uploading 88 product images, regenerating anon/service keys (env churn across the Next.js app, Vercel env, dev `.env.local`), and a manual DNS / Supabase URL cutover. The destructive-`DROP`-against-prod risk is mitigated by step (a)'s PITR snapshot.
- **Acceptance:** decision recorded in the Phase 0 PR description: **in-place rebuild, project `crzqqvbvaguttrkzvpqh`, storage bucket `products` retained (renamed in Phase 6).**

#### d) Migration `20260617000001_drop_legacy.sql`

Order matters (FKs):

1. `CREATE SCHEMA IF NOT EXISTS _legacy_staging;`
2. `CREATE TABLE _legacy_staging.products AS SELECT * FROM public.products;` (88 rows).
3. `CREATE TABLE _legacy_staging.categories AS SELECT * FROM public.categories;` (4 rows).
4. `CREATE TABLE _legacy_staging.orders AS SELECT * FROM public.orders;` (1 row, archival evidence of the non-transactional checkout bug).
5. `CREATE TABLE _legacy_staging.order_items AS SELECT * FROM public.order_items;` (0 rows, shape only).
6. **Explicit drop list** — every drop named:
   - `DROP POLICY IF EXISTS ... ON public.products;` (and on `categories`, `orders`, `order_items`, `profiles`) — every policy by name from the live DB, to avoid silent policy survival.
   - `DROP TABLE public.order_items;`, `DROP TABLE public.orders;`, `DROP TABLE public.products;`, `DROP TABLE public.categories;`, `DROP TABLE IF EXISTS public.profiles;`.
   - `DROP FUNCTION IF EXISTS public.is_admin();` — the email-based admin gate.
   - `DELETE FROM auth.users WHERE email = 'admin@kakeez.com';` — the seeded admin. New admin via Studio in step g.
   - `DROP TRIGGER IF EXISTS handle_new_user ON auth.users; DROP FUNCTION IF EXISTS public.handle_new_user();` (if present from the unmanaged work).
7. Header comment enumerates each drop in plain English so review can match the file against this list.

- **Acceptance:** `\dt public.*` returns empty; `\dt _legacy_staging.*` returns 4 tables; `_legacy_staging.products` has 88 rows; `_legacy_staging.categories` has 4.

#### e) Migration `20260617000002_create_new.sql` — full new schema

The canonical schema from Part C / B.1.X / B.1.Y / G.X, **with Phase 0 corrections baked in from day one** (not deferred to a Phase 1 ALTER). Table groups:

- **Identity & roles** — `profiles(id, role check (role in ('customer','staff','admin')) default 'customer', full_name, phone, default_address_id, created_at, updated_at)`. Trigger `handle_new_user` on `auth.users` insert → `profiles` row with `role='customer'`. `has_role(uid, required)` SECURITY DEFINER reads `profiles.role`; `is_staff()`, `is_admin()` are thin wrappers (same names as old `is_admin()` so leftover policy references fail loudly, not silently pass).
- **Catalog** — `categories` (with `parent_id RESTRICT not CASCADE`), `attributes`, `attribute_values`, `products` (type/status/slug/`price_minor`), `product_images`, `product_categories` M:M, `product_attributes`, `product_variations`, `variation_attribute_values`, `product_meta`. Per B.1.X (variations) and Part C.
- **Customer assets** — `addresses`, `carts`, `cart_items` (with `unit_price_minor_cached`), `wishlists`, `wishlist_items`.
- **Orders & payments (COD-only)** — `orders` (with `order_number unique`, integer minor totals, `payment_method check (payment_method = 'cod')` literal at launch, `payment_status`, `status`, `delivery_address_snapshot jsonb`, `delivery_slot_date/window`); `order_items` with full snapshots (`product_name_snapshot`, `product_sku_snapshot`, `variation_label_snapshot`, `unit_price_minor_snapshot`, `line_total_minor_snapshot`); `order_status_history`; `custom_order_requests` (per B.1.Y).
- **Pricing modifiers** — `coupons` (percent/fixed), `coupon_redemptions`, `tax_rates` (bp).
- **Delivery** — `delivery_zones` (Karachi default), `delivery_methods` (base_fee_minor 9900 = PKR 99).
- **Money movements (COD-only)** — `payments(method check (method = 'cod'), status, collected_by, collected_at, ...)`, `refunds`.
- **Ops** — `inventory_movements` (append-only ledger), `product_reviews` (with `order_id` gating verified-purchase), `notifications`.
- **COD-specific guards** — `cash_drops`, `cash_disputes`, `cod_blocklist` (per G.X.4).
- **Settings** — `store_settings(key, value jsonb)` for runtime-flippable config.
- **Indexes** — every FK gets a btree index (`idx_product_categories_category_id`, `idx_product_categories_product_id`, `idx_orders_user_id`, `idx_orders_status_created_at`, `idx_order_items_order_id`, `idx_cart_items_cart_id`, `idx_addresses_user_id`, `idx_product_images_product_id`, `idx_product_variations_product_id`, `idx_inventory_movements_product_id_created_at desc`, `idx_notifications_user_id_created_at desc` partial where `read_at is null`).
- **`updated_at` triggers** — one shared `set_updated_at()` trigger function, attached to every table with `updated_at`.

- **Acceptance:** `supabase db push` succeeds; `\dt public.*` returns the full list; `SELECT has_role(auth.uid(), 'customer')` returns `true` for any authenticated user once a `profiles` row exists.

#### f) Migration `20260617000003_etl.sql` — backfill 88 products + 4 categories from `_legacy_staging`

Order matters (categories first):

1. **Categories (4)** — `INSERT INTO public.categories (id, name, slug, image_storage_path, created_at) SELECT id, name, slug, image_url, created_at FROM _legacy_staging.categories;` (preserve `id`; `parent_id` NULL — old schema was flat).
2. **Products (88)** — for each `_legacy_staging.products` row insert one `public.products` row with:
   - `id` **PRESERVED** — critical: storage bucket paths derive from this UUID.
   - `type = 'physical'` — existing 88 are non-variable at the point of rebuild; variations get added in Phase 2 via the admin matrix builder.
   - `status = 'published'`.
   - `slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))` with a deduplication step (`slug || '-' || row_number()` for collisions — there are duplicate-named products like two "Chocolate Cake" rows in the live catalog).
   - `price_minor = ROUND(price * 100)::integer` — decimal → integer minor.
   - `track_inventory = false` — Kakeez is made-to-order; old `stock_quantity` was vestigial.
   - `stock_quantity = 0`.
   - `is_best_seller` carried; old `is_upsell` DROPPED (upsells are Phase 7 cross-sell relationships, not a per-row boolean).
   - `created_at` carried so catalog age ordering survives.
3. **Product images (88)** — `INSERT INTO public.product_images (id, product_id, storage_path, position, is_featured, created_at) SELECT gen_random_uuid(), id, image_url, 0, true, created_at FROM _legacy_staging.products WHERE image_url IS NOT NULL;`. Bucket name `products` preserved.
4. **Product → category join (88)** — `INSERT INTO public.product_categories (product_id, category_id, position) SELECT id, category_id, 0 FROM _legacy_staging.products WHERE category_id IS NOT NULL;`.
5. **Stale order archival** — the 1 order with 0 line items is **archived, not dropped**: `CREATE TABLE public.legacy_orders_archive AS SELECT *, 'pre_rebuild_evidence' AS archive_reason FROM _legacy_staging.orders;` (the legacy row would fail new `orders` CHECK constraints anyway — e.g. `total_minor integer`, `customer_phone NOT NULL`).
6. **Drop `_legacy_staging` at the end of step (i)** (after smoke tests pass), not here.

- **Acceptance:** `SELECT COUNT(*) FROM public.products = 88`; `COUNT(*) FROM public.categories = 4`; `COUNT(*) FROM public.product_images = 88`; `COUNT(*) FROM public.product_categories = 88`; every product UUID matches `_legacy_staging.products`; every `slug` unique; `SELECT price_minor FROM public.products WHERE price_minor <= 0` returns 0 rows.

#### g) Migration `20260617000004_seed.sql` — storefront-required defaults

- `INSERT INTO tax_rates (name, rate_bp, is_default) VALUES ('No tax', 0, true);` — PK retail bakery is sales-tax-exempt at this size.
- `INSERT INTO delivery_zones (name, city, status) VALUES ('Karachi', 'Karachi', 'active');`
- `INSERT INTO delivery_methods (zone_id, name, base_fee_minor, status, eta_hours) SELECT id, 'Standard Karachi delivery', 9900, 'active', 24 FROM delivery_zones WHERE name = 'Karachi';` — 99 PKR flat, matches existing site.
- `INSERT INTO store_settings (key, value) VALUES`:
  - `('currency', '"PKR"'::jsonb)`, `('brand_name', '"Kakeez"'::jsonb)`.
  - `('cod_only', 'true'::jsonb)` — flag the storefront/admin reads to hide PSP UI.
  - `('cod.first_order_max_total_minor', '500000'::jsonb)` — Rs 5,000 cap on first COD orders (per G.X.4).
  - `('cod.max_orders_per_phone_per_day', '3'::jsonb)`, `('cod.max_orders_per_ip_per_day', '5'::jsonb)`.
  - `('custom_order.max_open_per_phone', '2'::jsonb)`, `('custom_order.max_open_per_user', '3'::jsonb)`.
  - `('default_lead_time_hours', '24'::jsonb)`.
  - `('support.whatsapp_e164', '""'::jsonb)`, `('support_email', '""'::jsonb)` — set in Studio post-migration so real values aren't committed.
- **Admin user**: NOT in migration. After 0004 lands, operator creates the first admin in Studio (Authentication → Users → Add user with a real password), then Table Editor → `profiles` → set `role = 'admin'`. Intentionally manual to keep creds out of the repo. Closes the `admin/admin` footgun.

- **Acceptance:** `SELECT value FROM store_settings WHERE key = 'cod_only'` returns `true`; one default delivery method exists; one `profiles` row has `role = 'admin'`.

#### h) Migration `20260617000005_rls.sql` — role-based policies

- Enable RLS on every public table.
- **Read (anon)**: catalog tables `USING (true)`; `products` adds `AND status = 'published' AND deleted_at IS NULL`. `tax_rates`, `delivery_zones`, `delivery_methods` where `status = 'active'`.
- **Customer**: `addresses`, `carts`, `cart_items`, `wishlists`, `wishlist_items`, `notifications`, `orders`, `order_items`, `order_status_history`, `payments`, `refunds`, `custom_order_requests`, `product_reviews` → owner-scoped `user_id = auth.uid()` for `SELECT`. Writes go through RPCs.
- **Staff** (`has_role(auth.uid(), 'staff')`): full `SELECT` on order/customer/inventory tables; UPDATE on `orders.status`, `inventory_movements` INSERT, `custom_order_requests` UPDATE, `product_reviews` moderation.
- **Admin** (`has_role(auth.uid(), 'admin')`): full CRUD on catalog, settings, coupons, tax rates, delivery zones/methods, user role changes.
- **Hard revokes** (`REVOKE INSERT, UPDATE, DELETE ON ... FROM anon, authenticated`) on: `orders`, `order_items`, `payments`, `refunds`, `inventory_movements`, `coupon_redemptions`, `order_status_history`, `cash_drops`, `cod_blocklist`, `store_settings`, `tax_rates`, `delivery_zones`, `delivery_methods`, `coupons`, `profiles.role` column.
- The Phase 0 RPCs (`create_order`, `update_order_status`, `add_to_cart`, `update_cart_item`, `apply_coupon`) are stubbed as `SECURITY DEFINER` functions returning `'NOT IMPLEMENTED'` so the policy surface is correct from day one; full bodies land in Phase 1 / 3.

- **Acceptance:** smoke tests below pass.

#### i) Smoke tests — Studio SQL editor checklist

Run as anon, as a fresh customer (auth user with `profiles.role = 'customer'`), and as the admin from step (g):

1. **Anon catalog read**: `COUNT(*) FROM products` = 88, `product_images` = 88, `categories` = 4.
2. **Anon order write blocked**: `INSERT INTO orders (...)` returns `permission denied`.
3. **Customer order via RPC**: Phase-0 stub returns `'NOT IMPLEMENTED'` exactly — proves policy chain is reachable.
4. **Admin order status update**: as admin, `UPDATE orders SET status = 'confirmed' WHERE id = ?` succeeds. As anon, fails.
5. **Product slug uniqueness**: inserting a duplicate slug fails with unique violation.
6. **Money type**: `pg_typeof(price_minor)` returns `integer`.
7. **Storage paths still valid**: pick a random product, fetch its `product_images.storage_path`, open `https://crzqqvbvaguttrkzvpqh.supabase.co/storage/v1/object/public/products/<storage_path>` → image loads.
8. **Realtime**: subscribe to `orders` INSERTs in two tabs (admin dashboard simulator), confirm wire still works after table rebuild.

- **Acceptance:** all 8 pass before tearing down `_legacy_staging`. Drop staging only after **24 hours green in prod**. Keep `legacy_orders_archive` indefinitely.

#### j) Rollback plan

If any migration in (d)–(h) or any smoke test in (i) fails irrecoverably:

1. Restore from the PITR snapshot recorded in step (a) — Supabase Dashboard → Database → Backups → Restore.
2. If PITR unavailable (Free tier), restore from `supabase/backups/2026-06-17-pre-rebuild.sql` via Studio SQL editor.
3. Storefront serves a static "we'll be back shortly" page during the rebuild window. Run Phase 0 during lowest-traffic window (late Karachi night).
4. After restore, re-run drift reconciliation (step b) — the PITR snapshot may or may not include the in-flight `_legacy_staging` schema.

### 0.3 Risks called out

1. **The 1 stale order with 0 items** — *archive, not drop*. It is the only evidence the non-transactional checkout bug landed in prod, and the new RPC exists specifically to prevent its recurrence. Dropping it loses institutional memory.
2. **Orphan migration `20260619000000` and unmanaged `profiles`** — the migration content is just `DROP`s, but the *separate* unmanaged `profiles` table may carry columns the new shape does not anticipate (e.g. a `username` column added in Studio, or `loyalty_points`). **Step (b) MUST inspect and document the remote column set before step (d) drops it.** If a column carries real data, step (f) gains a sub-step to backfill.
3. **Storage bucket name "products"** — keep as-is for Phase 0. Every `image_url` references it. Rename to `product-images` deferred to Phase 6 via a single `UPDATE product_images SET storage_path = replace(storage_path, '/products/', '/product-images/')` after a Studio bucket rename.
4. **Slug collisions in ETL** — duplicate-named products exist (two "Chocolate Cake" rows). Step (f) handles with `row_number()` suffixing. Without it, the unique constraint fails the migration.
5. **`cod_only` is server-driven, not env-driven** — when Phase 6 enables JazzCash/Easypaisa, ops flips `store_settings.cod_only` in Studio without a redeploy. **The Phase 0 storefront UI must read this flag and gate payment-method selection on it from day one** — it cannot be hardcoded `cod` in the React component.
6. **Realtime existing wire** — the admin dashboard's INSERT subscription on `orders` survives `DROP TABLE` + `CREATE TABLE` only because Postgres logical replication reattaches by table name. Verify via Studio → Database → Replication after step (e); resubscribe explicitly in code if `pg_replication_slots.active = false`.
7. **`SECURITY DEFINER` RPC stubs** — return `'NOT IMPLEMENTED'` deliberately, but they run as the function owner. The function owner in Phase 0 should be a dedicated `kakeez_rpc_executor` role (not `postgres`, not `service_role`), created in 0002. Otherwise Phase 3's full RPC bodies inherit `postgres` privileges and least-privilege is broken from the start.

### 0.4 CLI workflow going forward

After Phase 0 the repo is the single source of truth:

```text
# new migration
supabase migration new <slug>
# write SQL in supabase/migrations/<timestamp>_<slug>.sql

# preview against local Postgres (Docker)
supabase db reset            # rebuilds local from migrations + seed.sql
supabase db diff             # confirms no manual local drift

# push to remote
supabase db push             # applies pending migrations to remote
supabase db push --dry-run   # preview the SQL that will run
```

**Drift repair** (one-shot, after step b's capture):

```text
supabase migration list
supabase migration repair --status applied 20260619000000
```

**Branch policy** — Supabase branches not used in Phase 0 (single-environment project). Phase 6 introduces a staging branch on the same Supabase project so payment integration can be tested without touching prod data.

**Studio is read-only for schema after Phase 0.** Any `CREATE TABLE` or `ALTER TABLE` typed into the Studio SQL editor is a drift incident — must be reverted, captured into a migration, and re-applied via `supabase db push`. The `profiles` drift caught at the start of Phase 0 is the last time this is allowed to happen.

---

# Part G — Cross-Cutting Concerns

## G.X COD-Only Operations (locked-in scope at launch)

> **Scope lock:** No PSP at launch. Cash on Delivery is the only allowed `payment_method` in Phase 0/1. Card / JazzCash / Easypaisa UI is **removed from code**, not just disabled. The `payments` table is kept (so adding a PSP later is additive, not schema-breaking) but constrained to `provider = 'cod'`.

### G.X.1 Checkout flow — server-authoritative, COD-rejecting

**Client never computes money.** The checkout page sends a thin cart payload; the RPC recomputes everything from live `product_variations` rows. The current `src/app/checkout/page.tsx` lines 62-65 compute `grandTotal` in the browser using a hardcoded `DELIVERY_CHARGE = 99` and a client-side `PROMOS` dict (lines 12-14, 67-76). All three move server-side.

```sql
create type payment_method_t as enum ('cod');  -- enum, not text, so adding 'jazzcash' later is a deliberate ALTER
create type order_channel_t   as enum ('web', 'whatsapp', 'admin_manual');

create or replace function public.create_order(
  p_cart           jsonb,         -- [{product_id, variation_id, qty, options:{option_id,...}, notes}]
  p_address        jsonb,         -- {full_name, phone_e164, line1, area, city, lat, lng, instructions}
  p_payment_method payment_method_t,
  p_promo_code     text,
  p_is_gift        boolean,
  p_channel        order_channel_t default 'web'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid       uuid := auth.uid();
  v_order_id  uuid;
  v_subtotal  bigint := 0;     -- PKR paisa
  v_delivery  bigint;
  v_discount  bigint := 0;
  v_total     bigint;
  v_item      jsonb;
  v_unit      bigint;
  v_snapshot  jsonb;
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '28000'; end if;

  -- HARD REJECT non-COD at the DB layer. UI cannot bypass.
  if p_payment_method <> 'cod' then
    raise exception 'only COD is supported at launch' using errcode = '22023';
  end if;

  perform public.assert_cod_eligible(v_uid, p_address->>'phone_e164');

  insert into orders(user_id, status, payment_status, channel, address_snapshot, is_gift)
  values (v_uid, 'pending_confirmation', 'unpaid', p_channel, p_address, coalesce(p_is_gift,false))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_cart) loop
    select compute_line_unit_minor((v_item->>'product_id')::uuid, (v_item->>'variation_id')::uuid, v_item->'options'),
           build_line_snapshot   ((v_item->>'product_id')::uuid, (v_item->>'variation_id')::uuid, v_item->'options')
      into v_unit, v_snapshot;

    insert into order_items(order_id, product_id, variation_id, qty, unit_price_minor, line_total_minor,
                            product_snapshot, options_snapshot, customer_notes)
    values (v_order_id, (v_item->>'product_id')::uuid, nullif(v_item->>'variation_id','')::uuid,
            (v_item->>'qty')::int, v_unit, v_unit * (v_item->>'qty')::int,
            v_snapshot->'product', v_snapshot->'options', v_item->>'notes');

    v_subtotal := v_subtotal + v_unit * (v_item->>'qty')::int;
  end loop;

  v_delivery := public.compute_delivery_minor(p_address);
  v_discount := public.apply_promo_minor(p_promo_code, v_uid, v_subtotal);
  v_total    := greatest(0, v_subtotal - v_discount) + v_delivery;

  update orders set subtotal_minor = v_subtotal, delivery_fee_minor = v_delivery,
                    discount_minor = v_discount, total_minor = v_total
   where id = v_order_id;

  insert into payments(order_id, provider, method, amount_minor, status)
  values (v_order_id, 'cod', 'cod', v_total, 'pending_collection');

  perform public.bump_cod_counters(v_uid, p_address->>'phone_e164', v_total);

  return v_order_id;
end $$;

revoke all on function public.create_order(jsonb,jsonb,payment_method_t,text,boolean,order_channel_t) from public;
grant execute on function public.create_order(jsonb,jsonb,payment_method_t,text,boolean,order_channel_t) to authenticated;
```

**Why this fixes the current bug:** the live `orders` table has 1 row but `order_items` has 0 — proof that the existing checkout inserts the order then fails on items without rollback. Wrapping everything in one SECURITY DEFINER plpgsql block makes it transactional by default.

### G.X.2 Order `payment_status` — convention + justification

**Convention chosen:** `payment_status` stays as a small, stable enum. We do **not** invent a `cash_collected_on_delivery` value. Instead:

```sql
create type payment_status_t as enum (
  'unpaid',                -- order placed, rider has not collected
  'paid',                  -- money is in the business's hands (rider collected OR future PSP confirmed)
  'refund_pending',        -- cancel-after-collection (rare for COD; future-proofs)
  'refunded',
  'voided'                 -- cancelled before any money moved
);
```

The "it was cash on delivery" fact is captured by `payments.method = 'cod'`, **not** by overloading `payment_status`. When a rider marks collected:

```
orders.payment_status: unpaid → paid
payments.status:       pending_collection → collected
payments.collected_at: now()
payments.collected_by: rider's user_id
```

**Why one enum for all methods:** when Phase 6 adds JazzCash, the same `payment_status='paid'` will mean "money is ours" regardless of method. The reports query `select sum(total_minor) where payment_status='paid'` keeps working. If we baked the method into the status (`cash_collected_on_delivery`), every report would need a `case` for every payment method we'll ever support — schema rot. Method is a property of the payment, not the order's lifecycle stage.

### G.X.3 Delivery outcome state machine

```sql
create type order_status_t as enum (
  'pending_confirmation',  'confirmed',  'baking',  'ready_for_dispatch',
  'out_for_delivery',  'delivered',  'failed_delivery',  'cancelled',  'disputed'
);
```

**Rider outcome → state transitions** (single RPC `rider_mark_outcome(order_id, outcome, evidence_jsonb)`):

| Rider action at door | `orders.status` | `orders.payment_status` | `payments.status` | Inventory |
|---|---|---|---|---|
| **Delivered + cash collected** | `delivered` | `paid` | `collected` (records `collected_at`, `collected_by`, `collected_amount_minor`) | none — already decremented at `confirmed` |
| **Delivered + customer refused at door** | `cancelled` (reason=`refused_at_door`) | `voided` | `voided` | **No restock** for perishables (`product_snapshot.is_perishable=true`). Non-perishables restock. Cake → `waste_log` for daily ops report. |
| **Not home / unreachable** | `failed_delivery` (`not_home` / `unreachable` / `wrong_address`) | stays `unpaid` | stays `pending_collection` | none. Max **2** auto-retries then forced admin decision. |
| **Cash short** | `delivered` | `paid` | `collected_short` (records `expected_minor`, `collected_minor`, `shortfall_minor`) | none. Auto `cash_disputes` row, `kind='shortfall'`. |
| **Counterfeit note suspected** | `disputed` | stays `unpaid` | `disputed` | none. `cash_disputes.kind='counterfeit'`, `evidence_photo_urls[]`. Admin resolves: write-off / rider-liable / accept. |
| **Rider cancelled (vehicle breakdown)** | back to `ready_for_dispatch` | unchanged | unchanged | none |

All transitions via one RPC with a `valid_transitions` table — illegal jumps (e.g. `cancelled → delivered`) rejected at the DB layer.

```sql
create table order_status_history (
  id           bigserial primary key,
  order_id     uuid not null references orders(id),
  from_status  order_status_t, to_status order_status_t not null,
  reason       text, evidence jsonb,
  actor_id     uuid references profiles(id), actor_role text,
  created_at   timestamptz not null default now()
);

create table cash_disputes (
  id                bigserial primary key,
  order_id          uuid not null references orders(id),
  kind              text not null check (kind in ('shortfall','counterfeit','overpayment','other')),
  expected_minor    bigint not null, collected_minor bigint not null,
  shortfall_minor   bigint generated always as (expected_minor - collected_minor) stored,
  evidence          jsonb,
  resolution        text check (resolution in ('write_off','rider_liable','accept','reversed_collection')),
  resolved_by       uuid references profiles(id), resolved_at timestamptz,
  created_at        timestamptz not null default now()
);
```

### G.X.4 COD fraud guardrails — Pakistan realities

Prank orders to fake addresses are the #1 cost of running COD in Karachi/Lahore. Four layers:

**(a) Phone OTP before first order.** Supabase Auth phone provider via Twilio Verify (works on PK, supports Urdu SMS). `profiles.phone_e164 text unique`, `phone_verified_at timestamptz`. RPC raises `phone_not_verified` if null. UI re-prompts with OTP modal.

**(b) Per-phone / per-IP daily caps**, configurable in `store_settings`:

```sql
-- seeded in step (g):
-- ('cod.max_orders_per_phone_per_day',  '3')
-- ('cod.max_orders_per_ip_per_day',     '5')
-- ('cod.first_order_max_total_minor',   '500000')   -- PKR 5,000
-- ('cod.delivery_cities_allowlist',     '["karachi","lahore","islamabad","rawalpindi"]')
```

Caps enforced in `assert_cod_eligible()` counting `orders` for `(phone, today)` and `(ip, today)`. IP captured from Next.js edge function and passed in as `p_client_ip inet` (never trust client).

**(c) Admin blocklist:**

```sql
create table cod_blocklist (
  id          bigserial primary key,
  phone_e164  text, ip_cidr inet, area_slug text,
  reason      text not null,
  blocked_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  check (phone_e164 is not null or ip_cidr is not null or area_slug is not null)
);
create index on cod_blocklist (phone_e164) where phone_e164 is not null;
create index on cod_blocklist (area_slug)  where area_slug  is not null;
```

Matches raise `cod_blocked` (generic customer message; detailed reason logged for ops).

**(d) First-time-customer max order value.** Customer with zero `delivered` orders cannot place > `cod.first_order_max_total_minor`. Stops the "PKR 80,000 wedding cake to a fake address" prank. Cap is a `store_settings` value; admin can raise per-customer via `profiles.cod_trust_level` (`new` / `trusted` / `vip`).

**Defense in depth:** OTP alone defeats novices; burner SIMs defeat OTP-only. Combine all four — the unit economics of pranking become unprofitable.

### G.X.5 Cancellation / refund — no money flow at launch

```sql
create table refunds (
  id              bigserial primary key,
  order_id        uuid not null references orders(id),
  amount_minor    bigint not null default 0,    -- 0 for pre-collection cancels
  reason          text not null,
  kind            text not null check (kind in ('pre_collection_cancel','post_collection_cash_return','psp_refund')),
  initiated_by    uuid not null references profiles(id),
  status          text not null default 'recorded' check (status in ('recorded','executed','failed')),
  evidence        jsonb,
  created_at      timestamptz not null default now()
);
```

**Cancel-before-delivery** (admin or customer-within-grace):
1. `cancel_order(order_id, reason)` checks `status in ('pending_confirmation','confirmed','baking','ready_for_dispatch')` — not allowed past `out_for_delivery`.
2. `status → cancelled`, `payment_status → voided`, `payments.status → voided`.
3. Restock loop: for each line, if `product_snapshot.is_perishable = false` then `update products set stock_quantity = stock_quantity + line.qty`. Perishables (cakes, pastries) **not restocked** — once flour is allocated, it's allocated. `waste_log` row written for the daily ops report.
4. `refunds` row inserted with `amount_minor=0`, `kind='pre_collection_cancel'`, `status='executed'`. Zero amount, logged anyway because "we cancelled this and owe nothing" is a finding ops needs in history.

**Customer-side grace window:** self-cancel only while `status in ('pending_confirmation','confirmed')`. After `baking`, "Cancel" becomes "Request cancellation" → `cancellation_requests` for admin review.

### G.X.6 Confirmation channels — email + WhatsApp click-to-chat

**At launch:**
- **Email** via Supabase Edge Function `send_order_confirmation`, triggered on `INSERT INTO orders`. Resend transport (matches repo's general pattern). Template includes order short-id, line items from `product_snapshot`, address echo, total, ETA window, and a WhatsApp click-to-chat link.
- **WhatsApp click-to-chat link in email:** `https://wa.me/923XXXXXXXXX?text=Hi%20Kakeez%2C%20I%27d%20like%20to%20update%20order%20%23{short_id}` (number from `store_settings.value->'support.whatsapp_e164'`). Zero cost, ~95% reach on PK Android.
- **SMS:** **not at launch.** PK gateway delivery to Zong/Ufone is patchy, bounce reporting unreliable — defer to Phase 2.

**Documented for Phase 2:** WhatsApp Business Cloud API for templated transactional messages (order_confirmed, out_for_delivery, delivered). Requires Meta Business verification (5–10 PK business days), sender display approval, pre-approved Urdu/English templates. Tracked in `docs/PHASE2_WHATSAPP_API.md`. The `notifications.channel` enum (`'email','wa_click','wa_template','sms'`) is shaped for it now.

```sql
create table notifications (
  id           bigserial primary key,
  order_id     uuid references orders(id),
  user_id      uuid references profiles(id),
  channel      text not null check (channel in ('email','wa_click','wa_template','sms')),
  template_key text not null,    -- 'order_confirmed', 'out_for_delivery', 'delivered'
  payload      jsonb not null,
  provider_id  text,             -- Resend message id / future WA message id
  status       text not null default 'queued' check (status in ('queued','sent','failed','bounced')),
  error        text, sent_at timestamptz,
  created_at   timestamptz not null default now()
);
```

### G.X.7 Daily cash reconciliation

Three numbers must reconcile every night: **collected** (sum of `payments.collected_amount_minor`), **expected** (sum of `total_minor` for orders `delivered` today), **deposited** (sum of `cash_drops.total_minor`).

```sql
create table cash_drops (
  id            uuid primary key default gen_random_uuid(),
  rider_id      uuid not null references profiles(id),
  drop_date     date not null,
  total_minor   bigint not null,
  order_ids     uuid[] not null,
  deposited_by  uuid not null references profiles(id),
  bank_ref      text, notes text,
  created_at    timestamptz not null default now()
);
create index cash_drops_rider_date_idx on cash_drops (rider_id, drop_date);

create view daily_cash_reconciliation as
with collected as (
  select date_trunc('day', p.collected_at)::date as d, o.assigned_rider_id as rider_id,
         sum(p.collected_amount_minor) as collected_minor
    from payments p join orders o on o.id = p.order_id
   where p.status in ('collected','collected_short')
   group by 1, 2
),
expected as (
  select date_trunc('day', osh.created_at)::date as d, o.assigned_rider_id as rider_id,
         sum(o.total_minor) as expected_minor
    from orders o join order_status_history osh
      on osh.order_id = o.id and osh.to_status = 'delivered'
   group by 1, 2
),
deposited as (
  select drop_date as d, rider_id, sum(total_minor) as deposited_minor
    from cash_drops group by 1, 2
)
select coalesce(c.d, e.d, dp.d) as day,
       coalesce(c.rider_id, e.rider_id, dp.rider_id) as rider_id,
       coalesce(e.expected_minor, 0)   as expected_minor,
       coalesce(c.collected_minor, 0)  as collected_minor,
       coalesce(dp.deposited_minor, 0) as deposited_minor,
       coalesce(c.collected_minor, 0) - coalesce(e.expected_minor, 0)  as collection_variance_minor,
       coalesce(dp.deposited_minor, 0) - coalesce(c.collected_minor, 0) as deposit_variance_minor
from collected c
full outer join expected  e  on e.d = c.d and e.rider_id  = c.rider_id
full outer join deposited dp on dp.d = coalesce(c.d, e.d) and dp.rider_id = coalesce(c.rider_id, e.rider_id);
```

**Admin Reports → "Today's cash"**: per-rider rows (Expected / Collected / Deposited) + two variance columns. Non-zero `deposit_variance_minor` highlights red. Drill-in lists `cash_drops.order_ids` and open `cash_disputes` rows.

### G.X.8 Phase 0 UI cleanup — exact edits required

1. **`src/app/checkout/page.tsx:31`** — change `const [payment, setPayment] = useState<"cod" | "card">("cod")` to `const [payment] = useState<"cod">("cod")`. Drop the setter.
2. **`src/app/checkout/page.tsx:212-227`** — delete the entire two-button container, replace with a single confirmed-COD row:
   ```tsx
   <label className={`${labelCls} block mt-[1.4vw]`}>Payment Method</label>
   <div className="mt-[0.6vw] bg-white rounded-[0.7vw] p-[1.1vw] flex items-center gap-[0.8vw] border border-primary-brown/30">
     <Banknote className="w-[1.4vw] h-[1.4vw] text-primary-brown" />
     <div>
       <div className="ff-accia text-[1.04vw] text-black">Cash on Delivery</div>
       <div className="ff-accia-light text-[0.9vw] text-black/60">Pay the rider in cash when your order arrives. Please keep exact change ready.</div>
     </div>
   </div>
   ```
   Remove `CreditCard` import from `lucide-react` (line 10).
3. **`src/app/admin/settings/page.tsx`** — keep the Payments tab visible; render a single notice card: > **Cash on Delivery only — at launch.** Online payment providers (Card, JazzCash, Easypaisa) are not enabled yet. To enable, contact engineering. COD-specific controls (daily caps, first-order limit, blocklist) are in the **Operations → COD Risk** tab. No toggle, no "Coming soon" placeholder.
4. **`src/app/checkout/page.tsx:12-14, 62-65, 67-76`** — also remove the client-side `DELIVERY_CHARGE` const, the client `PROMOS` dict, and the client `grandTotal` math. The page now displays totals returned from a `preview_order(cart, address, promo)` RPC.
5. **Search-and-destroy:** grep the repo for `jazzcash`, `easypaisa`, `stripe`, `payfast`, `paymob` (case-insensitive). Anything that survives goes too. (Confirmed no PSP SDK is in `package.json`; keep it that way.)

### G.X.9 Schema diff vs v1 plan (PSP-ready, COD-only at launch)

| Area | v1 plan (PSP-assumed) | COD-only launch (this section) | Migration path to Phase 2 PSP |
|---|---|---|---|
| `payments` table | One row per attempt, multi-provider, `webhook_received_at` | **One row per order**, `provider` enum **constrained to `cod` via CHECK** | `ALTER TYPE payment_provider_t ADD VALUE 'jazzcash'`, etc.; drop `provider='cod'` CHECK. The 1-row-per-order rule relaxes to a partial unique index `(order_id) WHERE status IN ('collected','paid')` instead of a hard unique. |
| `refunds` table | Full PSP refund lifecycle | **Kept as-is structurally**, today only `kind='pre_collection_cancel'` (`amount_minor=0`) | Zero schema change. Add `kind='psp_refund'` handlers in code. |
| `orders.payment_method` | `enum('card','jazzcash','easypaisa','cod')` | `enum('cod')` only | `ALTER TYPE payment_method_t ADD VALUE 'jazzcash'`, etc. Existing rows unaffected. |
| `orders.payment_status` | Same enum as here | Same enum (`unpaid/paid/refund_pending/refunded/voided`) | **No change.** Method-agnostic by design. |
| Webhooks | `payment_webhooks` table planned | **Not created at launch** — empty-table dead code | Add in Phase 2. |
| `cash_drops`, `cash_disputes` | Not in v1 | **New, COD-specific** | Stay relevant — even with online payments, COD remains a PK channel for years. |
| `cod_blocklist`, `cod_trust_level` | Not in v1 | **New, COD-specific** | Stay relevant. |
| `notifications.channel` | `('email','sms')` | `('email','wa_click','wa_template','sms')` (wa_template unused at launch) | Zero change to enable WhatsApp Business API. |

**Net:** launch schema is a strict subset of the eventual Phase 2 schema. Every COD-only constraint (CHECK on provider, single payment method enum value, unique on order_id) is one we can *drop or widen*, never restructure around. The 88-product ETL goes forward unchanged because none of this touches `products`.

### G.X.10 Edge cases for implementation tickets

- **Customer changes address after order placed but before dispatch:** allowed only while `status='pending_confirmation'`. After that, snapshot is frozen; changes create a `cancellation_requests` row.
- **Rider phone dies, can't mark delivered:** admin marks on rider's behalf via `rider_mark_outcome(..., actor_role='admin_on_behalf', evidence={proxy: true, original_rider_id: ...})`. Audited in `order_status_history`.
- **Customer pays PKR 5000 note, rider has no change:** `payments.status='collected_short'` with `shortfall_minor < 0` (overpayment). `cash_disputes.kind='overpayment'`; resolved by change-on-next-visit OR store credit on `profiles.store_credit_minor`. Real scenario — Karachi riders frequently carry < PKR 500 change at start of shift.
- **Order during load-shedding-induced Supabase downtime:** the checkout RPC won't run. UI shows "We're experiencing a brief outage — try again in a few minutes". Do **not** queue orders client-side for later replay — stock check + total recompute must happen server-side at creation time; a queued cart goes stale.
- **Karachi vs Lahore vs Islamabad delivery fee:** `compute_delivery_minor()` reads `store_settings.value->'delivery.by_city'`; falls back to PKR 200 default (currently hardcoded PKR 99 was a placeholder).
- **88-product ETL preserves IDs?** Yes — F.0 step (f) preserves UUIDs so existing storage paths remain valid.

---

## Other Cross-Cutting Concerns

- **Testing** (repo rules target 80%): unit (pricing, coupon, tax, money helpers), RLS isolation tests (own vs other vs admin; draft hidden), integration (order RPC success/failure/rollback), E2E (browse → cart → checkout → admin fulfill), webhook idempotency tests.
- **Security:** server-authoritative money/stock; service-role key server-only; webhook signature + idempotency; storage upload validation; rate-limit auth & checkout; CSP/security headers (per `web/security` rules); no secrets in client.
- **Observability:** Sentry (errors), structured logs in actions/edge functions, an admin audit trail (order/role/setting changes).
- **Migrations & env:** forward-only CLI migrations; `.env.example`; separate Supabase projects (or branches) for preview vs production; never test order creation against production data.
- **Performance:** server-render catalog, eliminate N+1, `next/image` + transforms, `next/font`, code-split admin, paginate lists, materialized views for reports.

---

# Appendix — Open Questions

### ✅ Answered in v2 (locked in)

1. ~~**Variations vs custom orders:**~~ **ANSWERED — both.** Full variation engine (B.1.X) for catalog cakes; bespoke quote flow (B.1.Y) for "make it look like *this*" requests. The two CTAs coexist per product.
2. ~~**Payments:**~~ **ANSWERED — COD-only at launch.** UI for Card / JazzCash / Easypaisa is removed in Phase 0. Schema is PSP-ready for Phase 6+.
9. ~~**Data migration:**~~ **ANSWERED — clean rebuild allowed.** 88 live products + 4 categories are ETL-preserved (F.0 step f); the 1 stale order is archived as evidence; everything else is dropped and recreated.

### Still open (do not block Phase 0)

3. **Email provider:** Resend, Supabase SMTP, or SendGrid? Sender domain available for DKIM/SPF? *Recommendation: Resend (matches repo's general stack pattern).*
4. **Delivery model details:** Karachi only at launch, or Karachi + Lahore + Islamabad? Time-slot windows or AM/PM buckets? Free-over-threshold?
5. **Tax:** confirm Pakistan bakery retail is sales-tax-exempt at this scale (Phase 0 seeds `rate_bp = 0` default).
6. **Reviews:** admin-approved before publishing? Verified-purchase only (`order_id` not null)? Or auto-publish with admin moderation queue?
7. **Digital/virtual products:** any real use (cake-decorating classes, gift cards, downloadable recipe packs)? Or build schema-only and defer UI? *Recommendation: defer; bakery rarely needs digital.*
8. **Multi-currency / multi-language:** PKR + English only (assumed), or Urdu label/i18n in Phase 2+? The variations schema already has `label_ur` columns ready.
10. **Team size / roles:** does Phase 0 need an actual `staff` role wired into RLS, or admin-only suffices for launch (staff added in Phase 4)?

### New questions that emerged from v2 design work

11. **Phone OTP provider:** Twilio Verify (works on PK, ~$0.05/verify), or Supabase's built-in phone provider, or a local PK SMS gateway (cheaper but flaky on Zong/Ufone)? Affects the anti-fraud foundation (G.X.4).
12. **WhatsApp Business API timeline:** click-to-chat link is free and ships in Phase 0; templated API requires Meta verification (5–10 PK business days). Is Phase 2 acceptable, or kick off Meta verification now?
13. **Rider role / model:** rider is implicit in G.X but not enumerated as a `profiles.role` value. Add `'rider'` to the role enum in Phase 0 (cheap), or defer until rider workflow ships?
14. **Custom-cake max open per phone default:** seeded as 2 in Phase 0 (`custom_order.max_open_per_phone`). Confirm or adjust.
15. **Cancellation lockout default:** seeded as 24 h before `desired_date`. Confirm or adjust.
16. **Realtime channel auth model:** `postgres_changes` (simple, RLS-scoped) vs **Broadcast from Database** (`realtime.broadcast_changes`, RLS on `realtime.messages`). v1 leaned toward Broadcast; if simpler is preferred for launch, document the migration path.
17. **First admin name/email** for step (g) of F.0 — needed at the migration window.

---

*End of plan v2. Awaiting review/approval before any implementation. On approval, recommend starting with **F.0 step (a) — PITR snapshot** as the very first action of the very first PR.*
