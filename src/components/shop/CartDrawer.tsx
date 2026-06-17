"use client"

import { useState, useEffect } from "react"
import { useCart } from "@/store/useCart"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Minus, Plus, Trash2, ChevronLeft, ChevronRight, ShoppingBag, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import UserAuthPopup from "./UserAuthPopup"

const DELIVERY_CHARGE = 99

type PopularProduct = {
  id: string
  name: string
  price: number
  image_url: string | null
  description: string | null
}

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { items, addItem, removeItem, updateQuantity, totalPrice, clearCart } = useCart()
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [popular, setPopular] = useState<PopularProduct[]>([])
  const [popIndex, setPopIndex] = useState(0)
  const router = useRouter()

  useEffect(() => {
    if (!isOpen || popular.length > 0) return

    const fetchPopular = async () => {
      // New schema: price → base_price_minor (paisa); image_url → product_images.
      // Project back to the local PopularProduct shape so the rest of the drawer
      // stays unchanged.
      const { data } = await supabase
        .from("products")
        .select("id, name, base_price_minor, description, product_images(storage_path, position, is_featured)")
        .eq("status", "published")
        .order("is_best_seller", { ascending: false })
        .limit(8)

      if (data) {
        setPopular(
          (data as any[]).map((p) => {
            const hero = p.product_images?.find((i: any) => i.is_featured) ?? p.product_images?.[0]
            return {
              id: p.id,
              name: p.name,
              price: (p.base_price_minor ?? 0) / 100,
              image_url: hero?.storage_path ?? null,
              description: p.description ?? null,
            }
          })
        )
      }
    }

    fetchPopular()
  }, [isOpen, popular.length])

  const handleCheckoutClick = async () => {
    setLoadingCheckout(true)
    const { data: { session } } = await supabase.auth.getSession()
    setLoadingCheckout(false)

    if (!session) {
      setShowAuthPopup(true)
      return
    }

    onClose()
    router.push("/checkout")
  }

  const subtotal = totalPrice()
  const delivery = items.length > 0 ? DELIVERY_CHARGE : 0
  const grandTotal = subtotal + delivery

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

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          <div className="relative flex h-full w-[min(92vw,430px)] flex-col rounded-l-[14px] bg-white shadow-[0_0_18px_8px_rgba(0,0,0,0.16)] animate-in slide-in-from-right duration-500 md:w-[clamp(390px,27vw,470px)]">
            <div className="flex items-end justify-between px-[clamp(18px,1.35vw,24px)] pt-[clamp(18px,1.35vw,24px)] pb-[clamp(14px,1vw,18px)]">
              <h2 className="ff-accia text-[clamp(19px,1.05vw,22px)] text-black">Your Cart</h2>
              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="ff-accia text-[clamp(17px,0.95vw,20px)] text-primary-brown underline decoration-solid hover:opacity-70 transition-opacity"
                >
                  Clear cart
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-[clamp(18px,1.35vw,24px)] pb-[18px]">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-5 py-20 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-green/40">
                    <ShoppingBag size={36} className="text-primary-brown/40" />
                  </div>
                  <p className="ff-accia-light text-[18px] text-black/50">Your cart is feeling a bit empty...</p>
                  <button onClick={onClose} className="ff-accia text-[17px] text-primary-brown underline underline-offset-4">
                    Start shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  {items.map((item) => (
                    <div key={item.id} className="relative flex gap-4">
                      <div className="relative h-[78px] w-[78px] shrink-0 overflow-hidden rounded-[10px] border border-primary-brown bg-[#ece9e2]">
                        {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="ff-accia text-[clamp(22px,1.3vw,26px)] leading-[0.98] text-black">{item.name}</h3>
                        {item.description && (
                          <p className="ff-accia-light mt-1.5 line-clamp-2 text-[15px] capitalize leading-[1.25] text-black">
                            {item.description}
                          </p>
                        )}
                        <p className="ff-accia mt-2 text-[18px] text-primary-brown">Rs. {Number(item.price).toFixed(2)}</p>

                        <div className="mt-2.5 inline-flex h-9 items-center justify-between gap-3 rounded-full border border-black px-3">
                          <button
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            className="text-primary-brown hover:opacity-60 transition-opacity"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="ff-accia min-w-5 text-center text-[18px] leading-none text-primary-brown">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="text-primary-brown hover:opacity-60 transition-opacity"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="self-start pt-2 text-black/70 hover:text-red-500 transition-colors"
                        aria-label="Remove item"
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
                            onClick={() => setPopIndex((i) => Math.max(0, i - 1))}
                            disabled={popIndex === 0}
                            className="disabled:opacity-30 hover:opacity-60 transition-opacity"
                            aria-label="Previous popular item"
                          >
                            <ChevronLeft className="h-5 w-4" />
                          </button>
                          <button
                            onClick={() => setPopIndex((i) => Math.min(popular.length - 1, i + 1))}
                            disabled={popIndex >= popular.length - 1}
                            className="disabled:opacity-30 hover:opacity-60 transition-opacity"
                            aria-label="Next popular item"
                          >
                            <ChevronRight className="h-5 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="overflow-hidden px-2 pb-2">
                        <div
                          className="flex gap-3 transition-transform duration-300"
                          style={{ transform: `translateX(calc(-${popIndex} * (300px + 12px)))` }}
                        >
                          {popular.map((p) => (
                            <div key={p.id} className="flex w-[300px] max-w-[calc(92vw-52px)] shrink-0 gap-3 rounded-[10px] bg-white p-3">
                              <div className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-[10px] border border-primary-brown bg-[#ece9e2]">
                                {p.image_url && <Image src={p.image_url} alt={p.name} fill className="object-cover" />}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <h4 className="ff-accia line-clamp-2 text-[18px] leading-[1.05] text-black">{p.name}</h4>
                                {p.description && (
                                  <p className="ff-accia-light mt-1 line-clamp-2 text-[12px] capitalize leading-[1.2] text-black">
                                    {p.description}
                                  </p>
                                )}
                                <button
                                  onClick={() => addItem({ id: p.id, name: p.name, price: p.price, quantity: 1, image: p.image_url || "/assets/product.svg", description: p.description || undefined })}
                                  className="ff-accia-light mt-auto self-start rounded-md bg-accent-green px-3 py-1 text-[12px] capitalize text-primary-brown hover:bg-accent-green/70 transition-colors"
                                >
                                  Rs. {Number(p.price).toFixed(2)}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
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
                  <span className="ff-accia-light text-[18px] text-black">Rs. {subtotal.toFixed(2)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="ff-accia-light text-[18px] text-black capitalize">Delivery charges</span>
                  <span className="ff-accia-light text-[18px] text-black">Rs. {delivery.toFixed(2)}</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="ff-accia-medium text-[19px] text-black">Grand total</span>
                  <span className="ff-accia-medium text-[19px] text-black">Rs. {grandTotal.toFixed(2)}</span>
                </div>

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
