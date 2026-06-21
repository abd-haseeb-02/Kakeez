"use client"

import { useState, useEffect } from "react"
import { useCart } from "@/store/useCart"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import PhoneVerificationPanel from "@/components/account/PhoneVerificationPanel"
import { Loader2, CheckCircle, Minus, Plus, Trash2, ChevronLeft, ChevronRight, Banknote, Gift } from "lucide-react"
import { placeOrder, previewCheckout, type CheckoutCartLine, type CheckoutPreviewResult } from "./actions"

// Estimated delivery — server (delivery_methods) is the source of truth at
// checkout. This is purely for the right-side summary preview.
const FALLBACK_DELIVERY_MINOR = 9900

type CheckoutUser = {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
    phone?: string
    address?: string
  }
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
  is_best_seller?: boolean | null
  product_images?: ProductImageRow[]
}

type PopularProduct = PopularProductRow & {
  image_url: string | null
  price: number
}

export default function CheckoutPage() {
  const { items, addItem, removeItem, updateQuantity, totalPrice, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<CheckoutUser | null>(null)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const router = useRouter()

  // form state
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("+92")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [deliveryDate, setDeliveryDate] = useState("")
  const [deliveryWindow, setDeliveryWindow] = useState("")
  const [isGift, setIsGift] = useState(false)
  const [instructions, setInstructions] = useState("")
  // Payment method is locked to COD at launch (see ECOMMERCE_CMS_PLAN.md §G.X).
  // The schema is shaped so adding JazzCash/Easypaisa later is additive.

  // summary state
  const [popular, setPopular] = useState<PopularProduct[]>([])
  const [popIndex, setPopIndex] = useState(0)
  const [promo, setPromo] = useState("")
  // Server-validated coupon — Phase 5. Carries the discount_minor returned
  // by validate_coupon_for_cart so the summary preview matches what the
  // create_order RPC will compute (single source of truth).
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountMinor: number } | null>(null)
  const [promoMsg, setPromoMsg] = useState("")
  const [applyingPromo, setApplyingPromo] = useState(false)
  const [preview, setPreview] = useState<CheckoutPreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const cartForServer = (): CheckoutCartLine[] => items.map((item) => ({
    productId: item.id,
    variationId: item.variationId ?? null,
    quantity: item.quantity,
    customMessage: item.customMessage,
  }))

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
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone_e164, phone_verified_at')
          .eq('id', session.user.id)
          .maybeSingle()
        if (profile?.phone_e164) setPhone(profile.phone_e164)
        setPhoneVerified(Boolean(profile?.phone_verified_at))
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
            (data as PopularProductRow[]).map((p) => {
              const hero = p.product_images?.find((i) => i.is_featured) ?? p.product_images?.[0]
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

  const refreshPreview = async (code = appliedPromo?.code ?? "", showPromoMessage = false) => {
    if (items.length === 0) {
      setPreview({ ok: true, subtotalMinor: 0, discountMinor: 0, deliveryFeeMinor: 0, taxMinor: 0, totalMinor: 0, promoCode: null, promoType: null })
      return
    }

    setPreviewLoading(true)
    const result = await previewCheckout({
      cart: cartForServer(),
      address: {
        recipient_name: name,
        phone_e164: phone,
        line1: address,
        city: "Karachi",
        instructions,
        delivery_slot_date: deliveryDate,
        delivery_slot_window: deliveryWindow,
      },
      promoCode: code || undefined,
    })
    setPreview(result)
    setPreviewLoading(false)

    if (!result.ok) {
      setPromoMsg(result.message)
      if (result.code === 'invalid_coupon' || result.code === 'coupon_error') {
        setAppliedPromo(null)
      }
      return
    }

    if (result.promoCode) {
      setAppliedPromo({ code: result.promoCode, discountMinor: result.discountMinor })
      if (showPromoMessage) {
        setPromoMsg(
          result.promoType === 'free_shipping'
            ? `Promo ${result.promoCode} applied - free delivery!`
            : `Promo ${result.promoCode} applied - Rs. ${(result.discountMinor / 100).toFixed(2)} off!`
        )
      }
    } else if (!code) {
      setAppliedPromo(null)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshPreview(appliedPromo?.code ?? "")
    }, 250)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, name, phone, address, instructions, deliveryDate, deliveryWindow])

  const previewOk = preview?.ok ? preview : null
  const subtotal = previewOk ? previewOk.subtotalMinor / 100 : totalPrice()
  const discount = previewOk ? previewOk.discountMinor / 100 : appliedPromo ? appliedPromo.discountMinor / 100 : 0
  const delivery = previewOk ? previewOk.deliveryFeeMinor / 100 : items.length > 0 ? FALLBACK_DELIVERY_MINOR / 100 : 0
  const tax = previewOk ? previewOk.taxMinor / 100 : 0
  const grandTotal = previewOk ? previewOk.totalMinor / 100 : Math.max(0, subtotal - discount) + delivery + tax

  // Phase 5: real coupon validation. Calls validate_coupon_for_cart RPC
  // which gates on status / window / min_order / per-user limits, etc.
  // The customer sees the live server-computed discount before they
  // submit; create_order will re-validate at order time as a backstop.
  const applyPromo = async () => {
    const code = promo.trim()
    if (!code) { setAppliedPromo(null); setPromoMsg(""); return }
    if (items.length === 0) { setAppliedPromo(null); setPromoMsg("Add an item before applying a code."); return }

    setApplyingPromo(true)
    setPromoMsg("")
    await refreshPreview(code, true)
    setApplyingPromo(false)

  }

  const handleEditAddress = () => {
    const next = window.prompt("Enter your delivery address", address)
    if (next !== null) setAddress(next)
  }

  const handlePlaceOrder = async () => {
    if (!user || items.length === 0) return
    if (!phoneVerified) {
      setPromoMsg("Please verify your phone number before placing the order.")
      return
    }
    setLoading(true)
    setPromoMsg("")

    // Send ONLY identifiers + qty to the server. The `create_order` RPC
    // re-reads prices from products/variations — see ECOMMERCE_CMS_PLAN.md
    // §G.X.1. Any localStorage edit a user might have made to `price` is
    // ignored on the server.
    const cart = cartForServer()

    const result = await placeOrder({
      cart,
      address: {
        recipient_name: name || user.email?.split("@")[0] || "Customer",
        phone_e164: phone,
        line1: address,
        city: "Karachi",
        instructions,
        delivery_slot_date: deliveryDate,
        delivery_slot_window: deliveryWindow,
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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-green/50 md:h-[clamp(96px,8vw,140px)] md:w-[clamp(96px,8vw,140px)]">
          <CheckCircle className="h-12 w-12 text-primary-brown md:h-[clamp(48px,4vw,70px)] md:w-[clamp(48px,4vw,70px)]" />
        </div>
        <h1 className="ff-accia text-[clamp(42px,3.5vw,64px)] leading-none text-primary-brown">Order Confirmed!</h1>
        <p className="ff-accia-light text-[clamp(17px,1.3vw,22px)] text-black/60">Thank you for your order. We are getting the oven ready!</p>
        <button onClick={() => router.push("/")} className="mt-2 rounded-[10px] bg-primary-brown px-8 py-3 ff-accia text-[18px] text-white transition-all hover:bg-primary-brown/90 md:px-[clamp(32px,3vw,54px)] md:py-[clamp(12px,1vw,18px)] md:text-[clamp(18px,1.4vw,24px)]">
          Continue Shopping
        </button>
      </div>
    )
  }

  const inputCls = "h-11 w-full rounded-[10px] border border-primary-brown/30 bg-white px-4 ff-accia-light text-[16px] text-black outline-none transition-all placeholder:text-black/35 focus:border-primary-brown lg:h-[clamp(40px,2.66vw,52px)] lg:rounded-[clamp(8px,0.6vw,12px)] lg:px-[clamp(12px,1vw,18px)] lg:text-[clamp(15px,1.04vw,18px)]"
  const labelCls = "ff-accia text-[clamp(18px,1.45vw,25px)] text-black"

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      <Navbar />

      {/* Green panel with form + summary */}
      <div className="relative mx-auto mt-[clamp(108px,8.8vw,150px)] w-[calc(100vw-32px)] rounded-[18px] bg-accent-green px-4 pb-14 pt-7 sm:px-6 lg:w-[min(1180px,calc(100%_-_40px))] lg:rounded-[clamp(16px,1.4vw,24px)] lg:px-[clamp(20px,1.45vw,28px)] lg:pb-[clamp(56px,5vw,86px)] lg:pt-[clamp(42px,3.76vw,64px)]">
        {/* drip bottom edge */}
        <div className="pointer-events-none absolute bottom-[-72px] left-0 h-[112px] w-full lg:bottom-[clamp(-128px,-9vw,-72px)] lg:h-[clamp(120px,14.4vw,210px)]" style={{ transform: "scaleY(-1)" }}>
          <Image src="/assets/union-drip.svg" alt="" fill className="block w-full h-full object-fill" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:gap-[clamp(20px,1.56vw,30px)]">
          {/* ===================== LEFT: FORM ===================== */}
          <div className="w-full lg:min-w-0 lg:flex-1">
            {/* Row 1: Full name | Mobile */}
            <div className="grid gap-4 md:grid-cols-2 lg:gap-[clamp(12px,0.8vw,18px)]">
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label className={labelCls}>Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className={inputCls} />
              </div>
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label className={labelCls}>Mobile Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92" className={inputCls} />
              </div>
            </div>

            {/* Row 2: Email | Address */}
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:mt-[clamp(14px,1.1vw,22px)] lg:gap-[clamp(12px,0.8vw,18px)]">
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label className={labelCls}>Email Address</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email address" className={inputCls} />
              </div>
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label className={labelCls}>YOUR Address</label>
                <button onClick={handleEditAddress} className="flex h-11 w-full items-center justify-center rounded-[10px] bg-primary-brown px-4 ff-apfel text-[15px] text-white transition-all hover:bg-primary-brown/90 sm:w-auto lg:h-[clamp(40px,2.66vw,52px)] lg:w-[clamp(160px,11.75vw,210px)] lg:rounded-[clamp(8px,0.6vw,12px)] lg:px-[clamp(8px,0.5vw,12px)] lg:text-[clamp(15px,1.04vw,18px)]">
                  Add / Change Address
                </button>
              </div>
            </div>
            {address && (
              <p className="mt-2 line-clamp-2 pl-1 ff-accia-light text-[clamp(14px,0.95vw,16px)] text-black/70">Address: {address}</p>
            )}

            {/* Delivery slot */}
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:mt-[clamp(14px,1.1vw,22px)] lg:gap-[clamp(12px,0.8vw,18px)]">
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label className={labelCls}>Delivery Date</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label className={labelCls}>Delivery Window</label>
                <select value={deliveryWindow} onChange={(e) => setDeliveryWindow(e.target.value)} className={inputCls}>
                  <option value="">Any time</option>
                  <option value="10:00 AM - 1:00 PM">10:00 AM - 1:00 PM</option>
                  <option value="1:00 PM - 4:00 PM">1:00 PM - 4:00 PM</option>
                  <option value="4:00 PM - 7:00 PM">4:00 PM - 7:00 PM</option>
                </select>
              </div>
            </div>

            {/* Send as a gift */}
            {!phoneVerified && (
              <div className="mt-5">
                <PhoneVerificationPanel phone={phone} onVerified={() => setPhoneVerified(true)} />
              </div>
            )}

            {/* Send as a gift */}
            <div className="mt-5 flex min-h-[58px] items-center justify-between rounded-[12px] bg-white px-4 lg:mt-[clamp(18px,1.4vw,26px)] lg:h-[clamp(52px,3.88vw,68px)] lg:rounded-[clamp(10px,0.7vw,14px)] lg:px-[clamp(18px,1.6vw,28px)]">
              <span className="flex items-center gap-3 ff-accia text-[clamp(18px,1.45vw,25px)] text-black"><Gift className="h-5 w-5 text-primary-brown lg:h-[clamp(18px,1.4vw,24px)] lg:w-[clamp(18px,1.4vw,24px)]" /> Send as a gift</span>
              <button
                onClick={() => setIsGift((g) => !g)}
                className={`relative h-6 w-12 rounded-full transition-all lg:h-[clamp(20px,1.3vw,26px)] lg:w-[clamp(40px,2.6vw,52px)] ${isGift ? "bg-primary-brown" : "bg-primary-brown/25"}`}
                aria-label="Send as a gift"
              >
                <span className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition-all lg:h-[clamp(16px,1vw,20px)] lg:w-[clamp(16px,1vw,20px)] ${isGift ? "right-0.5 lg:right-[clamp(2px,0.15vw,4px)]" : "left-0.5 lg:left-[clamp(2px,0.15vw,4px)]"}`} />
              </button>
            </div>

            {/* Special instructions */}
            <label className={`${labelCls} mt-5 block lg:mt-[clamp(18px,1.4vw,26px)]`}>Special instructions (optional)</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Please enter instructions about this item"
              className="mt-3 h-36 w-full resize-none rounded-[12px] border border-primary-brown/30 bg-white px-4 py-3 ff-accia-light text-[16px] text-black outline-none transition-all placeholder:text-black/35 focus:border-primary-brown lg:mt-[clamp(8px,0.6vw,12px)] lg:h-[clamp(130px,8.62vw,168px)] lg:rounded-[clamp(10px,0.7vw,14px)] lg:px-[clamp(12px,1vw,18px)] lg:py-[clamp(10px,0.8vw,16px)] lg:text-[clamp(15px,1.04vw,18px)]"
            />

            {/* Payment method — COD only at launch (see ECOMMERCE_CMS_PLAN.md §G.X.8). */}
            <label className={`${labelCls} mt-5 block lg:mt-[clamp(18px,1.4vw,26px)]`}>Payment Method</label>
            <div className="mt-3 flex items-center gap-3 rounded-[12px] border border-primary-brown/30 bg-white p-4 lg:mt-[clamp(8px,0.6vw,12px)] lg:gap-[clamp(10px,0.8vw,16px)] lg:rounded-[clamp(10px,0.7vw,14px)] lg:p-[clamp(14px,1.1vw,22px)]">
              <Banknote className="h-5 w-5 shrink-0 text-primary-brown lg:h-[clamp(18px,1.4vw,24px)] lg:w-[clamp(18px,1.4vw,24px)]" />
              <div>
                <div className="ff-accia text-[17px] text-black lg:text-[clamp(15px,1.04vw,18px)]">Cash on Delivery</div>
                <div className="ff-accia-light text-[14px] leading-snug text-black/60 lg:text-[clamp(13px,0.9vw,16px)]">Pay the rider in cash when your order arrives. Please keep exact change ready.</div>
              </div>
            </div>
          </div>

          {/* ===================== RIGHT: SUMMARY CARD ===================== */}
          <div className="flex w-full flex-col self-start rounded-[16px] bg-white p-4 sm:p-5 lg:w-[clamp(320px,26vw,390px)] lg:rounded-[clamp(12px,1vw,18px)] lg:p-[clamp(16px,1.2vw,24px)]">
            <h2 className="ff-accia text-[clamp(24px,1.45vw,28px)] text-black">Your cart</h2>

            {/* Items */}
            <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-1 lg:mt-[clamp(12px,1vw,20px)] lg:max-h-[clamp(270px,18vw,360px)] lg:space-y-[clamp(12px,1vw,20px)] lg:pr-[clamp(4px,0.3vw,6px)]">
              {items.length === 0 ? (
                <p className="py-8 text-center ff-accia-light text-[16px] text-black/50 lg:py-[clamp(24px,2vw,38px)] lg:text-[clamp(15px,1vw,17px)]">Your cart is empty.</p>
              ) : items.map((item) => (
                <div key={item.id} className="flex gap-3 lg:gap-[clamp(10px,0.8vw,16px)]">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] border border-primary-brown bg-[#ece9e2] lg:h-[clamp(64px,5.15vw,92px)] lg:w-[clamp(64px,5.15vw,92px)] lg:rounded-[clamp(8px,0.6vw,12px)]">
                    {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 lg:gap-[clamp(8px,0.5vw,12px)]">
                      <h3 className="line-clamp-1 ff-accia text-[20px] leading-[1.05] text-black lg:text-[clamp(18px,1.1vw,22px)]">{item.name}</h3>
                      <button onClick={() => removeItem(item.id)} className="shrink-0 text-black/50 transition-colors hover:text-red-500"><Trash2 className="h-4 w-4 lg:h-[clamp(14px,1vw,18px)] lg:w-[clamp(14px,1vw,18px)]" /></button>
                    </div>
                    {item.description && <p className="mt-1 line-clamp-2 ff-accia-light text-[13px] capitalize leading-[1.2] text-black/55 lg:mt-[clamp(2px,0.2vw,4px)] lg:text-[clamp(12px,0.8vw,14px)]">{item.description}</p>}
                    <div className="mt-2 flex items-center justify-between lg:mt-[clamp(6px,0.4vw,10px)]">
                      <div className="inline-flex h-8 items-center gap-3 rounded-full border border-primary-brown/40 px-3 lg:h-[clamp(24px,1.6vw,32px)] lg:gap-[clamp(8px,0.6vw,12px)] lg:px-[clamp(8px,0.5vw,12px)]">
                        <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="text-primary-brown"><Minus className="h-3.5 w-3.5 lg:h-[clamp(12px,0.8vw,15px)] lg:w-[clamp(12px,0.8vw,15px)]" /></button>
                        <span className="ff-accia text-[16px] leading-none text-primary-brown lg:text-[clamp(14px,0.95vw,17px)]">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="text-primary-brown"><Plus className="h-3.5 w-3.5 lg:h-[clamp(12px,0.8vw,15px)] lg:w-[clamp(12px,0.8vw,15px)]" /></button>
                      </div>
                      <span className="ff-accia text-[16px] text-primary-brown lg:text-[clamp(15px,1vw,18px)]">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add more items */}
            <div className="mt-4 border-t border-primary-brown/15 pt-3 text-center lg:mt-[clamp(12px,1vw,20px)] lg:pt-[clamp(10px,0.8vw,16px)]">
              <button onClick={() => router.push("/")} className="ff-accia text-[16px] text-primary-brown underline underline-offset-2 transition-opacity hover:opacity-70 lg:text-[clamp(15px,1.05vw,18px)]">Add more items</button>
            </div>

            {/* Popular items */}
            {popular.length > 0 && (
              <div className="mt-4 rounded-[12px] bg-accent-green p-3 lg:mt-[clamp(12px,1vw,20px)] lg:rounded-[clamp(10px,0.7vw,14px)] lg:p-[clamp(12px,0.8vw,16px)]">
                <div className="flex items-center justify-between">
                  <span className="ff-accia text-[18px] text-primary-brown lg:text-[clamp(16px,1.1vw,20px)]">Popular Items</span>
                  <div className="flex items-center gap-3 text-primary-brown lg:gap-[clamp(8px,0.6vw,12px)]">
                    <button onClick={() => setPopIndex((i) => Math.max(0, i - 1))} disabled={popIndex === 0} className="disabled:opacity-30"><ChevronLeft className="h-5 w-4 lg:h-[clamp(16px,1.2vw,22px)] lg:w-[clamp(12px,0.8vw,16px)]" /></button>
                    <button onClick={() => setPopIndex((i) => Math.min(popular.length - 1, i + 1))} disabled={popIndex >= popular.length - 1} className="disabled:opacity-30"><ChevronRight className="h-5 w-4 lg:h-[clamp(16px,1.2vw,22px)] lg:w-[clamp(12px,0.8vw,16px)]" /></button>
                  </div>
                </div>
                <div className="mt-3 overflow-x-auto lg:mt-[clamp(8px,0.6vw,12px)] lg:overflow-hidden">
                  <div className="flex gap-3 transition-transform duration-300 lg:gap-[clamp(8px,0.6vw,12px)]" style={{ transform: `translateX(calc(-${popIndex} * clamp(228px,13.2vw,258px)))` }}>
                    {popular.map((p) => (
                      <div key={p.id} className="flex w-[220px] shrink-0 gap-3 rounded-[10px] bg-white p-2 lg:w-[clamp(220px,12.6vw,246px)] lg:gap-[clamp(8px,0.5vw,10px)] lg:rounded-[clamp(8px,0.5vw,10px)] lg:p-[clamp(8px,0.5vw,10px)]">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] border border-primary-brown bg-[#ece9e2] lg:h-[clamp(64px,4.3vw,82px)] lg:w-[clamp(64px,4.3vw,82px)] lg:rounded-[clamp(6px,0.4vw,8px)]">
                          {p.image_url && <Image src={p.image_url} alt={p.name} fill className="object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <h4 className="line-clamp-2 ff-accia text-[15px] leading-[1.0] text-black lg:text-[clamp(13px,0.85vw,15px)]">{p.name}</h4>
                          <button onClick={() => addItem({ id: p.id, name: p.name, price: p.price, quantity: 1, image: p.image_url || "/assets/product.svg", description: p.description ?? undefined })} className="self-start rounded-[6px] bg-accent-green px-2 py-1 ff-accia-light text-[13px] text-primary-brown lg:rounded-[clamp(5px,0.3vw,7px)] lg:px-[clamp(8px,0.5vw,10px)] lg:py-[clamp(2px,0.15vw,4px)] lg:text-[clamp(12px,0.75vw,14px)]">Rs. {Number(p.price).toFixed(2)}</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Promo */}
            <label className="mt-4 block ff-accia text-[18px] text-black lg:mt-[clamp(12px,1vw,20px)] lg:text-[clamp(16px,1.1vw,20px)]">To apply promo code</label>
            <div className="mt-2 flex gap-2 lg:mt-[clamp(6px,0.5vw,10px)] lg:gap-[clamp(6px,0.5vw,10px)]">
              <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Promo code" className="h-10 flex-1 rounded-[10px] border border-primary-brown/30 bg-white px-3 ff-accia-light text-[15px] outline-none focus:border-primary-brown lg:h-[clamp(36px,2.4vw,46px)] lg:rounded-[clamp(8px,0.6vw,12px)] lg:px-[clamp(10px,0.8vw,16px)] lg:text-[clamp(14px,0.95vw,16px)]" />
              <button onClick={applyPromo} disabled={applyingPromo} className="rounded-[10px] bg-primary-brown px-4 ff-accia text-[15px] text-white transition-all hover:bg-primary-brown/90 disabled:opacity-60 lg:rounded-[clamp(8px,0.6vw,12px)] lg:px-[clamp(12px,1vw,18px)] lg:text-[clamp(14px,0.95vw,16px)]">{applyingPromo ? <Loader2 size={14} className="animate-spin inline" /> : 'Apply'}</button>
            </div>
            {promoMsg && <p className={`mt-2 ff-accia-light text-[14px] lg:mt-[clamp(5px,0.4vw,8px)] lg:text-[clamp(13px,0.85vw,15px)] ${appliedPromo ? "text-green-700" : "text-red-500"}`}>{promoMsg}</p>}

            {/* Totals */}
            <div className="mt-4 space-y-2 lg:mt-[clamp(12px,1vw,20px)] lg:space-y-[clamp(5px,0.4vw,8px)]">
              {previewLoading && <p className="ff-accia-light text-[13px] text-black/50">Refreshing server totals...</p>}
              {preview && !preview.ok && <p className="ff-accia-light text-[13px] text-red-500">{preview.message}</p>}
              <div className="flex justify-between"><span className="ff-accia-light text-[17px] capitalize text-black lg:text-[clamp(16px,1.1vw,20px)]">Subtotal</span><span className="ff-accia-light text-[17px] text-black lg:text-[clamp(16px,1.1vw,20px)]">Rs.{subtotal.toFixed(2)}</span></div>
              {discount > 0 && <div className="flex justify-between"><span className="ff-accia-light text-[17px] capitalize text-green-700 lg:text-[clamp(16px,1.1vw,20px)]">Discount</span><span className="ff-accia-light text-[17px] text-green-700 lg:text-[clamp(16px,1.1vw,20px)]">- Rs.{discount.toFixed(2)}</span></div>}
              <div className="flex justify-between"><span className="ff-accia-light text-[17px] capitalize text-black lg:text-[clamp(16px,1.1vw,20px)]">Delivery charges</span><span className="ff-accia-light text-[17px] text-black lg:text-[clamp(16px,1.1vw,20px)]">Rs{delivery.toFixed(2)}</span></div>
              {tax > 0 && <div className="flex justify-between"><span className="ff-accia-light text-[17px] capitalize text-black lg:text-[clamp(16px,1.1vw,20px)]">Tax</span><span className="ff-accia-light text-[17px] text-black lg:text-[clamp(16px,1.1vw,20px)]">Rs{tax.toFixed(2)}</span></div>}
              <div className="flex justify-between pt-1 lg:pt-[clamp(4px,0.3vw,6px)]"><span className="ff-accia-medium text-[19px] text-black lg:text-[clamp(18px,1.2vw,22px)]">Grand total</span><span className="ff-accia-medium text-[19px] text-black lg:text-[clamp(18px,1.2vw,22px)]">Rs. {grandTotal.toFixed(2)}</span></div>
            </div>

            {/* Place order */}
            <button
              onClick={handlePlaceOrder}
              disabled={loading || items.length === 0 || !phoneVerified}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-[10px] bg-primary-brown transition-all hover:bg-primary-brown/90 disabled:opacity-50 lg:mt-[clamp(16px,1.2vw,24px)] lg:h-[clamp(44px,2.83vw,56px)] lg:rounded-[clamp(8px,0.6vw,12px)]"
            >
              {loading ? <Loader2 className="animate-spin text-white" size={20} /> : <span className="ff-accia text-[20px] text-white lg:text-[clamp(20px,1.4vw,24px)]">Place Order</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Footer (rendered in flow via a relative wrapper since Footer is absolute) */}
      <div className="mt-[clamp(72px,10vw,140px)] pb-6">
        <Footer variant="flow" />
      </div>
    </div>
  )
}
