-- ============================================================================
-- Phase 0 / Migration 4 of 5 — SEED DEFAULTS
-- (ECOMMERCE_CMS_PLAN.md §F.0 step g)
-- ============================================================================
-- Only the defaults the storefront cannot launch without. Sensitive values
-- (support phone, support email, the first admin user) are left empty here
-- and set in Supabase Studio post-migration — they must never enter git.
--
-- Idempotent: every INSERT is ON CONFLICT DO NOTHING / WHERE NOT EXISTS so the
-- migration can re-run safely (matches Supabase migration ledger semantics
-- where state can be partially applied during dev).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tax rates. PK retail bakery is sales-tax-exempt at this scale.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.tax_rates (name, rate_bp, applies_to, is_default)
SELECT 'No tax', 0, 'all', true
WHERE NOT EXISTS (SELECT 1 FROM public.tax_rates WHERE is_default);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Default delivery zone + flat fee that matches today's storefront.
--    Per G.X.10 the placeholder PKR 99 is intentionally preserved at launch
--    so checkout pricing doesn't visibly change; admin can adjust per-city.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.delivery_zones (name, city, status)
SELECT 'Karachi', 'Karachi', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_zones WHERE name = 'Karachi');

INSERT INTO public.delivery_methods (zone_id, name, type, base_fee_minor, eta_hours, status)
SELECT z.id, 'Standard Karachi delivery', 'flat', 9900, 24, 'active'
  FROM public.delivery_zones z
 WHERE z.name = 'Karachi'
   AND NOT EXISTS (
     SELECT 1 FROM public.delivery_methods m
      WHERE m.zone_id = z.id AND m.name = 'Standard Karachi delivery'
   );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Store settings — the runtime-flippable config used by the storefront,
--    checkout RPC, COD risk guards, and notifications. Values that need to
--    stay out of git (support phone, etc.) start empty and are set in Studio.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.store_settings (key, value) VALUES
  -- Brand / currency
  ('currency',                                  '"PKR"'),
  ('brand_name',                                '"Kakeez"'),
  -- COD lock + risk caps (read by create_order RPC via assert_cod_eligible)
  ('cod_only',                                  'true'),
  ('cod.first_order_max_total_minor',           '500000'),    -- Rs 5,000
  ('cod.max_orders_per_phone_per_day',          '3'),
  ('cod.max_orders_per_ip_per_day',             '5'),
  ('cod.delivery_cities_allowlist',             '["karachi","lahore","islamabad","rawalpindi"]'),
  -- Custom-cake guardrails (§B.1.Y Y.9)
  ('custom_order.max_open_per_phone',           '2'),
  ('custom_order.max_open_per_user',            '3'),
  ('custom_order.require_deposit',              'false'),
  ('custom_order.cancellation_lockout_hours',   '24'),
  ('custom_order.cancellation_policy_text',     '"Custom cake orders may be cancelled up to 24 hours before the desired delivery date. Inside the 24-hour window, cancellation is at admin discretion as ingredients have been allocated."'),
  -- Lead times
  ('default_lead_time_hours',                   '24'),
  -- Support channels — empty until set in Studio (no secrets in git)
  ('support.whatsapp_e164',                     '""'),
  ('support_email',                             '""')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Variation engine — seed the attributes and values a Pakistani bakery
--    actually sells (§B.1.X.1). Slugs and labels match the plan.
--    Admin can add/edit/disable values without a migration after this point.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.attributes (slug, label, kind, display_order) VALUES
  ('size',     'Size',     'single_select', 10),
  ('flavor',   'Flavor',   'single_select', 20),
  ('shape',    'Shape',    'single_select', 30),
  ('tiers',    'Tiers',    'single_select', 40),
  ('dietary',  'Dietary',  'single_select', 50)
ON CONFLICT (slug) DO NOTHING;

