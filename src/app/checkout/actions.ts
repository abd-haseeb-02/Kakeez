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
}

export interface CheckoutInput {
  cart: CheckoutCartLine[]
  address: CheckoutAddress
  promoCode?: string
  isGift?: boolean
}

export type CheckoutResult =
  | { ok: true; orderId: string }
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
