# Kakeez Bakeshop — Audit & Remediation Report

Date: 2026-06-16 · Scope: full frontend, backend (Supabase), auth flows, and admin panel.

Legend: ✅ Fixed in this pass · 🟡 Recommended (action needed by you) · 🔒 Security

---

## 1. Backend / Database (Supabase)

### 🔒 CRITICAL — No Row Level Security (RLS) → full data exposure ✅ FIXED & APPLIED
Tables `categories`, `products`, `orders`, `order_items` had **no RLS**, so the public
anon key (shipped in client JS) could:
- **Read every customer's name & email** out of `orders` (verified: a plain anonymous
  `GET /rest/v1/orders` returned real customer PII).
- Insert / update / **delete any product, category, or order**.

**Fix:** `supabase/migrations/20260616000000_enable_rls_security.sql` enables RLS and adds
least-privilege policies via an `is_admin()` helper (checks the verified JWT email claim):
- `categories` / `products`: world-readable, **admin-only writes**.
- `orders` / `order_items`: a signed-in user may create & read **only their own** rows;
  admin sees/manages everything.
- storage `products` bucket: world-readable, **admin-only** upload/update/delete
  (previously *any* logged-in user could overwrite images).

**Applied to the live project** (`crzqqvbvaguttrkzvpqh`) via the Management API and verified:
| Check | Before | After |
|---|---|---|
| Anonymous read of `orders` (PII) | returns customer rows | `[]` (blocked) |
| Anonymous read of `products` | works | works (still public) |
| Anonymous `INSERT` into `categories` | succeeds | `401` (blocked) |
| Admin session read of `orders` | works | works |

### 🟡 CRITICAL — Weak admin credentials
The admin user is seeded with password **`admin`** (`supabase/migrations/...seed_admin.sql`),
which still works on the live project. **Rotate it now.** Easiest options:
- Dashboard → Authentication → Users → `admin@kakeez.com` → Reset password, **or**
- SQL editor:
  ```sql
  UPDATE auth.users
  SET encrypted_password = crypt('YOUR-NEW-STRONG-PASSWORD', gen_salt('bf'))
  WHERE email = 'admin@kakeez.com';
  ```

### 🟡 Admin authorization was client-side only
Admin gating relied on a client-side email check (`session.user.email === 'admin@kakeez.com'`),
which is UX only — it does not protect data. The new RLS policies enforce this **server-side**,
so the admin checks in the UI are now backed by real authorization.

### Notes
- `is_upsell` and `stock_quantity` columns exist but are unused by the app.
- Category delete cascades to its products (by design, `fix_cascade` migration) — the admin
  UI warns about this, which is good.

---

## 2. Frontend (storefront)

### ✅ Cart drawer — React Rules-of-Hooks violation (could crash)
`CartDrawer` called `useRouter()` **after** an early `if (!isOpen) return null`, so the hook
count changed between renders. Rebuilt so all hooks run unconditionally before any return.

### ✅ Checkout — fragile order-items insert & swallowed errors
Old code decided "is this a real product?" with `item.id.length > 30` and silently swallowed
failures. Replaced with a proper UUID check and surfaced errors.

### ✅ Dead navbar links (404s)
`/menu`, `/contact`, `/catering` were linked but had no pages. Added branded pages for each.

### ✅ `next/image` with remote Supabase images had no config
There was **no `next.config`**, so `next/image` with remote storage URLs would error. Added
`next.config.ts` with `images.remotePatterns` for `*.supabase.co` (also pins the Turbopack
root to silence a stray-lockfile warning).

---

## 3. Auth flows

### ✅ Account state in the navbar
The person icon always opened the login popup, even when already signed in. Now it reflects
the session: signed-in users get an account menu (name, email, **Sign out**); guests get the
login popup. Admins still get the Admin shortcut.

### Behavior confirmed working
- Checkout is gated behind login (cart drawer prompts sign-in, `/checkout` redirects guests).
- Sign-up captures name / phone / address into user metadata and prefills checkout.

---

## 4. Admin panel

### ✅ Logout button did nothing
The sidebar **Logout** button had no `onClick` — `handleLogout` existed but was never wired.
Now connected (signs out + redirects to `/admin/login`).

### ✅ Dashboard status badges never matched
Badge logic compared against `'Baking'`/`'Pending'` (capitalized) while the data is lowercase
(`pending`/`baking`/`delivered`/`cancelled`), so every badge fell through to green. Fixed the
casing and added the `cancelled` (red) state. The "Items" column (hard-coded `-`) now shows the
real line-item count.

### ✅ Customers page showed fake numbers
Every customer card showed a hard-coded "1 order / Rs. 1,950", and `customer_name[0]` would
crash on an empty name. Now aggregates **real** order counts and total spend per customer, with
a safe avatar fallback.

### 🟡 Settings page is non-functional (cosmetic)
"Save Changes" on the General tab does nothing, and the other tabs are "Coming Soon"
placeholders. Left as-is (clearly a stub); wire to a `settings` table when needed.

---

## 5. Design work (Figma → code, vw units)

Rebuilt to match the Figma `AQDAS-DRAFTS` frames exactly, converting px → vw with the
project's `÷17.28` factor:
- **Cart drawer** (node `1114-1031`): Your Cart / Clear cart, item rows with circular stepper
  + trash, green **Popular Items** carousel (live products), Subtotal / Delivery / Grand total,
  Checkout.
- **Checkout** (node `1114-762`): delivery form (name, mobile, email, address, send-as-gift
  toggle, special instructions, payment method) + white cart-summary card (items, Add more
  items, Popular Items, promo code, totals, Place Order). Fully wired to the cart + orders.
- **Single product page** (node `1114-8`): scalloped "cloud" hero, product detail (image +
  thumbnails, price, special instructions, quantity, ADD TO CART with live total, gift toggle,
  flavor copy), **You May Also Like** (real related products), **Happy Customers** reviews.

> The product page's Figma "images" are empty placeholders (no raster assets to export); it uses
> the real product image from the DB with `/assets/product.svg` as fallback. The hero clip path
> was exported to `public/assets/product-hero-mask.svg`.

---

## Remaining action items for you
1. 🟡 **Rotate the admin password** (see §1) — the only outstanding security item.
2. 🟡 Decide if the **Settings** page should be made functional.
3. Optional: visual fine-tuning of the three rebuilt pages against Figma at your target
   viewport width.