-- Size values (PK convention: by-pound + sheet sizes + cupcake boxes)
WITH a AS (SELECT id FROM public.attributes WHERE slug = 'size')
INSERT INTO public.attribute_values (attribute_id, slug, label, display_order, is_active)
SELECT a.id, v.slug, v.label, v.ord, true
  FROM a, (VALUES
    ('0.5lb',        '0.5 lb',         10),
    ('1lb',          '1 lb',           20),
    ('2lb',          '2 lb',           30),
    ('3lb',          '3 lb',           40),
    ('4lb',          '4 lb',           50),
    ('5lb',          '5 lb',           60),
    ('half-sheet',   'Half sheet',     70),
    ('full-sheet',   'Full sheet',     80),
    ('6-cupcakes',   'Box of 6',       90),
    ('12-cupcakes',  'Box of 12',     100)
  ) v(slug, label, ord)
ON CONFLICT (attribute_id, slug) DO NOTHING;

-- Flavor values (PK market top sellers; mango seasonal, eggless/sugar-free under dietary)
WITH a AS (SELECT id FROM public.attributes WHERE slug = 'flavor')
INSERT INTO public.attribute_values (attribute_id, slug, label, display_order, is_active)
SELECT a.id, v.slug, v.label, v.ord, true
  FROM a, (VALUES
    ('chocolate-fudge', 'Chocolate Fudge',  10),
    ('vanilla',         'Vanilla',          20),
    ('red-velvet',      'Red Velvet',       30),
    ('pineapple',       'Pineapple',        40),
    ('coffee',          'Coffee',           50),
    ('kit-kat',         'Kit-Kat',          60),
    ('oreo',            'Oreo',             70),
    ('lotus-biscoff',   'Lotus Biscoff',    80),
    ('mango',           'Mango (seasonal)', 90),
    ('strawberry',      'Strawberry',      100)
  ) v(slug, label, ord)
ON CONFLICT (attribute_id, slug) DO NOTHING;

-- Shape values
WITH a AS (SELECT id FROM public.attributes WHERE slug = 'shape')
INSERT INTO public.attribute_values (attribute_id, slug, label, display_order, is_active)
SELECT a.id, v.slug, v.label, v.ord, true
  FROM a, (VALUES
    ('round',     'Round',      10),
    ('square',    'Square',     20),
    ('rectangle', 'Rectangle',  30),
    ('heart',     'Heart',      40),
    ('number',    'Number (digit cake)', 50)
  ) v(slug, label, ord)
ON CONFLICT (attribute_id, slug) DO NOTHING;

-- Tier values
WITH a AS (SELECT id FROM public.attributes WHERE slug = 'tiers')
INSERT INTO public.attribute_values (attribute_id, slug, label, display_order, is_active)
SELECT a.id, v.slug, v.label, v.ord, true
  FROM a, (VALUES
    ('single', 'Single', 10),
    ('2-tier', '2-tier', 20),
    ('3-tier', '3-tier', 30)
  ) v(slug, label, ord)
ON CONFLICT (attribute_id, slug) DO NOTHING;

-- Dietary values (eggless = ~25% of PK orders — first-class, not an add-on)
WITH a AS (SELECT id FROM public.attributes WHERE slug = 'dietary')
INSERT INTO public.attribute_values (attribute_id, slug, label, display_order, is_active)
SELECT a.id, v.slug, v.label, v.ord, true
  FROM a, (VALUES
    ('regular',    'Regular',    10),
    ('eggless',    'Eggless',    20),
    ('sugar-free', 'Sugar-free', 30)
  ) v(slug, label, ord)
ON CONFLICT (attribute_id, slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Admin user — NOT here. Manually create in Studio:
--      Authentication → Users → Add user → real password (NOT 'admin').
--      Then in Table Editor → public.profiles → set role = 'admin' on that row.
--    This is intentional: closes the `admin@kakeez.com / admin` footgun from
--    20260615000001_seed_admin.sql by keeping all admin creds out of git.
-- ============================================================================
