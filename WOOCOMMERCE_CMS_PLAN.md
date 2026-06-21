# Full-Fledged E-commerce CMS Architecture & Implementation Plan
*A WooCommerce-style backend powered by Next.js and Supabase.*

This document outlines the strategic plan to build a highly scalable, feature-rich Content Management System (CMS) tailored for a modern bakery/e-commerce business. It mirrors the flexibility of WooCommerce while leveraging the performance of Next.js and the real-time capabilities of Supabase.

---

## 🏗️ Phase 1: Database Foundation & Architecture Engine
*Goal: Establish a highly relational, flexible schema capable of handling complex product types and real-time data.*

**1.1 Advanced Product Schema**
*   **Base Products Table:** Core fields (`title`, `slug`, `description`, `short_description`, `status: draft/publish`, `type: simple/variable/bundle`).
*   **Pricing Engine:** `regular_price`, `sale_price`, `tax_status`, `tax_class`.
*   **Taxonomy Mapping:** Many-to-many relationship table for Products <-> Categories. allows products to sit in multiple categories simultaneously.
*   **Linked Products:** Many-to-many relationships for `upsells` (suggested upgrades) and `cross-sells` (frequently bought together).

**1.2 Variations & Attributes Engine**
*   **Global Attributes Table:** E.g., `Size`, `Flavor`, `Tier`.
*   **Attribute Terms Table:** E.g., `1 lb`, `2 lbs`, `Chocolate`, `Vanilla`.
*   **Product Variations Table:** A sub-table of products. Each variation (e.g., "1lb Chocolate") has its own unique `sku`, `price`, `stock_quantity`, and `image_url`.

**1.3 Inventory & Media Schema**
*   **Inventory Tracking:** Fields for `manage_stock` (boolean), `stock_quantity`, `low_stock_threshold`, and `stock_status` (in_stock, out_of_stock, on_backorder).
*   **Product Galleries Table:** 1-to-many relationship linking a `product_id` to multiple image URLs with a `display_order` integer for drag-and-drop sorting.

---

## 🎨 Phase 2: Taxonomy & Attribute Management UI
*Goal: Build the interfaces for the building blocks of products.*

**2.1 Category Management Module**
*   Create an interface to manage hierarchical categories (Parent/Child categories).
*   Include category image uploads and SEO description fields.

**2.2 Global Attributes Module**
*   UI to create global attributes (e.g., "Cake Size").
*   Drill-down UI to manage terms within that attribute (e.g., "1 lb", "2 lbs").
*   These will populate the dropdowns when creating variable products later.

---

## 📦 Phase 3: The WooCommerce-Style Product Editor
*Goal: Build the master interface where admins will spend most of their time.*

**3.1 Product List Dashboard**
*   Advanced data table with pagination, bulk actions (e.g., bulk publish/delete), and deep filtering (by category, stock status, product type).

**3.2 Master Product Editor (Tabbed Interface)**
*   **General Tab:** Basic info, pricing, and tax settings.
*   **Inventory Tab:** SKU generation, stock quantity management, and backorder settings.
*   **Linked Products Tab:** Autocomplete search to easily attach cross-sells and upsells.
*   **Attributes Tab:** Select which global attributes apply to this specific product.
*   **Variations Tab (The Heavy Lifter):** Generate variations based on selected attributes. Accordion-style UI to set individual prices, stock, and images for *every single combination*.
*   **Gallery Tab:** Drag-and-drop multi-image uploader leveraging `browser-image-compression` and Supabase Storage.

---

## 🛒 Phase 4: Real-Time Order Management
*Goal: Build a mission-control center for fulfilling orders with instant feedback.*

**4.1 Real-Time Dashboard**
*   Implement Supabase Realtime subscriptions.
*   **Toast Notifications:** When a customer places an order on the frontend, a toast notification instantly appears on the admin screen with a sound chime.
*   **Live Table:** The orders table automatically injects new rows at the top without requiring a page refresh.

**4.2 Advanced Order Processing**
*   Detailed view for individual orders (Customer info, items ordered, total breakdown).
*   **Order Status Engine:** Manage lifecycle states (`Pending Payment`, `Processing/Baking`, `Ready for Pickup`, `Completed`, `Cancelled`, `Refunded`).
*   **Order Notes:** Internal notes for staff (e.g., "Customer called to delay pickup") vs. Customer-facing notes (sent via email).

---

## 👥 Phase 5: Customer & User Management
*Goal: Understand customer behavior and manage staff access.*

**5.1 Customer CRM**
*   Aggregated view of customers. Calculate Lifetime Value (LTV), Average Order Value (AOV), and total order count automatically from historical data.
*   Detailed customer profile showing their complete order history and saved addresses.

**5.2 Role-Based Access Control (RBAC)**
*   Manage staff accounts.
*   Roles: `Administrator` (full access), `Shop Manager` (can manage products/orders but not settings), `Baker/Fulfiller` (can only view orders and change status to 'Ready').

---

## ⚙️ Phase 6: Store Settings & Analytics
*Goal: Global configuration and business insights.*

**6.1 Global Configuration**
*   Manage store address, currency, delivery fees, and tax rates.
*   Configure email notification settings.

**6.2 Analytics & Reporting**
*   Dashboard charts showing Sales over time, Top Selling Products, and Category performance.
*   Low stock warning widgets.

---

## 🚀 Phase 7: Frontend Integration (The Headless Store)
*Goal: Connect the Next.js customer-facing storefront to the new powerful CMS.*

**7.1 Variable Product UI**
*   Update the product page to handle dropdowns. When a user selects "Chocolate" and "2 lbs", the price and main image instantly update to match the variation data.

**7.2 Cross-Sells & Upsells**
*   Display "You may also like..." carousels powered by the Linked Products relationships defined in the CMS.

---

## Current Implementation Status - 2026-06-18

This document is still the target architecture. The current codebase is
not yet a full WooCommerce-style CMS. The 2026-06-18 sprint completed a
UI/admin/realtime stabilization pass, documented in `PROGRESS.md`.

Done now:

- Dark modern admin shell and admin page refresh for dashboard, orders,
  order detail, products, customers, settings, staff, and login.
- Realtime order support migration for Supabase `orders`.
- Home page responsive rebuild with restored hero slider/mask behavior,
  category tab icons from root assets, category hover states, and the
  restored green product panel decorations.
- Responsive navbar and checkout improvements.
- Single product page width alignment, duplicate-image cleanup, removal
  of the old product hero/banner section, and removal of `vw` sizing from
  `src/app/product/[slug]/page.tsx`.
- Build verification with `npm run build`.

Not done yet:

- Phase 1-3 WooCommerce editor depth is not complete: global attribute
  and hierarchical category management now have a dedicated `/admin/catalog`
  screen, while variation generation, multi-image gallery editing,
  advanced product filters, linked products, and bundles remain future work.
- Phase 4 order management is only partially complete: realtime support
  exists, but full toast/sound notification UX, internal/customer notes,
  rider outcomes, and cash reconciliation are not complete.
- Phase 5 CRM/RBAC is partial: staff/customer screens exist, but full
  role-specific permissions and CRM metrics remain future work.
- Phase 6 store settings/analytics are partial: delivery zones and tax
  settings are now editable in `/admin/settings`, while reporting charts
  and low stock widgets remain future work.
- Phase 7 frontend integration is partial: simple CMS-backed products
  render, but variable-product selectors, cross-sells/upsells powered by
  linked-product relationships, SEO metadata, sitemap, and server-rendered
  catalog pages remain future work.
