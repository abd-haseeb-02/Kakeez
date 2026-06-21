'use server'

// Server-side checkout entry point. The cart payload arrives here from the
// browser; we forward ONLY the identifiers + quantity + customer-selected
// options to the create_order RPC. Any `price` / `name` / `image` the client
// also persisted in localStorage is intentionally discarded — see
// ECOMMERCE_CMS_PLAN.md §G.X.1 and src/store/useCart.ts header for the
// security rationale.

import { createClient } from '@/lib/supabase/server'

export interface CheckoutCartLine {
  productId: string
  variationId?: string | null
  quantity: number
  customMessage?: string
}

export interface CheckoutAddress {
  recipient_name: string
  phone_e164: string
  line1: string
  line2?: string
  area?: string
  city?: string
  instructions?: string
  delivery_slot_date?: string
  delivery_slot_window?: string
}

export interface CheckoutInput {
  cart: CheckoutCartLine[]
  address: CheckoutAddress
  promoCode?: string
  isGift?: boolean
}

export interface CheckoutPreviewInput {
  cart: CheckoutCartLine[]
  address: Partial<CheckoutAddress>
  promoCode?: string
}

export type CheckoutResult =
  | { ok: true; orderId: string }
  | { ok: false; code: string; message: string }

export type CheckoutPreviewResult =
  | {
      ok: true
      subtotalMinor: number
      discountMinor: number
      deliveryFeeMinor: number
      taxMinor: number
      totalMinor: number
      promoCode: string | null
      promoType: string | null
    }
  | { ok: false; code: string; message: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sanitizeCart(raw: CheckoutCartLine[]): CheckoutCartLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((it) => it && UUID_RE.test(it.productId))
    .map((it) => ({
      productId: it.productId,
      variationId: it.variationId && UUID_RE.test(it.variationId) ? it.variationId : null,
      quantity: Math.max(1, Math.min(99, Math.floor(Number(it.quantity) || 0))),
      customMessage: typeof it.customMessage === 'string' ? it.customMessage.slice(0, 200) : undefined,
    }))
}

function friendlyMessage(pgMessage: string): { code: string; message: string } {
  // The RPC raises errors of the form `code` or `code:detail` (see RPC body).
  const head = pgMessage.split(':')[0].trim()
  switch (head) {
    case 'auth_required':
      return { code: 'auth_required', message: 'Please sign in to complete checkout.' }
    case 'empty_cart':
      return { code: 'empty_cart', message: 'Your cart is empty.' }
    case 'invalid_cart_shape':
      return { code: 'invalid_cart_shape', message: 'Some items in your cart look wrong. Please refresh and try again.' }
    case 'product_not_found':
      return { code: 'product_not_found', message: 'One of the products in your cart is no longer available. Please refresh.' }
    case 'variation_not_found':
      return { code: 'variation_not_found', message: 'A selected option is no longer available. Please re-pick it.' }
    case 'out_of_stock':
      return { code: 'out_of_stock', message: 'Sorry — one of your items just sold out. Please remove it and try again.' }
    case 'payment_method_unsupported':
      return { code: 'payment_method_unsupported', message: 'Only Cash on Delivery is supported right now.' }
    default:
      return { code: 'server_error', message: 'Could not place your order. Please try again.' }
  }
}

type ProductPriceRow = {
  id: string
  base_price_minor: number
}

type VariationPriceRow = {
  id: string
  product_id: string
  price_delta_minor: number
}

type CouponPreviewRow = {
  code: string
  type: string
  discount_minor: number
}

type TaxRateRow = {
  rate_bp: number
}

