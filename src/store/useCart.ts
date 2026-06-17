import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Cart store — persisted to localStorage as 'kakeez-cart'.
//
// SECURITY NOTE (AUDIT.md §B Critical #1 / ECOMMERCE_CMS_PLAN.md §F.0 + §G.X.1):
// The fields below LOOK like a server-trusted cart, but the source of truth for
// money is the server `create_order` RPC. That RPC accepts only `productId`,
// `variationId`, `quantity`, and customer-selected options — it ignores any
// `price` / `image` / `name` value sent from the browser, re-reads the product
// + variation from the database, and computes line totals from
// `products.base_price_minor + product_variations.price_delta_minor`. So even
// if a user edits `localStorage["kakeez-cart"]` to set `price: 1`, the order
// they create is charged at the real price. The fields here are kept only so
// the cart drawer renders instantly without refetching the catalog every open.
//
// What this means in practice for future edits:
//   - NEVER add server-side code that reads `price` from this cart shape.
//   - NEVER send the full CartItem to the server; only send {productId,
//     variationId, quantity, options}.
//   - The `price` field is a display snapshot that can go stale — fine for
//     the drawer; the checkout summary shows the SERVER-RETURNED preview.

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
  description?: string
  // Future fields for variations + custom-cake add-ons (B.1.X.4). Optional so
  // existing rows survive the schema bump.
  variationId?: string | null
  variationLabel?: string
  options?: Record<string, unknown>
  customMessage?: string
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  totalItems: () => number
  totalPrice: () => number              // display-only sum of cached prices
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (newItem) => {
        const currentItems = get().items
        const existingItem = currentItems.find((item) => item.id === newItem.id)

        if (existingItem) {
          set({
            items: currentItems.map((item) =>
              item.id === newItem.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ),
          })
        } else {
          set({ items: [...currentItems, newItem] })
        }
      },
      removeItem: (id) =>
        set({ items: get().items.filter((item) => item.id !== id) }),
      updateQuantity: (id, quantity) =>
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, quantity } : item
          ),
        }),
      clearCart: () => set({ items: [] }),
      totalItems: () => get().items.reduce((acc, item) => acc + item.quantity, 0),
      totalPrice: () => get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    }),
    {
      name: 'kakeez-cart',
    }
  )
)
