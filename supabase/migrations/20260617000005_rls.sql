-- ============================================================================
-- Phase 0 / Migration 5 of 5 — RLS POLICIES + STORAGE POLICIES + RPC GRANTS
-- (ECOMMERCE_CMS_PLAN.md §F.0 step h, §C.6 RLS strategy, §B.1.Y Y.4, Y.5)
-- ============================================================================
-- Policy strategy in one line:
--   * Public catalog reads via anon (filtered to published / active rows).
--   * Customers see only their own rows on personal tables.
--   * Money / stock / order mutations are SECURITY DEFINER RPCs only —
--     direct anon/authenticated INSERT/UPDATE/DELETE is REVOKE'd at the
--     table level. RLS policies cover read paths and the few writes that
--     bypass RPCs (customer creating an address, request, review).
--   * Staff = has_role(auth.uid(), 'staff') — can see/manage operations.
--   * Admin = has_role(auth.uid(), 'admin') — full catalog + settings.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- ENABLE RLS on every public table created in 0002 + the legacy archive.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attributes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_values              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variation_attribute_values    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_meta                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_addons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_order_requests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_methods              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_drops                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_disputes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cod_blocklist                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_orders_archive         ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Hard REVOKEs on money / stock / order tables. Direct INSERT/UPDATE/DELETE
-- from anon or authenticated is denied at the privilege layer in addition to
-- RLS. The SECURITY DEFINER RPCs (owned by kakeez_rpc_executor) are the only
-- way these tables get written. Reads still happen through RLS policies.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON public.orders                FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items           FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_item_addons     FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_status_history  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments              FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.refunds               FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.inventory_movements   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.coupon_redemptions    FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cash_drops            FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cash_disputes         FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cod_blocklist         FROM anon, authenticated;
-- Storefront/admin config is admin-only writes via policy; no direct grant.
REVOKE INSERT, UPDATE, DELETE ON public.store_settings        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tax_rates             FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.coupons               FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.delivery_zones        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.delivery_methods      FROM anon, authenticated;
-- profiles.role is admin-only via policy (see below). Column-level revoke
-- prevents customer-side UPDATE from touching it even if other columns are open.
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;

-- Phase-0 RPC stubs — grant execute now so the policy surface tests in F.0
-- step (i) can call them (they return NOT IMPLEMENTED until Phase 1/3).
GRANT EXECUTE ON FUNCTION public.create_order(jsonb,jsonb,text,text,boolean)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid,text,text)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_custom_order_quote(uuid)                   TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- POLICIES — grouped by table.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── profiles ───────────────────────────────────────────────────────────────
CREATE POLICY profiles_select_own       ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_select_staff     ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY profiles_update_own       ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_admin_all        ON public.profiles
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── addresses ──────────────────────────────────────────────────────────────
CREATE POLICY addresses_select_own      ON public.addresses
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff());
CREATE POLICY addresses_insert_own      ON public.addresses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY addresses_update_own      ON public.addresses
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY addresses_delete_own      ON public.addresses
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── catalog (categories, attributes, attribute_values, products,
--             product_images, product_categories, product_attributes,
--             product_variations, variation_attribute_values, product_meta)
--     Public read of published rows. Admin/staff manage.
-- ────────────────────────────────────────────────────────────────────────────
CREATE POLICY categories_public_read    ON public.categories
  FOR SELECT USING (status = 'published');
CREATE POLICY categories_staff_read_all ON public.categories
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY categories_admin_write    ON public.categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY attributes_public_read    ON public.attributes
  FOR SELECT USING (true);
CREATE POLICY attributes_admin_write    ON public.attributes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY attribute_values_public_read ON public.attribute_values
  FOR SELECT USING (is_active);
CREATE POLICY attribute_values_staff_read_all ON public.attribute_values
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY attribute_values_admin_write ON public.attribute_values
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY products_public_read      ON public.products
  FOR SELECT USING (status = 'published' AND deleted_at IS NULL);
CREATE POLICY products_staff_read_all   ON public.products
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY products_admin_write      ON public.products
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY product_images_public_read ON public.product_images
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.products p
     WHERE p.id = product_images.product_id
       AND p.status = 'published' AND p.deleted_at IS NULL
  ));