export async function previewCheckout(input: CheckoutPreviewInput): Promise<CheckoutPreviewResult> {
  const supabase = await createClient()
  const cart = sanitizeCart(input.cart)

  if (cart.length === 0) {
    return { ok: true, subtotalMinor: 0, discountMinor: 0, deliveryFeeMinor: 0, taxMinor: 0, totalMinor: 0, promoCode: null, promoType: null }
  }

  const productIds = [...new Set(cart.map((item) => item.productId))]
  const variationIds = [...new Set(cart.map((item) => item.variationId).filter((id): id is string => Boolean(id)))]

  const [productsRes, variationsRes] = await Promise.all([
    supabase
      .from('products')
      .select('id, base_price_minor')
      .in('id', productIds)
      .eq('status', 'published')
      .is('deleted_at', null),
    variationIds.length > 0
      ? supabase
          .from('product_variations')
          .select('id, product_id, price_delta_minor')
          .in('id', variationIds)
          .eq('is_active', true)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),
  ])

  if (productsRes.error) {
    return { ok: false, code: 'server_error', message: 'Could not preview checkout totals.' }
  }

  const products = new Map(((productsRes.data as ProductPriceRow[] | null) ?? []).map((product) => [product.id, product]))
  const variations = new Map(((variationsRes.data as VariationPriceRow[] | null) ?? []).map((variation) => [variation.id, variation]))
  let subtotalMinor = 0

  for (const item of cart) {
    const product = products.get(item.productId)
    if (!product) {
      return { ok: false, code: 'product_not_found', message: 'One of the products in your cart is no longer available. Please refresh.' }
    }

    let unitMinor = product.base_price_minor
    if (item.variationId) {
      const variation = variations.get(item.variationId)
      if (!variation || variation.product_id !== item.productId) {
        return { ok: false, code: 'variation_not_found', message: 'A selected option is no longer available. Please re-pick it.' }
      }
      unitMinor += variation.price_delta_minor
    }

    subtotalMinor += unitMinor * item.quantity
  }

  const promoCode = input.promoCode?.trim() || ''
  let discountMinor = 0
  let appliedPromoCode: string | null = null
  let promoType: string | null = null

  if (promoCode) {
    const { data: couponRows, error } = await supabase.rpc('validate_coupon_for_cart', {
      p_code: promoCode,
      p_subtotal_minor: subtotalMinor,
    })
    if (error) {
      return { ok: false, code: 'coupon_error', message: 'Could not check that promo code.' }
    }

    const coupon = (couponRows as CouponPreviewRow[] | null)?.[0]
    if (!coupon) {
      return { ok: false, code: 'invalid_coupon', message: 'Invalid or expired promo code.' }
    }
    discountMinor = coupon.discount_minor
    appliedPromoCode = coupon.code
    promoType = coupon.type
  }

  const { data: deliveryData, error: deliveryError } = await supabase.rpc('compute_delivery_minor', {
    p_address: input.address ?? {},
  })
  if (deliveryError) {
    return { ok: false, code: 'delivery_error', message: 'Could not preview delivery charges.' }
  }

  const deliveryFeeMinor = promoType === 'free_shipping' ? 0 : Number(deliveryData ?? 0)
  const { data: taxRate } = await supabase
    .from('tax_rates')
    .select('rate_bp')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle()
  const rateBp = Number((taxRate as TaxRateRow | null)?.rate_bp ?? 0)
  const taxableMinor = Math.max(0, subtotalMinor - discountMinor)
  const taxMinor = Math.floor((taxableMinor * rateBp) / 10000)
  const totalMinor = Math.max(0, subtotalMinor - discountMinor) + deliveryFeeMinor + taxMinor

  return {
    ok: true,
    subtotalMinor,
    discountMinor,
    deliveryFeeMinor,
    taxMinor,
    totalMinor,
    promoCode: appliedPromoCode,
    promoType,
  }
}

export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const supabase = await createClient()

  // Confirm the session exists server-side before burning an RPC call. The
  // RPC itself also checks auth.uid(); this is just for a clean error.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return { ok: false, code: 'auth_required', message: 'Please sign in to complete checkout.' }
  }

  const cart = sanitizeCart(input.cart)
  if (cart.length === 0) {
    return { ok: false, code: 'empty_cart', message: 'Your cart is empty.' }
  }

  const { data, error } = await supabase.rpc('create_order', {
    p_cart: cart,
    p_address: input.address ?? {},
    p_payment_method: 'cod',
    p_promo_code: input.promoCode ?? null,
    p_is_gift: !!input.isGift,
  })

  if (error) {
    return { ok: false, ...friendlyMessage(error.message ?? '') }
  }
  if (typeof data !== 'string') {
    return { ok: false, code: 'server_error', message: 'Order was not created. Please try again.' }
  }
  return { ok: true, orderId: data }
}
