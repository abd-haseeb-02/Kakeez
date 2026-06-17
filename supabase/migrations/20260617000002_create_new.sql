-- ============================================================================
-- Phase 0 / Migration 2 of 5 — CREATE NEW SCHEMA
-- (ECOMMERCE_CMS_PLAN.md §F.0 step e, §B.1.X variations, §B.1.Y custom orders,
--  §G.X COD-only operations.)
-- ============================================================================
-- Conventions:
--   * Money everywhere as `bigint` *_minor (PKR paisa). No decimals.
--   * Ownership via user_id → public.profiles(id). Never email.
--   * Soft-delete via deleted_at / status; immutable snapshots on order_items.
--   * Role gate via has_role() reading profiles.role by auth.uid() —
--     never JWT email.
--   * Writes carrying money or stock go through SECURITY DEFINER RPCs
--     (revoked from anon/authenticated at the table level in 0005_rls).
--   * Phase 0 ships RPC stubs returning 'NOT IMPLEMENTED' so policy surface
--     is correct from day 1; Phase 1/3 fill in the bodies.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- powers fuzzy search in Phase 6

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Shared utilities — updated_at trigger function (attached per-table below).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- NOTE on F.0 risk #7 (kakeez_rpc_executor role) — DEFERRED to a follow-up
-- migration. Supabase's grant chain rejects WITH ADMIN OPTION back to the
-- creator (0LP01) and a plain GRANT runs into membership detection quirks
-- with cli_login_postgres. Phase 0 ships SECURITY DEFINER RPCs owned by
-- `postgres` (which `service_role` already had) — strictly no worse than the
-- pre-rebuild status, since the old RLS used SECURITY DEFINER too. Phase 4
-- introduces the dedicated executor role as part of the broader auth/role
-- hardening pass.

