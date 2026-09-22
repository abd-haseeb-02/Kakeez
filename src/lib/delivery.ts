// Delivery pricing shown before the server has quoted a real one.
//
// The authoritative fee comes from `delivery_methods` via the checkout preview
// RPC, and depends on the address. Everything before that point — the cart
// drawer especially, which runs before we know where the order is going — can
// only show an estimate, and must say so.
//
// This lived as a separate literal in both the cart drawer and the checkout
// page. They happened to agree; nothing made them agree.

import type { MinorUnits } from '@/lib/money'

export const FALLBACK_DELIVERY_MINOR: MinorUnits = 9900