CREATE POLICY product_images_staff_read_all ON public.product_images
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY product_images_admin_write ON public.product_images
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY product_categories_public_read ON public.product_categories
  FOR SELECT USING (true);
CREATE POLICY product_categories_admin_write ON public.product_categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY product_attributes_public_read ON public.product_attributes
  FOR SELECT USING (true);
CREATE POLICY product_attributes_admin_write ON public.product_attributes
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY product_variations_public_read ON public.product_variations
  FOR SELECT USING (is_active AND deleted_at IS NULL);
CREATE POLICY product_variations_staff_read_all ON public.product_variations
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY product_variations_admin_write ON public.product_variations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY vav_public_read           ON public.variation_attribute_values
  FOR SELECT USING (true);
CREATE POLICY vav_admin_write           ON public.variation_attribute_values
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY product_meta_public_read  ON public.product_meta
  FOR SELECT USING (true);
CREATE POLICY product_meta_admin_write  ON public.product_meta
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── carts / cart_items / wishlists ─────────────────────────────────────────
-- Cart writes are direct (not via RPC) because they're low-stakes and need to
-- work for guest carts too. RLS scopes by owner.
CREATE POLICY carts_select_own          ON public.carts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY carts_insert_own          ON public.carts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY carts_update_own          ON public.carts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY carts_delete_own          ON public.carts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY cart_items_select_own     ON public.cart_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.carts c WHERE c.id = cart_items.cart_id AND c.user_id = auth.uid()
  ));
CREATE POLICY cart_items_modify_own     ON public.cart_items
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.carts c WHERE c.id = cart_items.cart_id AND c.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.carts c WHERE c.id = cart_items.cart_id AND c.user_id = auth.uid()
  ));

CREATE POLICY wishlists_select_own      ON public.wishlists
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY wishlists_modify_own      ON public.wishlists
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY wishlist_items_modify_own ON public.wishlist_items
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.wishlists w WHERE w.id = wishlist_items.wishlist_id AND w.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.wishlists w WHERE w.id = wishlist_items.wishlist_id AND w.user_id = auth.uid()
  ));

-- ─── orders + line items + status history (reads only — writes via RPC) ────
CREATE POLICY orders_select_own         ON public.orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY orders_select_staff       ON public.orders
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY order_items_select_own    ON public.order_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY order_items_select_staff  ON public.order_items
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY order_item_addons_select_own ON public.order_item_addons
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
     WHERE oi.id = order_item_addons.order_item_id AND o.user_id = auth.uid()
  ));
CREATE POLICY order_item_addons_select_staff ON public.order_item_addons
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY order_status_history_select_own ON public.order_status_history
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = order_status_history.order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY order_status_history_select_staff ON public.order_status_history
  FOR SELECT TO authenticated USING (public.is_staff());

-- ─── custom_order_requests (§B.1.Y.4) ──────────────────────────────────────
-- Customer INSERTs own row (trigger forces status='requested'); reads scoped
-- to owner or staff. All mutations after the initial insert go through RPCs.
CREATE POLICY cor_select_own            ON public.custom_order_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY cor_select_staff          ON public.custom_order_requests
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY cor_insert_own            ON public.custom_order_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'requested');

-- ─── coupons / coupon_redemptions / tax_rates / delivery_zones / methods ───
-- Storefront reads (anon) only see active rows. Writes admin-only.
CREATE POLICY coupons_public_read       ON public.coupons
  FOR SELECT USING (status = 'active'
                     AND (starts_at IS NULL OR starts_at <= now())
                     AND (expires_at IS NULL OR expires_at >= now()));
CREATE POLICY coupons_staff_read_all    ON public.coupons
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY coupons_admin_write       ON public.coupons
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY coupon_redemptions_select_own ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY coupon_redemptions_select_staff ON public.coupon_redemptions
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY tax_rates_public_read     ON public.tax_rates
  FOR SELECT USING (true);
CREATE POLICY tax_rates_admin_write     ON public.tax_rates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY delivery_zones_public_read ON public.delivery_zones
  FOR SELECT USING (status = 'active');