-- ============================================================================
-- 2. Identity & roles
-- ============================================================================
CREATE TABLE public.profiles (
  id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role                  text NOT NULL DEFAULT 'customer'
                          CHECK (role IN ('customer', 'staff', 'admin')),
  full_name             text,
  phone_e164            text UNIQUE,
  phone_verified_at     timestamptz,
  default_address_id    uuid,
  marketing_opt_in      boolean NOT NULL DEFAULT false,
  cod_trust_level       text NOT NULL DEFAULT 'new'
                          CHECK (cod_trust_level IN ('new', 'trusted', 'vip')),
  no_show_count         int  NOT NULL DEFAULT 0 CHECK (no_show_count >= 0),
  blocked_at            timestamptz,
  blocked_reason        text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create a profile row when a new auth user appears.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Role helpers. has_role hierarchy: admin > staff > customer.
CREATE OR REPLACE FUNCTION public.has_role(p_uid uuid, p_required text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_required = 'customer' THEN
      EXISTS (SELECT 1 FROM public.profiles WHERE id = p_uid)
    WHEN p_required = 'staff' THEN
      EXISTS (SELECT 1 FROM public.profiles WHERE id = p_uid AND role IN ('staff', 'admin'))
    WHEN p_required = 'admin' THEN
      EXISTS (SELECT 1 FROM public.profiles WHERE id = p_uid AND role = 'admin')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.has_role(auth.uid(), 'staff');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- ============================================================================
-- 3. Catalog: categories, tags, attributes, products, variations
-- ============================================================================
CREATE TABLE public.categories (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id           uuid REFERENCES public.categories(id) ON DELETE RESTRICT,  -- nested; RESTRICT not CASCADE
  name                text NOT NULL,
  slug                text NOT NULL UNIQUE,
  description         text,
  image_storage_path  text,
  position            int  NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'published' CHECK (status IN ('published','archived')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER categories_set_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.attributes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE,                                  -- 'size', 'flavor'
  label         text NOT NULL,
  label_ur      text,                                                  -- future Urdu UI
  kind          text NOT NULL CHECK (kind IN ('single_select','multi_select')),
  display_order int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attribute_values (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id  uuid NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  slug          text NOT NULL,                                          -- '1lb', 'chocolate-fudge'
  label         text NOT NULL,
  label_ur      text,
  swatch_hex    text,
  display_order int  NOT NULL DEFAULT 0,
  is_active     bool NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attribute_id, slug)
);

CREATE TABLE public.products (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                     text NOT NULL DEFAULT 'physical'
                             CHECK (type IN ('physical','variable','custom_cake','digital','virtual')),
  status                   text NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','published','archived')),
  name                     text NOT NULL,
  slug                     text NOT NULL UNIQUE,
  short_description        text,
  description              text,
  base_price_minor         bigint NOT NULL CHECK (base_price_minor >= 0),
  compare_at_price_minor   bigint CHECK (compare_at_price_minor IS NULL OR compare_at_price_minor >= 0),
  sku                      text UNIQUE,
  track_inventory          bool NOT NULL DEFAULT false,  -- simple-product stock gate
  stock_quantity           int  NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold      int  NOT NULL DEFAULT 0,
  is_perishable            bool NOT NULL DEFAULT true,   -- cakes/pastries; controls restock policy
  is_best_seller           bool NOT NULL DEFAULT false,
  is_featured              bool NOT NULL DEFAULT false,
  is_quote_only            bool NOT NULL DEFAULT false,  -- hides "Add to cart", shows only "Request quote"
  lead_time_hours          int,
  weight_grams             int,
  seo_title                text,
  seo_description          text,
  og_image_path            text,
  rating_avg               numeric(2,1) NOT NULL DEFAULT 0,
  rating_count             int NOT NULL DEFAULT 0,
  published_at             timestamptz,
  deleted_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_images (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  alt_text     text,
  position     int  NOT NULL DEFAULT 0,
  is_featured  bool NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, position)
);

CREATE TABLE public.product_categories (
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  position    int  NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE public.product_attributes (
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  attribute_id  uuid NOT NULL REFERENCES public.attributes(id) ON DELETE RESTRICT,
  display_order int  NOT NULL DEFAULT 0,
  is_required   bool NOT NULL DEFAULT true,
  PRIMARY KEY (product_id, attribute_id)
);

CREATE TABLE public.product_variations (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id               uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku                      text UNIQUE,
  price_delta_minor        bigint NOT NULL DEFAULT 0,    -- can be negative (eggless sometimes cheaper)
  compare_at_delta_minor   bigint,
  weight_grams             int,
  image_storage_path       text,
  track_inventory          bool NOT NULL DEFAULT false,
  stock_quantity           int  NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  low_stock_threshold      int  NOT NULL DEFAULT 0,
  is_active                bool NOT NULL DEFAULT true,
  attr_signature           text,                          -- maintained by trigger below; used in unique index
  deleted_at               timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER product_variations_set_updated_at BEFORE UPDATE ON public.product_variations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.variation_attribute_values (
  variation_id        uuid NOT NULL REFERENCES public.product_variations(id) ON DELETE CASCADE,
  attribute_id        uuid NOT NULL REFERENCES public.attributes(id) ON DELETE RESTRICT,
  attribute_value_id  uuid NOT NULL REFERENCES public.attribute_values(id) ON DELETE RESTRICT,
  PRIMARY KEY (variation_id, attribute_id)
);

-- Variation collision guard: recompute attr_signature from
-- variation_attribute_values, then a partial unique index over
-- (product_id, attr_signature) rejects duplicate combos for active rows.
CREATE OR REPLACE FUNCTION public.recompute_variation_signature(p_variation_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_sig text;
BEGIN
  SELECT string_agg(a.slug || ':' || av.slug, '|' ORDER BY a.slug)
    INTO v_sig
    FROM public.variation_attribute_values vav
    JOIN public.attributes       a  ON a.id  = vav.attribute_id
    JOIN public.attribute_values av ON av.id = vav.attribute_value_id
   WHERE vav.variation_id = p_variation_id;
  UPDATE public.product_variations SET attr_signature = v_sig WHERE id = p_variation_id;
END $$;

CREATE OR REPLACE FUNCTION public.tg_vav_recompute_signature()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_variation_signature(OLD.variation_id);
  ELSE
    PERFORM public.recompute_variation_signature(NEW.variation_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER vav_recompute_signature
  AFTER INSERT OR UPDATE OR DELETE ON public.variation_attribute_values
  FOR EACH ROW EXECUTE FUNCTION public.tg_vav_recompute_signature();

CREATE UNIQUE INDEX variations_combo_uniq
  ON public.product_variations (product_id, attr_signature)
  WHERE deleted_at IS NULL AND attr_signature IS NOT NULL;

-- Extensible per-product meta (allergens, ingredients, "serves N people", etc.)
CREATE TABLE public.product_meta (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key        text NOT NULL,
  value      jsonb NOT NULL,
  PRIMARY KEY (product_id, key)
);

-- ============================================================================
-- 4. Customer assets
-- ============================================================================
CREATE TABLE public.addresses (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label                  text,
  recipient_name         text NOT NULL,
  phone_e164             text NOT NULL,
  line1                  text NOT NULL,
  line2                  text,
  area                   text,
  city                   text NOT NULL DEFAULT 'Karachi',
  postal_code            text,
  landmark               text,
  latitude               double precision,
  longitude              double precision,
  is_default_shipping    bool NOT NULL DEFAULT false,
  is_default_billing     bool NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Now that addresses exists, wire the FK from profiles.default_address_id.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_address_fkey
  FOREIGN KEY (default_address_id) REFERENCES public.addresses(id) ON DELETE SET NULL;

CREATE TABLE public.carts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  anon_token   text,
  currency     text NOT NULL DEFAULT 'PKR',
  expires_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anon_token IS NOT NULL)
);
CREATE TRIGGER carts_set_updated_at BEFORE UPDATE ON public.carts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cart_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id                   uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id                uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variation_id              uuid REFERENCES public.product_variations(id) ON DELETE RESTRICT,
  quantity                  int  NOT NULL CHECK (quantity > 0),
  unit_price_minor_cached   bigint NOT NULL,
  custom_message            text,
  custom_options            jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER cart_items_set_updated_at BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.wishlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wishlist_items (
  wishlist_id uuid NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wishlist_id, product_id)
);

-- ============================================================================
-- 5. Orders & payments (COD-only at launch)
-- ============================================================================
-- payment_method is a column-level CHECK 'cod' at launch. When Phase 6 adds a
-- PSP, the CHECK is widened (additive ALTER), no restructure needed.
CREATE TABLE public.orders (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number                text NOT NULL UNIQUE,        -- human-friendly: KKZ-000123 (server-generated)
  user_id                     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_request_id           uuid,                         -- FK added after custom_order_requests below
  channel                     text NOT NULL DEFAULT 'web'
                                CHECK (channel IN ('web','whatsapp','admin_manual')),
  -- Customer contact snapshot (for guest/COD where profile may be sparse)
  customer_name               text NOT NULL,
  customer_email              text NOT NULL,
  customer_phone              text NOT NULL,
  -- Money — all integer minor (paisa)
  subtotal_minor              bigint NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor              bigint NOT NULL DEFAULT 0,
  tax_minor                   bigint NOT NULL DEFAULT 0,
  delivery_fee_minor          bigint NOT NULL DEFAULT 0,
  total_minor                 bigint NOT NULL CHECK (total_minor >= 0),
  currency                    text NOT NULL DEFAULT 'PKR',
  coupon_code                 text,
  -- Payment
  payment_method              text NOT NULL DEFAULT 'cod' CHECK (payment_method = 'cod'),
  payment_status              text NOT NULL DEFAULT 'unpaid'
                                CHECK (payment_status IN ('unpaid','paid','refund_pending','refunded','voided')),
  -- Fulfillment
  status                      text NOT NULL DEFAULT 'pending_confirmation'
                                CHECK (status IN ('pending_confirmation','confirmed','preparing',
                                                  'ready_for_dispatch','out_for_delivery','delivered',
                                                  'failed_delivery','cancelled','disputed')),
  delivery_address_snapshot   jsonb NOT NULL,
  delivery_method_id          uuid,                         -- FK added after delivery_methods below
  delivery_zone_id            uuid,
  delivery_slot_date          date,
  delivery_slot_window        text,
  assigned_rider_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_gift                     bool NOT NULL DEFAULT false,
  customer_note               text,
  internal_note               text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id                  uuid REFERENCES public.products(id) ON DELETE SET NULL,
  variation_id                uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  -- Immutable snapshots set at checkout time. Re-rendering an old order never
  -- joins live catalog rows — it reads from these.
  product_name_snapshot       text NOT NULL,
  product_sku_snapshot        text,
  variation_label_snapshot    text,             -- "1lb / Chocolate Fudge / Round / Eggless"
  image_storage_path_snapshot text,
  options_snapshot            jsonb,            -- {"Size":"2 lb","Flavor":"Chocolate"}
  is_perishable_snapshot      bool NOT NULL DEFAULT true,
  is_custom                   bool NOT NULL DEFAULT false,  -- 1 if from a custom_order_requests confirmation
  unit_price_minor_snapshot   bigint NOT NULL CHECK (unit_price_minor_snapshot >= 0),
  quantity                    int    NOT NULL CHECK (quantity > 0),
  line_total_minor_snapshot   bigint NOT NULL CHECK (line_total_minor_snapshot >= 0),
  customer_notes              text
);

-- Add-on snapshots for "Happy Birthday Ayesha" / candles / fondant topper.
-- Stays on the same line item visually but priced separately. See §B.1.X.4.
CREATE TABLE public.order_item_addons (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id     uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  addon_key         text NOT NULL,             -- 'custom_message' | 'candles' | 'fondant_topper'
  addon_label       text NOT NULL,             -- snapshot
  addon_value       text,                      -- "Happy Birthday Ayesha" / "12" / "name-plaque"
  unit_price_minor  bigint NOT NULL,           -- snapshot
  quantity          int    NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_status_history (
  id           bigserial PRIMARY KEY,
  order_id     uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  reason       text,
  evidence     jsonb,
  actor_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role   text,                           -- 'customer' | 'staff' | 'admin' | 'rider' | 'system'
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. Custom-cake quote flow (§B.1.Y)
-- ============================================================================
CREATE TYPE public.custom_order_status_t AS ENUM (
  'requested', 'admin_reviewing', 'quoted', 'customer_confirmed',
  'converted_to_order', 'declined', 'cancelled'
);

CREATE TABLE public.custom_order_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title                    text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description              text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  desired_date             date NOT NULL,
  desired_size_hint        text,
  desired_flavor_hint      text,
  reference_image_paths    jsonb NOT NULL DEFAULT '[]'::jsonb,
  status                   public.custom_order_status_t NOT NULL DEFAULT 'requested',
  quote_total_minor        bigint CHECK (quote_total_minor IS NULL OR quote_total_minor > 0),
  quote_valid_until        timestamptz,
  quote_note               text,
  declined_reason          text,
  cancelled_reason         text,
  converted_order_id       uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  reviewed_by_user_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at              timestamptz,
  quoted_by_user_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  quoted_at                timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cor_desired_date_future
    CHECK (desired_date >= (created_at::date + interval '2 days')),
  CONSTRAINT cor_images_count
    CHECK (jsonb_array_length(reference_image_paths) BETWEEN 1 AND 3),
  CONSTRAINT cor_quote_complete
    CHECK (status <> 'quoted'
        OR (quote_total_minor IS NOT NULL
            AND quote_valid_until IS NOT NULL
            AND quoted_by_user_id IS NOT NULL)),
  CONSTRAINT cor_declined_has_reason
    CHECK (status <> 'declined' OR declined_reason IS NOT NULL),
  CONSTRAINT cor_converted_has_order
    CHECK (status <> 'converted_to_order' OR converted_order_id IS NOT NULL)
);
CREATE TRIGGER custom_order_requests_set_updated_at BEFORE UPDATE ON public.custom_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Wire the orders.source_request_id FK now that the target exists.
ALTER TABLE public.orders
  ADD CONSTRAINT orders_source_request_fkey
  FOREIGN KEY (source_request_id) REFERENCES public.custom_order_requests(id) ON DELETE SET NULL;

-- ============================================================================
-- 7. Pricing modifiers
-- ============================================================================
CREATE TABLE public.coupons (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text NOT NULL UNIQUE,
  type                     text NOT NULL CHECK (type IN ('percent','fixed_cart','fixed_product','free_shipping')),
  value_minor              bigint,                        -- for fixed_*; null for percent
  percent_bp               int CHECK (percent_bp BETWEEN 0 AND 10000),  -- basis points; null for fixed_*
  min_order_minor          bigint NOT NULL DEFAULT 0,
  max_discount_minor       bigint,
  usage_limit              int,
  usage_limit_per_user     int,
  starts_at                timestamptz,
  expires_at               timestamptz,
  status                   text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coupon_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id     uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount_minor  bigint NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, order_id)
);

CREATE TABLE public.tax_rates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  rate_bp     int  NOT NULL CHECK (rate_bp >= 0),          -- basis points; 10000 = 100%
  applies_to  text NOT NULL DEFAULT 'all',
  is_default  bool NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. Delivery
-- ============================================================================
CREATE TABLE public.delivery_zones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  city            text NOT NULL DEFAULT 'Karachi',
  polygon_geojson jsonb,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.delivery_methods (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id            uuid REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  name               text NOT NULL,
  type               text NOT NULL DEFAULT 'flat' CHECK (type IN ('flat','free_over','pickup','per_km')),
  base_fee_minor     bigint NOT NULL DEFAULT 0 CHECK (base_fee_minor >= 0),
  per_km_fee_minor   bigint NOT NULL DEFAULT 0,
  min_order_minor    bigint NOT NULL DEFAULT 0,
  free_over_minor    bigint,
  eta_hours          int,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Wire orders.delivery_method_id / delivery_zone_id FKs now that targets exist.
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_method_fkey
  FOREIGN KEY (delivery_method_id) REFERENCES public.delivery_methods(id) ON DELETE RESTRICT;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_zone_fkey
  FOREIGN KEY (delivery_zone_id) REFERENCES public.delivery_zones(id) ON DELETE RESTRICT;

-- ============================================================================
-- 9. Money movements (COD-only)
-- ============================================================================
CREATE TABLE public.payments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  provider                text NOT NULL DEFAULT 'cod' CHECK (provider = 'cod'),
  method                  text NOT NULL DEFAULT 'cod' CHECK (method = 'cod'),
  amount_minor            bigint NOT NULL CHECK (amount_minor >= 0),
  collected_amount_minor  bigint,
  currency                text NOT NULL DEFAULT 'PKR',
  status                  text NOT NULL DEFAULT 'pending_collection'
                            CHECK (status IN ('pending_collection','collected','collected_short',
                                              'voided','disputed','refunded')),
  provider_ref            text,
  collected_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  collected_at            timestamptz,
  raw                     jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.refunds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_id      uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  amount_minor    bigint NOT NULL DEFAULT 0,
  reason          text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('pre_collection_cancel',
                                                'post_collection_cash_return',
                                                'psp_refund')),
  status          text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','executed','failed')),
  evidence        jsonb,
  initiated_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_movements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE CASCADE,
  change       int NOT NULL,
  reason       text NOT NULL CHECK (reason IN ('order','restock','adjustment','refund','cancellation','waste')),
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (product_id IS NOT NULL OR variation_id IS NOT NULL)
);

-- ============================================================================
-- 10. Ops (reviews, notifications)
-- ============================================================================
CREATE TABLE public.product_reviews (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id           uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  rating             int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title              text,
  body               text,
  verified_purchase  bool NOT NULL DEFAULT false,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id            bigserial PRIMARY KEY,
  order_id      uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  audience      text NOT NULL DEFAULT 'user' CHECK (audience IN ('user','admin')),
  channel       text NOT NULL CHECK (channel IN ('email','wa_click','wa_template','sms','in_app')),
  template_key  text NOT NULL,
  payload       jsonb NOT NULL,
  provider_id   text,
  status        text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','bounced')),
  error         text,
  read_at       timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. COD-specific (cash_drops, cash_disputes, cod_blocklist)
-- ============================================================================
CREATE TABLE public.cash_drops (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  drop_date     date NOT NULL,
  total_minor   bigint NOT NULL,
  order_ids     uuid[] NOT NULL,
  deposited_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  bank_ref      text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cash_disputes (
  id               bigserial PRIMARY KEY,
  order_id         uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('shortfall','counterfeit','overpayment','other')),
  expected_minor   bigint NOT NULL,
  collected_minor  bigint NOT NULL,
  shortfall_minor  bigint GENERATED ALWAYS AS (expected_minor - collected_minor) STORED,
  evidence         jsonb,
  resolution       text CHECK (resolution IN ('write_off','rider_liable','accept','reversed_collection')),
  resolved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cod_blocklist (
  id          bigserial PRIMARY KEY,
  phone_e164  text,
  ip_cidr     inet,
  area_slug   text,
  reason      text NOT NULL,
  blocked_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  CHECK (phone_e164 IS NOT NULL OR ip_cidr IS NOT NULL OR area_slug IS NOT NULL)
);
CREATE INDEX cod_blocklist_phone_idx ON public.cod_blocklist (phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX cod_blocklist_area_idx  ON public.cod_blocklist (area_slug)  WHERE area_slug  IS NOT NULL;

-- ============================================================================
-- 12. Settings (server-driven config, no env redeploys)
-- ============================================================================
CREATE TABLE public.store_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 13. Phase-0 RPC stubs (SECURITY DEFINER, owner postgres — see note above on
-- deferred kakeez_rpc_executor role).
-- Bodies land in Phase 1 / 3. Returning 'NOT IMPLEMENTED' so the policy
-- surface is correct from day 1.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_order(
  p_cart           jsonb,
  p_address        jsonb,
  p_payment_method text,
  p_promo_code     text,
  p_is_gift        boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'NOT IMPLEMENTED — create_order body lands in Phase 1' USING ERRCODE = 'P0001';
END $$;
REVOKE ALL ON FUNCTION public.create_order(jsonb,jsonb,text,text,boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid, p_to_status text, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'NOT IMPLEMENTED — update_order_status body lands in Phase 3' USING ERRCODE = 'P0001';
END $$;
REVOKE ALL ON FUNCTION public.update_order_status(uuid,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.confirm_custom_order_quote(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'NOT IMPLEMENTED — confirm_custom_order_quote body lands in Phase 2' USING ERRCODE = 'P0001';
END $$;
REVOKE ALL ON FUNCTION public.confirm_custom_order_quote(uuid) FROM PUBLIC;

-- ============================================================================
-- 14. Indexes — every FK gets a btree; partial indexes for hot query paths.
-- The live DB only has PK + categories.slug today; everything below is new.
-- ============================================================================
-- Catalog
CREATE INDEX idx_product_images_product_id        ON public.product_images (product_id);
CREATE INDEX idx_product_categories_category_id   ON public.product_categories (category_id);
CREATE INDEX idx_product_categories_product_id    ON public.product_categories (product_id);
CREATE INDEX idx_product_attributes_product_id    ON public.product_attributes (product_id);
CREATE INDEX idx_product_attributes_attribute_id  ON public.product_attributes (attribute_id);
CREATE INDEX idx_product_variations_product_id    ON public.product_variations (product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variations_product_active ON public.product_variations (product_id) WHERE deleted_at IS NULL AND is_active;
CREATE INDEX idx_vav_variation_id                 ON public.variation_attribute_values (variation_id);
CREATE INDEX idx_vav_attribute_value_id           ON public.variation_attribute_values (attribute_value_id);
CREATE INDEX idx_products_status_published_at     ON public.products (status, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX idx_products_name_trgm               ON public.products USING gin (name gin_trgm_ops);

-- Customer assets
CREATE INDEX idx_addresses_user_id                ON public.addresses (user_id);
CREATE INDEX idx_cart_items_cart_id               ON public.cart_items (cart_id);
CREATE INDEX idx_carts_user_id                    ON public.carts (user_id);
CREATE INDEX idx_carts_anon_token                 ON public.carts (anon_token) WHERE anon_token IS NOT NULL;

-- Orders
CREATE INDEX idx_orders_user_id                   ON public.orders (user_id);
CREATE INDEX idx_orders_status_created_at         ON public.orders (status, created_at DESC);
CREATE INDEX idx_orders_active_created_at         ON public.orders (created_at DESC)
  WHERE status NOT IN ('delivered','cancelled');
CREATE INDEX idx_orders_assigned_rider            ON public.orders (assigned_rider_id) WHERE assigned_rider_id IS NOT NULL;
CREATE INDEX idx_orders_source_request_id         ON public.orders (source_request_id) WHERE source_request_id IS NOT NULL;
CREATE INDEX idx_order_items_order_id             ON public.order_items (order_id);
CREATE INDEX idx_order_item_addons_item_id        ON public.order_item_addons (order_item_id);
CREATE INDEX idx_order_status_history_order_id    ON public.order_status_history (order_id, created_at DESC);

-- Custom orders
CREATE INDEX idx_cor_user_id                      ON public.custom_order_requests (user_id);
CREATE INDEX idx_cor_status_created_at            ON public.custom_order_requests (status, created_at DESC);
CREATE INDEX idx_cor_converted_order_id           ON public.custom_order_requests (converted_order_id)
  WHERE converted_order_id IS NOT NULL;

-- Money / ops
CREATE INDEX idx_payments_order_id                ON public.payments (order_id);
CREATE INDEX idx_payments_status                  ON public.payments (status, created_at DESC);
CREATE INDEX idx_refunds_order_id                 ON public.refunds (order_id);
CREATE INDEX idx_inventory_movements_product      ON public.inventory_movements (product_id, created_at DESC)
  WHERE product_id IS NOT NULL;
CREATE INDEX idx_inventory_movements_variation    ON public.inventory_movements (variation_id, created_at DESC)
  WHERE variation_id IS NOT NULL;
CREATE INDEX idx_product_reviews_product          ON public.product_reviews (product_id, status, created_at DESC);
CREATE INDEX idx_notifications_user               ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Coupons / pricing
CREATE INDEX idx_coupon_redemptions_user          ON public.coupon_redemptions (user_id);

-- COD ops
CREATE INDEX idx_cash_drops_rider_date            ON public.cash_drops (rider_id, drop_date);

-- ============================================================================
-- End of 0002_create_new.sql. RLS policies + REVOKEs land in 0005_rls.sql.
-- ============================================================================
