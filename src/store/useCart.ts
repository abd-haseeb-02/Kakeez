import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MinorUnits } from '@/lib/money'

// Cart store — persisted to localStorage as 'kakeez-cart'.
//
// SECURITY NOTE (AUDIT.md §B Critical #1 / ECOMMERCE_CMS_PLAN.md §F.0 + §G.X.1):
// The fields below LOOK like a server-trusted cart, but the source of truth for
// money is the server `create_order` RPC. That RPC accepts only `productId`,
// `variationId`, `quantity`, and customer-selected options — it ignores any
// `priceMinor` / `image` / `name` value sent from the browser, re-reads the
// product + variation from the database, and computes line totals from
// `products.base_price_minor + product_variations.price_delta_minor`. So even
// if a user edits `localStorage["kakeez-cart"]` to set `priceMinor: 1`, the
// order they create is charged at the real price. The fields here are kept only
// so the cart drawer renders instantly without refetching the catalog.
//
// What this means in practice for future edits:
//   - NEVER add server-side code that reads `priceMinor` from this cart shape.
//   - NEVER send the full CartItem to the server; only send {productId,
//     variationId, quantity, options}.
//   - The `priceMinor` field is a display snapshot that can go stale — the
//     checkout summary shows the SERVER-RETURNED preview, which wins.
//
// Two identities, deliberately kept apart:
//   `id`  is the PRODUCT id. It is what the server needs, and several products
//         can share it across cart lines.
//   `key` is the CART LINE id — product + variation. Everything that mutates
//         the cart keys off this. They used to be the same field, which meant
//         a 1 lb and a 2 lb of the same cake collapsed into one line at one
//         price, keeping whichever variation was added first: the customer was
//         charged for, and sent, two of the wrong size.

export type CartLineKey = string

export interface CartItem {
  key: CartLineKey
  id: string
  name: string
  // Integer paisa, matching the *_minor convention used everywhere else (see
  // src/lib/money.ts). Held as an integer rather than rupees so quantity math
  // can't accumulate float error and so every render can go straight through
  // formatPkr instead of hand-rolling toFixed(2).
  priceMinor: MinorUnits
  quantity: number
  image: string
  description?: string
  variationId?: string | null
  variationLabel?: string
  options?: Record<string, unknown>
  customMessage?: string
}

// What a caller supplies — the line key is derived, never passed in.
export type CartItemInput = Omit<CartItem, 'key'>

// Matches the server's own clamp in src/app/checkout/actions.ts (sanitizeCart),
// so the cart can't offer a quantity checkout would silently reduce.
export const MAX_QUANTITY = 99

export function lineKey(productId: string, variationId?: string | null): CartLineKey {
  return `${productId}::${variationId ?? 'base'}`
}

const clampQuantity = (n: number) =>
  Math.max(1, Math.min(MAX_QUANTITY, Math.floor(Number(n) || 1)))

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItemInput) => void
  removeItem: (key: CartLineKey) => void
  updateQuantity: (key: CartLineKey, quantity: number) => void
  clearCart: () => void
  totalItems: () => number
  totalMinor: () => MinorUnits   // display-only sum of cached prices
}

// Shape of a pre-v2 persisted cart: keyed on the product id alone, with the
// price in rupees as a float.
type LegacyCartItem = Omit<CartItem, 'key' | 'priceMinor'> & { price?: number }

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (input) => {
        const key = lineKey(input.id, input.variationId)
        const requested = clampQuantity(input.quantity)
        const items = get().items
        const existing = items.find((item) => item.key === key)

        if (existing) {
          // Add what was asked for. This used to be `quantity + 1`, which threw
          // away the number the customer picked: the product page's quantity
          // stepper showed 3, a second "Add to cart" moved the line from 3 to 4.
          set({
            items: items.map((item) =>
              item.key === key
                ? { ...item, quantity: clampQuantity(item.quantity + requested) }
                : item
            ),
          })
          return
        }

        set({ items: [...items, { ...input, key, quantity: requested }] })
      },

      removeItem: (key) =>
        set({ items: get().items.filter((item) => item.key !== key) }),

      updateQuantity: (key, quantity) =>
        set({
          items: get().items.map((item) =>
            item.key === key ? { ...item, quantity: clampQuantity(quantity) } : item
          ),
        }),

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((acc, item) => acc + item.quantity, 0),

      totalMinor: () => get().items.reduce((acc, item) => acc + item.priceMinor * item.quantity, 0),
    }),
    {
      name: 'kakeez-cart',
      // v2 renamed `price` (rupees, float) to `priceMinor` (paisa, integer) and
      // introduced `key`. Without this migration every cart already sitting in a
      // customer's localStorage would render NaN and lose its lines.
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { items?: LegacyCartItem[] } | undefined
        if (!state?.items) return { items: [] }
        if (version >= 2) return state as unknown as { items: CartItem[] }

        return {
          items: state.items
            .filter((item) => item && typeof item.id === 'string')
            .map((item) => ({
              ...item,
              key: lineKey(item.id, item.variationId),
              priceMinor: Math.round(Number(item.price ?? 0) * 100),
              quantity: clampQuantity(item.quantity),
            })),
        }
      },
    }
  )
)

// Whether the cart drawer is showing. Separate from the cart itself, and
// deliberately not persisted: the drawer lived in Navbar's local state, so
// nothing outside Navbar could open it — the product page could add an item but
// not show the cart it went into.
export const useCartDrawer = create<{
  isOpen: boolean
  open: () => void
  close: () => void
}>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
