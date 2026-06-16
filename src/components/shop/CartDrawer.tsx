"use client"

import { useState, useEffect } from "react"
import { useCart } from "@/store/useCart"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Minus, Plus, Trash2, ChevronLeft, ChevronRight, ShoppingBag, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import UserAuthPopup from "./UserAuthPopup"

const DELIVERY_CHARGE = 99

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { items, addItem, removeItem, updateQuantity, totalPrice, clearCart } = useCart()
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [popular, setPopular] = useState<any[]>([])
  const [popIndex, setPopIndex] = useState(0)
  const router = useRouter()

  // Fetch a few products to surface as "Popular Items"
  useEffect(() => {
    if (!isOpen || popular.length > 0) return
    const fetchPopular = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .order('is_best_seller', { ascending: false })
        .limit(8)
      if (data) setPopular(data)
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
    router.push('/checkout')
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
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

          {/* Drawer panel — 577px / 17.28 ≈ 33.4vw */}
          <div className="relative w-[33.4vw] min-w-[360px] bg-white h-full rounded-l-[0.87vw] shadow-[0_0_1vw_0.75vw_rgba(0,0,0,0.18)] animate-in slide-in-from-right duration-500 flex flex-col">

            {/* Header */}
            <div className="flex items-end justify-between px-[1.56vw] pt-[1.6vw] pb-[1.1vw]">
              <h2 className="ff-accia text-[1.27vw] text-black tracking-[-0.025vw]">Your Cart</h2>
              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="ff-accia text-[1.27vw] text-primary-brown underline decoration-solid tracking-[-0.025vw] hover:opacity-70 transition-opacity"
                >
                  Clear cart
                </button>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-[1.56vw] pb-[1vw]">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-[1.2vw] py-[6vw]">
                  <div className="w-[6vw] h-[6vw] bg-accent-green/40 rounded-full flex items-center justify-center">
                    <ShoppingBag size={40} className="text-primary-brown/40" />
                  </div>
                  <p className="ff-accia-light text-[1.1vw] text-black/50">Your cart is feeling a bit empty…</p>
                  <button onClick={onClose} className="ff-accia text-[1vw] text-primary-brown underline underline-offset-4">Start shopping</button>
                </div>
              ) : (
                <div className="space-y-[1.6vw] pt-[0.5vw]">
                  {items.map((item) => (
                    <div key={item.id} className="relative flex gap-[1.1vw]">
                      {/* Thumbnail 90px ≈ 5.2vw */}
                      <div className="w-[5.2vw] h-[5.2vw] min-w-[64px] min-h-[64px] shrink-0 rounded-[0.58vw] border border-primary-brown overflow-hidden relative bg-[#ece9e2]">
                        {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="ff-accia text-[1.85vw] text-black leading-[0.95] tracking-[-0.037vw]">{item.name}</h3>
                        {item.description && (
                          <p className="ff-accia-light text-[1.04vw] text-black capitalize leading-[1.15] mt-[0.4vw] line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <p className="ff-accia text-[1.27vw] text-primary-brown tracking-[-0.025vw] mt-[0.6vw]">Rs. {Number(item.price).toFixed(2)}</p>

                        {/* Quantity stepper — pill, rounded-full */}
                        <div className="inline-flex items-center justify-between gap-[1vw] border border-black rounded-full h-[2.2vw] min-h-[34px] px-[0.9vw] mt-[0.8vw]">
                          <button
                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                            className="text-primary-brown hover:opacity-60 transition-opacity"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-[1.1vw] h-[1.1vw] min-w-[14px] min-h-[14px]" />
                          </button>
                          <span className="ff-accia text-[1.27vw] text-primary-brown leading-none min-w-[1.5vw] text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="text-primary-brown hover:opacity-60 transition-opacity"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-[1.1vw] h-[1.1vw] min-w-[14px] min-h-[14px]" />
                          </button>
                        </div>
                      </div>

                      {/* Trash */}
                      <button
                        onClick={() => removeItem(item.id)}
                        className="self-start text-black/70 hover:text-red-500 transition-colors pt-[0.6vw]"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-[1.39vw] h-[1.39vw] min-w-[18px] min-h-[18px]" />
                      </button>
                    </div>
                  ))}

                  {/* Popular Items panel */}
                  {popular.length > 0 && (
                    <div className="relative border border-primary-brown rounded-[0.7vw] bg-accent-green overflow-hidden mt-[1.4vw]">
                      <div className="flex items-center justify-between px-[1vw] pt-[1.1vw] pb-[0.6vw]">
                        <span className="ff-accia text-[1.27vw] text-primary-brown tracking-[-0.025vw]">Popular Items</span>
                        <div className="flex items-center gap-[0.8vw] text-primary-brown">
                          <button onClick={() => setPopIndex((i) => Math.max(0, i - 1))} disabled={popIndex === 0} className="disabled:opacity-30 hover:opacity-60 transition-opacity">
                            <ChevronLeft className="w-[0.9vw] h-[1.4vw] min-w-[12px]" />
                          </button>
                          <button onClick={() => setPopIndex((i) => Math.min(popular.length - 1, i + 1))} disabled={popIndex >= popular.length - 1} className="disabled:opacity-30 hover:opacity-60 transition-opacity">
                            <ChevronRight className="w-[0.9vw] h-[1.4vw] min-w-[12px]" />
                          </button>
                        </div>
                      </div>

                      {/* Carousel track */}
                      <div className="overflow-hidden px-[0.5vw] pb-[0.5vw]">
                        <div
                          className="flex gap-[1vw] transition-transform duration-300"
                          style={{ transform: `translateX(calc(-${popIndex} * (21.7vw + 1vw)))` }}
                        >
                          {popular.map((p) => (
                            <div key={p.id} className="shrink-0 w-[21.7vw] bg-white rounded-[0.58vw] p-[0.9vw] flex gap-[0.9vw]">
                              <div className="w-[6.6vw] h-[6.6vw] shrink-0 rounded-[0.7vw] border border-primary-brown overflow-hidden relative bg-[#ece9e2]">
                                {p.image_url && <Image src={p.image_url} alt={p.name} fill className="object-cover" />}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col">
                                <h4 className="ff-accia text-[1.27vw] text-black leading-[0.97] tracking-[-0.025vw] line-clamp-2">{p.name}</h4>
                                {p.description && (
                                  <p className="ff-accia-light text-[0.81vw] text-black capitalize leading-[1.15] mt-[0.3vw] line-clamp-2">{p.description}</p>
                                )}
                                <button
                                  onClick={() => addItem({ id: p.id, name: p.name, price: p.price, quantity: 1, image: p.image_url || "/assets/product.svg", description: p.description })}
                                  className="self-start mt-auto bg-accent-green rounded-[0.35vw] px-[0.7vw] py-[0.25vw] ff-accia-light text-[0.81vw] text-primary-brown capitalize hover:bg-accent-green/70 transition-colors"
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

            {/* Footer / totals */}
            {items.length > 0 && (
              <div className="px-[1.16vw] pb-[1.16vw] pt-[0.8vw] bg-white border-t border-primary-brown/10">
                <div className="flex justify-between items-center">
                  <span className="ff-accia-light text-[1.27vw] text-black capitalize">Subtotal</span>
                  <span className="ff-accia-light text-[1.27vw] text-black">Rs. {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-[0.6vw]">
                  <span className="ff-accia-light text-[1.27vw] text-black capitalize">Delivery charges</span>
                  <span className="ff-accia-light text-[1.27vw] text-black">Rs. {delivery.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-[0.7vw]">
                  <span className="ff-accia-medium text-[1.27vw] text-black">Grand total</span>
                  <span className="ff-accia-medium text-[1.27vw] text-black">Rs. {grandTotal.toFixed(2)}</span>
                </div>

                <button
                  onClick={handleCheckoutClick}
                  disabled={loadingCheckout}
                  className="w-full bg-primary-brown rounded-[0.81vw] h-[3.7vw] min-h-[48px] mt-[1.2vw] flex items-center justify-center hover:bg-primary-brown/90 transition-all disabled:opacity-60"
                >
                  {loadingCheckout
                    ? <Loader2 className="animate-spin text-white" size={22} />
                    : <span className="ff-accia-medium text-[1.85vw] text-white">Checkout</span>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
