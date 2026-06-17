"use client"

import { useState, useEffect } from "react"
import { useCart } from "@/store/useCart"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import { Loader2, CheckCircle, Minus, Plus, Trash2, ChevronLeft, ChevronRight, Banknote, Gift } from "lucide-react"
import { placeOrder } from "./actions"

// Estimated delivery — server (delivery_methods) is the source of truth at
// checkout. This is purely for the right-side summary preview.
const DELIVERY_CHARGE = 99
// Client-side promo preview only. The server `create_order` RPC currently
// ignores p_promo_code; real discount application lands in Phase 5 (coupons).
const PROMOS: Record<string, number> = { KAKEEZ10: 0.1, WELCOME: 0.05 }

export default function CheckoutPage() {
  const { items, addItem, removeItem, updateQuantity, totalPrice, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const router = useRouter()

  // form state
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("+92")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [isGift, setIsGift] = useState(false)
  const [instructions, setInstructions] = useState("")
  // Payment method is locked to COD at launch (see ECOMMERCE_CMS_PLAN.md §G.X).
  // The schema is shaped so adding JazzCash/Easypaisa later is additive.

  // summary state
  const [popular, setPopular] = useState<any[]>([])
  const [popIndex, setPopIndex] = useState(0)
  const [promo, setPromo] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; rate: number } | null>(null)
  const [promoMsg, setPromoMsg] = useState("")

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/")
      } else {
        setUser(session.user)
        setName(session.user.user_metadata?.full_name || "")
        setEmail(session.user.email || "")
        if (session.user.user_metadata?.phone) setPhone(session.user.user_metadata.phone)
        if (session.user.user_metadata?.address) setAddress(session.user.user_metadata.address)
      }
      setAuthChecking(false)
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    // Same new-schema → legacy-shape projection used elsewhere (homepage,
    // cart drawer, product detail). image_url + price are derived.
    supabase
      .from("products")
      .select("id, name, base_price_minor, description, is_best_seller, product_images(storage_path, position, is_featured)")
      .eq("status", "published")
      .order("is_best_seller", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data) {
          setPopular(
            (data as any[]).map((p) => {
              const hero = p.product_images?.find((i: any) => i.is_featured) ?? p.product_images?.[0]
              return {
                ...p,
                image_url: hero?.storage_path ?? null,
                price: (p.base_price_minor ?? 0) / 100,
              }
            })
          )
        }
      })
  }, [])

  const subtotal = totalPrice()
  const discount = appliedPromo ? Math.round(subtotal * appliedPromo.rate) : 0
  const delivery = items.length > 0 ? DELIVERY_CHARGE : 0
  const grandTotal = Math.max(0, subtotal - discount) + delivery

  const applyPromo = () => {
    const code = promo.trim().toUpperCase()
    if (PROMOS[code]) {
      setAppliedPromo({ code, rate: PROMOS[code] })
      setPromoMsg(`Promo ${code} applied — ${PROMOS[code] * 100}% off!`)
    } else {
      setAppliedPromo(null)
      setPromoMsg("Invalid promo code.")
    }
  }

  const handleEditAddress = () => {
    const next = window.prompt("Enter your delivery address", address)
    if (next !== null) setAddress(next)
  }

  const handlePlaceOrder = async () => {
    if (!user || items.length === 0) return
    setLoading(true)
    setPromoMsg("")

    // Send ONLY identifiers + qty to the server. The `create_order` RPC
    // re-reads prices from products/variations — see ECOMMERCE_CMS_PLAN.md
    // §G.X.1. Any localStorage edit a user might have made to `price` is
    // ignored on the server.
    const cart = items.map((item) => ({
      productId: item.id,
      variationId: item.variationId ?? null,
      quantity: item.quantity,
      customMessage: item.customMessage,
    }))

    const result = await placeOrder({
      cart,
      address: {
        recipient_name: name || user.email?.split("@")[0] || "Customer",
        phone_e164: phone,
        line1: address,
        city: "Karachi",
        instructions,
      },
      promoCode: appliedPromo?.code,
      isGift,
    })

    if (!result.ok) {
      setPromoMsg(result.message)
      setLoading(false)
      return
    }

    clearCart()
    setLoading(false)
    setSuccess(true)
  }

  if (authChecking) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-primary-brown" size={40} /></div>
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-[2vw]">
        <div className="w-[8vw] h-[8vw] bg-accent-green/50 rounded-full flex items-center justify-center">
          <CheckCircle className="text-primary-brown w-[4vw] h-[4vw]" />
        </div>
        <h1 className="ff-accia text-[3.5vw] text-primary-brown">Order Confirmed!</h1>
        <p className="ff-accia-light text-[1.3vw] text-black/60">Thank you for your order. We are getting the oven ready!</p>
        <button onClick={() => router.push("/")} className="mt-[1vw] bg-primary-brown text-white px-[3vw] py-[1vw] rounded-[0.8vw] ff-accia text-[1.4vw] hover:bg-primary-brown/90 transition-all">
          Continue Shopping
        </button>
      </div>
    )
  }

  const inputCls = "w-full h-[2.66vw] min-h-[40px] bg-white border border-primary-brown/30 rounded-[0.6vw] px-[1vw] outline-none focus:border-primary-brown transition-all ff-accia-light text-[1.04vw] text-black placeholder:text-black/35"
  const labelCls = "ff-accia text-[1.45vw] text-black"

  return (
    <div className="relative bg-white w-full overflow-hidden">
      <Navbar />

      {/* Green panel with form + summary */}
      <div className="relative mx-auto mt-[clamp(122px,8.8vw,150px)] w-[83.9vw] bg-accent-green rounded-[1.4vw] px-[1.45vw] pt-[3.76vw] pb-[5vw]">
        {/* drip bottom edge */}
        <div className="absolute left-0 bottom-[-9vw] w-full h-[14.4vw] pointer-events-none" style={{ transform: "scaleY(-1)" }}>
          <Image src="/assets/union-drip.svg" alt="" fill className="block w-full h-full object-fill" />
        </div>

        <div className="flex gap-[1.56vw]">
          {/* ===================== LEFT: FORM ===================== */}
          <div className="w-[53.3vw]">
            {/* Row 1: Full name | Mobile */}
            <div className="grid grid-cols-2 gap-[0.8vw]">
              <div className="space-y-[0.5vw]">
                <label className={labelCls}>Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className={inputCls} />
              </div>
              <div className="space-y-[0.5vw]">
                <label className={labelCls}>Mobile Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92" className={inputCls} />
              </div>
            </div>

            {/* Row 2: Email | Address */}
            <div className="grid grid-cols-2 gap-[0.8vw] mt-[1.1vw]">
              <div className="space-y-[0.5vw]">
                <label className={labelCls}>Email Address</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" className={inputCls} />
              </div>
              <div className="space-y-[0.5vw]">
                <label className={labelCls}>YOUR Address</label>
                <button onClick={handleEditAddress} className="w-[11.75vw] h-[2.66vw] min-h-[40px] bg-primary-brown rounded-[0.6vw] ff-apfel text-[1.04vw] text-white hover:bg-primary-brown/90 transition-all flex items-center justify-center px-[0.5vw]">
                  Add / Change Address
                </button>
              </div>
            </div>
            {address && (
              <p className="ff-accia-light text-[0.95vw] text-black/70 mt-[0.5vw] pl-[0.2vw] line-clamp-2">📍 {address}</p>
            )}

            {/* Send as a gift */}
            <div className="mt-[1.4vw] bg-white rounded-[0.7vw] h-[3.88vw] min-h-[52px] flex items-center justify-between px-[1.6vw]">
              <span className="ff-accia text-[1.45vw] text-black flex items-center gap-[0.6vw]"><Gift className="w-[1.4vw] h-[1.4vw] text-primary-brown" /> Send as a gift</span>
              <button
                onClick={() => setIsGift((g) => !g)}
                className={`relative w-[2.6vw] h-[1.3vw] min-w-[40px] min-h-[20px] rounded-full transition-all ${isGift ? "bg-primary-brown" : "bg-primary-brown/25"}`}
                aria-label="Send as a gift"
              >
                <span className={`absolute top-1/2 -translate-y-1/2 w-[1vw] h-[1vw] min-w-[16px] min-h-[16px] rounded-full bg-white transition-all ${isGift ? "right-[0.15vw]" : "left-[0.15vw]"}`} />
              </button>
            </div>

            {/* Special instructions */}
            <label className={`${labelCls} block mt-[1.4vw]`}>Special instructions (optional)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Please enter instructions about this item"
              className="w-full h-[8.62vw] mt-[0.6vw] bg-white border border-primary-brown/30 rounded-[0.7vw] px-[1vw] py-[0.8vw] outline-none focus:border-primary-brown transition-all ff-accia-light text-[1.04vw] text-black placeholder:text-black/35 resize-none"
            />

            {/* Payment method — COD only at launch (see ECOMMERCE_CMS_PLAN.md §G.X.8). */}
            <label className={`${labelCls} block mt-[1.4vw]`}>Payment Method</label>
            <div className="mt-[0.6vw] bg-white rounded-[0.7vw] p-[1.1vw] flex items-center gap-[0.8vw] border border-primary-brown/30">
              <Banknote className="w-[1.4vw] h-[1.4vw] text-primary-brown shrink-0" />
              <div>
                <div className="ff-accia text-[1.04vw] text-black">Cash on Delivery</div>
                <div className="ff-accia-light text-[0.9vw] text-black/60">Pay the rider in cash when your order arrives. Please keep exact change ready.</div>
              </div>
            </div>
          </div>

          {/* ===================== RIGHT: SUMMARY CARD ===================== */}
          <div className="w-[25.98vw] bg-white rounded-[1vw] p-[1.2vw] flex flex-col self-start">
            <h2 className="ff-accia text-[1.45vw] text-black">Your cart</h2>

            {/* Items */}
            <div className="mt-[1vw] space-y-[1vw] max-h-[18vw] overflow-y-auto pr-[0.3vw]">
              {items.length === 0 ? (
                <p className="ff-accia-light text-[1vw] text-black/50 py-[2vw] text-center">Your cart is empty.</p>
              ) : items.map((item) => (
                <div key={item.id} className="flex gap-[0.8vw]">
                  <div className="w-[5.15vw] h-[5.15vw] min-w-[64px] min-h-[64px] shrink-0 rounded-[0.6vw] border border-primary-brown overflow-hidden relative bg-[#ece9e2]">
                    {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-[0.5vw]">
                      <h3 className="ff-accia text-[1.1vw] text-black leading-[1.05] line-clamp-1">{item.name}</h3>
                      <button onClick={() => removeItem(item.id)} className="text-black/50 hover:text-red-500 transition-colors shrink-0"><Trash2 className="w-[1vw] h-[1vw] min-w-[14px] min-h-[14px]" /></button>
                    </div>
                    {item.description && <p className="ff-accia-light text-[0.8vw] text-black/55 capitalize leading-[1.15] line-clamp-2 mt-[0.2vw]">{item.description}</p>}
                    <div className="flex items-center justify-between mt-[0.4vw]">
                      <div className="inline-flex items-center gap-[0.6vw] border border-primary-brown/40 rounded-full px-[0.5vw] h-[1.6vw] min-h-[24px]">
                        <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="text-primary-brown"><Minus className="w-[0.8vw] h-[0.8vw] min-w-[12px] min-h-[12px]" /></button>
                        <span className="ff-accia text-[0.95vw] text-primary-brown leading-none">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="text-primary-brown"><Plus className="w-[0.8vw] h-[0.8vw] min-w-[12px] min-h-[12px]" /></button>
                      </div>
                      <span className="ff-accia text-[1vw] text-primary-brown">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add more items */}
            <div className="border-t border-primary-brown/15 mt-[1vw] pt-[0.8vw] text-center">
              <button onClick={() => router.push("/")} className="ff-accia text-[1.05vw] text-primary-brown underline underline-offset-2 hover:opacity-70 transition-opacity">Add more items</button>
            </div>

            {/* Popular items */}
            {popular.length > 0 && (
              <div className="mt-[1vw] bg-accent-green rounded-[0.7vw] p-[0.8vw]">
                <div className="flex items-center justify-between">
                  <span className="ff-accia text-[1.1vw] text-primary-brown">Popular Items</span>
                  <div className="flex items-center gap-[0.6vw] text-primary-brown">
                    <button onClick={() => setPopIndex((i) => Math.max(0, i - 1))} disabled={popIndex === 0} className="disabled:opacity-30"><ChevronLeft className="w-[0.8vw] h-[1.2vw] min-w-[12px]" /></button>
                    <button onClick={() => setPopIndex((i) => Math.min(popular.length - 1, i + 1))} disabled={popIndex >= popular.length - 1} className="disabled:opacity-30"><ChevronRight className="w-[0.8vw] h-[1.2vw] min-w-[12px]" /></button>
                  </div>
                </div>
                <div className="overflow-hidden mt-[0.6vw]">
                  <div className="flex gap-[0.6vw] transition-transform duration-300" style={{ transform: `translateX(calc(-${popIndex} * (12.6vw + 0.6vw)))` }}>
                    {popular.map((p) => (
                      <div key={p.id} className="shrink-0 w-[12.6vw] bg-white rounded-[0.5vw] p-[0.5vw] flex gap-[0.5vw]">
                        <div className="w-[4.3vw] h-[4.3vw] shrink-0 rounded-[0.4vw] border border-primary-brown overflow-hidden relative bg-[#ece9e2]">
                          {p.image_url && <Image src={p.image_url} alt={p.name} fill className="object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <h4 className="ff-accia text-[0.85vw] text-black leading-[1.0] line-clamp-2">{p.name}</h4>
                          <button onClick={() => addItem({ id: p.id, name: p.name, price: p.price, quantity: 1, image: p.image_url || "/assets/product.svg", description: p.description })} className="self-start bg-accent-green rounded-[0.3vw] px-[0.5vw] py-[0.15vw] ff-accia-light text-[0.75vw] text-primary-brown">Rs. {Number(p.price).toFixed(2)}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Promo */}
            <label className="ff-accia text-[1.1vw] text-black mt-[1vw] block">To apply promo code</label>
            <div className="flex gap-[0.5vw] mt-[0.5vw]">
              <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Promo code" className="flex-1 h-[2.4vw] min-h-[36px] bg-white border border-primary-brown/30 rounded-[0.6vw] px-[0.8vw] outline-none focus:border-primary-brown ff-accia-light text-[0.95vw]" />
              <button onClick={applyPromo} className="bg-primary-brown text-white px-[1vw] rounded-[0.6vw] ff-accia text-[0.95vw] hover:bg-primary-brown/90 transition-all">Apply</button>
            </div>
            {promoMsg && <p className={`ff-accia-light text-[0.85vw] mt-[0.4vw] ${appliedPromo ? "text-green-700" : "text-red-500"}`}>{promoMsg}</p>}

            {/* Totals */}
            <div className="mt-[1vw] space-y-[0.4vw]">
              <div className="flex justify-between"><span className="ff-accia-light text-[1.1vw] text-black capitalize">Subtotal</span><span className="ff-accia-light text-[1.1vw] text-black">Rs.{subtotal.toFixed(2)}</span></div>
              {discount > 0 && <div className="flex justify-between"><span className="ff-accia-light text-[1.1vw] text-green-700 capitalize">Discount</span><span className="ff-accia-light text-[1.1vw] text-green-700">- Rs.{discount.toFixed(2)}</span></div>}
              <div className="flex justify-between"><span className="ff-accia-light text-[1.1vw] text-black capitalize">Delivery charges</span><span className="ff-accia-light text-[1.1vw] text-black">Rs{delivery.toFixed(2)}</span></div>
              <div className="flex justify-between pt-[0.3vw]"><span className="ff-accia-medium text-[1.2vw] text-black">Grand total</span><span className="ff-accia-medium text-[1.2vw] text-black">Rs. {grandTotal.toFixed(2)}</span></div>
            </div>

            {/* Place order */}
            <button
              onClick={handlePlaceOrder}
              disabled={loading || items.length === 0}
              className="w-full h-[2.83vw] min-h-[44px] mt-[1.2vw] bg-primary-brown rounded-[0.6vw] flex items-center justify-center hover:bg-primary-brown/90 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin text-white" size={20} /> : <span className="ff-accia text-[1.4vw] text-white">Place Order</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Footer (rendered in flow via a relative wrapper since Footer is absolute) */}
      <div className="relative w-full h-[20.5vw] mt-[10vw]">
        <Footer topOffset={0} />
      </div>
    </div>
  )
}
