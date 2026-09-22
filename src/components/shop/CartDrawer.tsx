"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useCart } from "@/store/useCart"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Minus, Plus, Trash2, ChevronLeft, ChevronRight, ShoppingBag, ShoppingCart, Loader2, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { formatPkr } from "@/lib/money"
import { FALLBACK_DELIVERY_MINOR } from "@/lib/delivery"
import UserAuthPopup from "./UserAuthPopup"
import { useModalA11y } from "@/lib/use-modal-a11y"
import { useToast } from "@/components/ui/Toast"

type PopularProduct = {
  id: string
  name: string
  priceMinor: number
  image_url: string | null
  description: string | null
}

type ProductImageRow = {
  storage_path: string
  position: number
  is_featured: boolean
}

type PopularProductRow = {
  id: string
  name: string
  base_price_minor: number | null
  description: string | null
  product_images?: ProductImageRow[]
}

// "Clear cart" throws away work with no undo, so it asks once. Inline rather
// than a window.confirm: the drawer is already a dialog, and a native confirm
// would be the only unstyled surface in the flow.
const CONFIRM_WINDOW_MS = 4000

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { items, addItem, removeItem, updateQuantity, totalMinor, clearCart } = useCart()
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [isVisible, setIsVisible] = useState(false)
  const [popular, setPopular] = useState<PopularProduct[]>([])
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const toast = useToast()
  // Closing must also disarm "Clear cart", so reopening never lands on a primed
  // destructive button. Every exit — Escape, backdrop, the X, "Start shopping",
  // and the jump to checkout — goes through this rather than onClose directly.
  const closeDrawer = useCallback(() => {
    setConfirmingClear(false)
    onClose()
  }, [onClose])

  // Escape to close, focus trapped inside the drawer, page behind locked.
  const dialogRef = useModalA11y(isOpen && shouldRender, closeDrawer)

  useEffect(() => {
    const renderTimer = window.setTimeout(() => {
      if (isOpen) {
        setShouldRender(true)
        window.requestAnimationFrame(() => setIsVisible(true))
      } else {
        setIsVisible(false)
      }
    }, 0)
    const removeTimer = isOpen ? undefined : window.setTimeout(() => setShouldRender(false), 300)

    return () => {
      window.clearTimeout(renderTimer)
      if (removeTimer) window.clearTimeout(removeTimer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!confirmingClear) return
    const timer = window.setTimeout(() => setConfirmingClear(false), CONFIRM_WINDOW_MS)
    return () => window.clearTimeout(timer)
  }, [confirmingClear])

  useEffect(() => {
    if (!isOpen || popular.length > 0) return

    const fetchPopular = async () => {
      // New schema: price → base_price_minor (paisa); image_url → product_images.
      const { data } = await supabase
        .from("products")
        .select("id, name, base_price_minor, description, product_images(storage_path, position, is_featured)")
        .eq("status", "published")
        .order("is_best_seller", { ascending: false })
        .limit(8)

      if (data) {
        setPopular(
          (data as PopularProductRow[]).map((p) => {
            const hero = p.product_images?.find((i) => i.is_featured) ?? p.product_images?.[0]
            return {
              id: p.id,
              name: p.name,
              priceMinor: p.base_price_minor ?? 0,
              image_url: hero?.storage_path ?? null,
              description: p.description ?? null,
            }
          })
        )
      }
    }

    fetchPopular()
  }, [isOpen, popular.length])

  // The upsell rail scrolls natively instead of being translated by a fixed
  // pixel step. The old version moved 312px per click while the cards were
  // `max-w-[calc(92vw-52px)]` — 279px on a 360px phone — so every click drifted
  // 21px and by the last card nothing lined up. Native scrolling also gives
  // touch swiping for free, which is what a phone user reaches for anyway.
  const syncArrows = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1)
  }, [])

  useEffect(() => {
    if (popular.length === 0) return
    syncArrows()
  }, [popular.length, syncArrows])

  const scrollRail = (direction: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const step = card ? card.getBoundingClientRect().width + 12 : el.clientWidth
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  const handleCheckoutClick = async () => {
    setLoadingCheckout(true)
    const { data: { session } } = await supabase.auth.getSession()
    setLoadingCheckout(false)

    if (!session) {
      setShowAuthPopup(true)
      return
    }

    closeDrawer()
    router.push("/checkout")
  }

  const handleClearCart = () => {
    if (!confirmingClear) { setConfirmingClear(true); return }
    clearCart()
    setConfirmingClear(false)
  }

  const subtotalMinor = totalMinor()
  const deliveryMinor = items.length > 0 ? FALLBACK_DELIVERY_MINOR : 0
  const grandTotalMinor = subtotalMinor + deliveryMinor

  return (
    <>
      <UserAuthPopup
        isOpen={showAuthPopup}
        onClose={() => setShowAuthPopup(false)}
        onSuccess={() => {
          setShowAuthPopup(false)
          handleCheckoutClick()
        }}
      />

      {shouldRender && (
        <div className={`fixed inset-0 z-[100] flex justify-end ${isVisible ? "" : "pointer-events-none"}`}>
          <div
            className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ease-out ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeDrawer}
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            className={`relative flex h-full w-[min(92vw,430px)] transform flex-col rounded-l-[14px] bg-white shadow-[0_0_18px_8px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-out md:w-[clamp(390px,27vw,470px)] ${
              isVisible ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between gap-3 px-[clamp(18px,1.35vw,24px)] pt-[clamp(18px,1.35vw,24px)] pb-[clamp(14px,1vw,18px)]">
              <h2 id="cart-drawer-title" className="ff-accia text-[clamp(19px,1.05vw,22px)] text-black">Your Cart</h2>
              <div className="flex items-center gap-4">
                {items.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className={`ff-accia text-[clamp(15px,0.9vw,17px)] underline decoration-solid transition-colors ${
                      confirmingClear ? "text-red-600" : "text-primary-brown hover:opacity-70"
                    }`}
                  >
                    {confirmingClear ? "Tap again to clear" : "Clear cart"}
                  </button>
                )}
                {/* Escape and a backdrop tap both closed the drawer, but neither
                    is discoverable on a phone. */}
                <button
                  onClick={closeDrawer}
                  className="-mr-1 rounded-full p-1.5 text-black/50 transition-colors hover:bg-black/5 hover:text-black"
                  aria-label="Close cart"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-[clamp(18px,1.35vw,24px)] pb-[18px]">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-5 py-20 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-green/40">
                    <ShoppingBag size={36} className="text-primary-brown/40" />
                  </div>
                  <p className="ff-accia-light text-[18px] text-black/50">Your cart is feeling a bit empty...</p>
                  <button onClick={closeDrawer} className="ff-accia text-[17px] text-primary-brown underline underline-offset-4">
                    Start shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  {items.map((item) => (
                    <div key={item.key} className="relative flex gap-4">
                      <div className="relative h-[78px] w-[78px] shrink-0 overflow-hidden rounded-[10px] border border-primary-brown bg-[#ece9e2]">
                        {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="ff-accia text-[clamp(22px,1.3vw,26px)] leading-[0.98] text-black">{item.name}</h3>
                        {/* The picked size/flavour was stored but never shown, so
                            two variations of one cake looked like the same line. */}
                        {item.variationLabel && (
                          <p className="ff-apfel mt-1 text-[13px] text-primary-brown">{item.variationLabel}</p>
                        )}
                        {item.description && (
                          <p className="ff-accia-light mt-1.5 line-clamp-2 text-[15px] capitalize leading-[1.25] text-black">
                            {item.description}
                          </p>
                        )}

                        {/* Line total leads, unit price explains it. The drawer
                            used to print the unit price alone while checkout
                            printed the line total, so the same cake appeared to
                            jump from Rs. 2,550.00 to Rs. 10,200.00 between the
                            two screens. */}
                        <p className="ff-accia mt-2 text-[18px] text-primary-brown">
                          {formatPkr(item.priceMinor * item.quantity)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="ff-apfel text-[12px] text-black/45">
                            {item.quantity} × {formatPkr(item.priceMinor)}
                          </p>
                        )}

                        <div className="mt-2.5 inline-flex h-9 items-center justify-between gap-3 rounded-full border border-black px-3">
                          <button
                            onClick={() => updateQuantity(item.key, item.quantity - 1)}
                            className="text-primary-brown hover:opacity-60 transition-opacity"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="ff-accia min-w-5 text-center text-[18px] leading-none text-primary-brown">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.key, item.quantity + 1)}
                            className="text-primary-brown hover:opacity-60 transition-opacity"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => removeItem(item.key)}
                        className="self-start pt-2 text-black/70 hover:text-red-500 transition-colors"
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}

                  {popular.length > 0 && (
                    <div className="relative mt-6 overflow-hidden rounded-xl border border-primary-brown bg-accent-green">
                      <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <span className="ff-accia text-[19px] text-primary-brown">Popular Items</span>
                        <div className="flex items-center gap-3 text-primary-brown">
                          <button
                            onClick={() => scrollRail(-1)}
                            disabled={atStart}
                            className="disabled:opacity-30 hover:opacity-60 transition-opacity"
                            aria-label="Previous popular item"
                          >
                            <ChevronLeft className="h-5 w-4" />
                          </button>
                          <button
                            onClick={() => scrollRail(1)}
                            disabled={atEnd}
                            className="disabled:opacity-30 hover:opacity-60 transition-opacity"
                            aria-label="Next popular item"
                          >
                            <ChevronRight className="h-5 w-4" />
                          </button>
                        </div>
                      </div>

                      <div
                        ref={trackRef}
                        onScroll={syncArrows}
                        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-2 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {popular.map((p) => (
                          <div key={p.id} className="flex w-[min(300px,calc(92vw-52px))] shrink-0 snap-start gap-3 rounded-[10px] bg-white p-3">
                            <div className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-[10px] border border-primary-brown bg-[#ece9e2]">
                              {p.image_url && <Image src={p.image_url} alt={p.name} fill className="object-cover" />}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <h4 className="ff-accia line-clamp-2 text-[18px] leading-[1.05] text-black">{p.name}</h4>
                              <p className="ff-accia mt-0.5 text-[14px] text-primary-brown">{formatPkr(p.priceMinor, { trimDecimals: true })}</p>
                              {/* The button used to be labelled with the price
                                  alone, so nothing said it added anything and a
                                  screen reader announced a bare number. */}
                              <button
                                onClick={() => {
                                  addItem({ id: p.id, name: p.name, priceMinor: p.priceMinor, quantity: 1, image: p.image_url || "/assets/product.svg", description: p.description || undefined })
                                  toast.push({ kind: 'success', title: `Added to cart — ${p.name}`, durationMs: 4000 })
                                }}
                                className="ff-accia-light mt-auto flex items-center gap-1.5 self-start rounded-md bg-accent-green px-3 py-1 text-[12px] uppercase tracking-wide text-primary-brown transition-colors hover:bg-accent-green/70"
                                aria-label={`Add ${p.name} to cart`}
                              >
                                <ShoppingCart className="h-3 w-3" /> Add
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-primary-brown/10 bg-white px-[clamp(18px,1.35vw,24px)] pt-4 pb-[clamp(18px,1.35vw,24px)]">
                <div className="flex items-center justify-between">
                  <span className="ff-accia-light text-[18px] text-black capitalize">Subtotal</span>
                  <span className="ff-accia-light text-[18px] text-black">{formatPkr(subtotalMinor)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {/* Named an estimate because it is one: the real fee depends on
                      the delivery zone and is quoted by the server at checkout. */}
                  <span className="ff-accia-light text-[18px] text-black capitalize">Delivery (estimated)</span>
                  <span className="ff-accia-light text-[18px] text-black">{formatPkr(deliveryMinor)}</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="ff-accia-medium text-[19px] text-black">Grand total</span>
                  <span className="ff-accia-medium text-[19px] text-black">{formatPkr(grandTotalMinor)}</span>
                </div>
                <p className="ff-apfel mt-1.5 text-[11px] leading-snug text-black/45">
                  Delivery is confirmed against your address at checkout.
                </p>

                <button
                  onClick={handleCheckoutClick}
                  disabled={loadingCheckout}
                  className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-primary-brown hover:bg-primary-brown/90 transition-all disabled:opacity-60"
                >
                  {loadingCheckout
                    ? <Loader2 className="animate-spin text-white" size={22} />
                    : <span className="ff-accia-medium text-[24px] text-white">Checkout</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