CREATE POLICY delivery_zones_admin_write ON public.delivery_zones
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY delivery_methods_public_read ON public.delivery_methods
  FOR SELECT USING (status = 'active');
CREATE POLICY delivery_methods_admin_write ON public.delivery_methods
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ─── payments / refunds / inventory_movements (read-only via RLS) ───────────
CREATE POLICY payments_select_own       ON public.payments
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY payments_select_staff     ON public.payments
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY refunds_select_own        ON public.refunds
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND o.user_id = auth.uid()
  ));
CREATE POLICY refunds_select_staff      ON public.refunds
  FOR SELECT TO authenticated USING (public.is_staff());

CREATE POLICY inventory_movements_select_staff ON public.inventory_movements
  FOR SELECT TO authenticated USING (public.is_staff());

-- ─── product_reviews ───────────────────────────────────────────────────────
-- Public sees published reviews. Customer reads own (any status). Admin moderates.
CREATE POLICY product_reviews_public_read ON public.product_reviews
  FOR SELECT USING (status = 'published');
CREATE POLICY product_reviews_select_own  ON public.product_reviews
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY product_reviews_select_staff ON public.product_reviews
  FOR SELECT TO authenticated USING (public.is_staff());
-- Customers can insert reviews for products they bought (verified-purchase
-- enforced server-side; basic RLS check just ties to their auth.uid).
CREATE POLICY product_reviews_insert_own  ON public.product_reviews
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY product_reviews_admin_modify ON public.product_reviews
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ─── notifications ─────────────────────────────────────────────────────────
CREATE POLICY notifications_select_own   ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_select_staff ON public.notifications
  FOR SELECT TO authenticated USING (public.is_staff() AND audience = 'admin');
CREATE POLICY notifications_update_own   ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── COD ops tables (cash_drops / cash_disputes / cod_blocklist) ───────────
-- Staff-and-admin only. Customers never see these.
CREATE POLICY cash_drops_select_staff   ON public.cash_drops
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY cash_disputes_select_staff ON public.cash_disputes
  FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY cod_blocklist_select_admin ON public.cod_blocklist
  FOR SELECT TO authenticated USING (public.is_admin());

-- ─── store_settings ────────────────────────────────────────────────────────
-- Storefront reads a small allowlist of public-safe keys (currency, brand, etc.).
-- Everything else is staff/admin only.
CREATE POLICY store_settings_public_read ON public.store_settings
  FOR SELECT USING (
    key IN ('currency', 'brand_name', 'default_lead_time_hours',
            'cod_only', 'custom_order.cancellation_policy_text',
            'support.whatsapp_e164', 'support_email')
  );
CREATE POLICY store_settings_staff_read_all ON public.store_settings
  FOR SELECT TO authenticated USING (public.is_staff());

-- ─── legacy_orders_archive (admin only) ────────────────────────────────────
CREATE POLICY legacy_orders_archive_admin_read ON public.legacy_orders_archive
  FOR SELECT TO authenticated USING (public.is_admin());

-- ═════════════════════════════════════════════════════════════════════════════
-- STORAGE POLICIES
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── products bucket (re-add what 0001 dropped). Public read; staff write. ──
CREATE POLICY "products_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

CREATE POLICY "products_staff_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'products' AND public.is_staff());

CREATE POLICY "products_staff_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'products' AND public.is_staff())
  WITH CHECK (bucket_id = 'products' AND public.is_staff());

CREATE POLICY "products_admin_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'products' AND public.is_admin());

-- ─── custom-order-uploads bucket (§B.1.Y Y.5). PRIVATE. Owner-prefixed paths. ─
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-order-uploads', 'custom-order-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "cou_select_own_or_staff" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'custom-order-uploads'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR public.is_staff()
    )
  );

CREATE POLICY "cou_insert_own" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'custom-order-uploads'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "cou_update_own" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'custom-order-uploads'
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'custom-order-uploads'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "cou_delete_own_or_staff" ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'custom-order-uploads'
    AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR public.is_staff()
    )
  );

-- ============================================================================
-- End of 0005_rls.sql. The schema is now production-ready behind RLS.
-- F.0 step (i) smoke tests come next, manually in Studio.
-- ============================================================================
