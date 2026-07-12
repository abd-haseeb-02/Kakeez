# Phase 5 - Checkout Economics (part 1)

**Status:** part 1 in current working tree
**Plan reference:** [`ECOMMERCE_CMS_PLAN.md`](../../ECOMMERCE_CMS_PLAN.md) Phase 5 + G.X.1/G.X.5

This slice keeps Phase 1's security invariant intact: the browser
still sends only product IDs, variation IDs, quantity, and customer
inputs. Prices remain server-authoritative.

## Implemented

- Added `previewCheckout()` in `src/app/checkout/actions.ts`.
- Preview re-reads published product base prices and active variation
  deltas from Supabase.
- Promo codes are checked through `validate_coupon_for_cart`, replacing
  the old client-side promo dictionary.
- Delivery is previewed through `compute_delivery_minor`.
- Free-shipping coupons zero the preview delivery fee.
- Preview reads the default `tax_rates.rate_bp` and applies it to the
  discounted subtotal.
- Checkout UI now displays server-previewed subtotal, discount,
  delivery, tax, and grand total.
- Checkout UI captures an optional delivery date/window and sends it
  with the order payload.
- Preview refresh is debounced while the customer edits address fields.
- Final order submission reuses the same server cart payload shape.
- `supabase/migrations/20260621000001_order_tax_totals.sql` adds
  `compute_tax_minor()` and updates `create_order` so persisted order
  totals include the configured default tax rate and snapshot the
  optional delivery slot.
- `/admin/settings` now has real Delivery and Tax tabs backed by
  `delivery_zones`, `delivery_methods`, and `tax_rates` instead of
  static placeholders.

## Notes

- The seeded default tax rate remains 0%, so launch totals do not
  visibly change until admins configure a non-zero default rate.
- `create_order` remains the order-time authority and still validates
  cart/product/stock/prices in the database transaction.

## Verified

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Local dev server responds at `http://localhost:3000` and
  `http://localhost:3000/checkout`.

## Remaining

- Add transactional emails/status notifications.
