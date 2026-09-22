"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useCart } from "@/store/useCart"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import { Loader2, CheckCircle, Minus, Plus, Trash2, ChevronLeft, ChevronRight, Banknote, Gift, ShoppingCart, Package } from "lucide-react"
import { placeOrder, previewCheckout, type CheckoutCartLine, type CheckoutPreviewResult } from "./actions"
import { formatPkr } from "@/lib/money"
import { FALLBACK_DELIVERY_MINOR } from "@/lib/delivery"
import { useToast } from "@/components/ui/Toast"

// A bakery needs lead time and can't deliver into the past, so the date picker
// opens at tomorrow and closes three months out.
const MIN_LEAD_DAYS = 1
const MAX_ORDER_DAYS = 90

// Pakistani mobiles are 3XXXXXXXXX. Customers write them every which way —
// 0300 1234567, +92 300 1234567, 92-300-1234567 — and all of those are correct.
// Normalising rather than pattern-matching one spelling means a valid local
// number isn't rejected at the last step of checkout, and means the order's
// `phone_e164` column actually holds E.164.
function toE164Pk(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const local = digits.startsWith('92')
    ? digits.slice(2)
    : digits.startsWith('0')
      ? digits.slice(1)
      : digits
  return /^3\d{9}$/.test(local) ? `+92${local}` : null
}

// Visual order of the form, so "jump to the first problem" means the topmost
// one rather than whatever order the errors object happens to enumerate in.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const FIELD_ORDER = ['name', 'phone', 'email', 'address', 'deliveryDate'] as const
const FIELD_IDS: Record<(typeof FIELD_ORDER)[number], string> = {
  name: 'co-name',
  phone: 'co-phone',
  email: 'co-email',
  address: 'co-address',
  deliveryDate: 'co-date',
}

function isoDay(offsetDays: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

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
  priceMinor: number
}

export default function CheckoutPage() {
  const { items, addItem, removeItem, updateQuantity, totalMinor, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  // Which fields the customer has left, so errors appear on blur/submit rather
  // than scolding them mid-typing.
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [user, setUser] = useState<CheckoutUser | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const router = useRouter()
  const toast = useToast()

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
  const [railAtStart, setRailAtStart] = useState(true)
  const [railAtEnd, setRailAtEnd] = useState(false)
  const railRef = useRef<HTMLDivElement | null>(null)
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
          .select('phone_e164')
          .eq('id', session.user.id)
          .maybeSingle()
        if (profile?.phone_e164) setPhone(profile.phone_e164)
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
                priceMinor: p.base_price_minor ?? 0,
              }
            })
          )
        }
      })
  }, [])

  // Normalised once and used by both the preview call below and the validation
  // further down, so declared ahead of its first reader.
  const phoneE164 = toE164Pk(phone)

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
        phone_e164: phoneE164 ?? phone,
        line1: address,
        city: "Lahore",
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
            : `Promo ${result.promoCode} applied - ${formatPkr(result.discountMinor)} off!`
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
  // Integer paisa end to end — no float sums, and every render goes through
  // formatPkr so the cart, checkout and order emails agree on "Rs. 2,550.00".
  const subtotalMinor = previewOk ? previewOk.subtotalMinor : totalMinor()
  const discountMinor = previewOk ? previewOk.discountMinor : appliedPromo ? appliedPromo.discountMinor : 0
  const deliveryMinor = previewOk ? previewOk.deliveryFeeMinor : items.length > 0 ? FALLBACK_DELIVERY_MINOR : 0
  const taxMinor = previewOk ? previewOk.taxMinor : 0
  const grandTotalMinor = previewOk
    ? previewOk.totalMinor
    : Math.max(0, subtotalMinor - discountMinor) + deliveryMinor + taxMinor

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

  // Every field the order genuinely cannot be fulfilled without. Place Order
  // used to be gated on nothing but a non-empty cart, so a blank address and a
  // blank phone number reached the kitchen on a cash-on-delivery order.
  const errors: Record<string, string> = {
    ...(name.trim() ? {} : { name: 'We need a name for the delivery.' }),
    ...(!phone.replace(/\D/g, '')
      ? { phone: 'The rider needs a number to reach you on.' }
      : !phoneE164
        ? { phone: 'Enter a Pakistani mobile, e.g. 0300 1234567.' }
        : {}),
    ...(email.trim() && !EMAIL_RE.test(email.trim())
      ? { email: 'That email address looks incomplete.' }
      : {}),
    ...(address.trim().length < 10
      ? { address: 'Please give a full address we can actually find.' }
      : {}),
    ...(!deliveryDate
      ? { deliveryDate: 'Pick the day you want this delivered.' }
      : deliveryDate < isoDay(MIN_LEAD_DAYS)
        ? { deliveryDate: 'We need at least a day to bake. Pick a later date.' }
        : {}),
  }

  const isValid = Object.keys(errors).length === 0
  const showError = (field: string) => (submitAttempted || touched[field]) && errors[field]
  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }))

  // Native horizontal scrolling with snap points, rather than translating the
  // track by a fixed pixel step that never matched the responsive card width.
  const syncRail = useCallback(() => {
    const el = railRef.current
    if (!el) return
    setRailAtStart(el.scrollLeft <= 1)
    setRailAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1)
  }, [])

  useEffect(() => {
    if (popular.length === 0) return
    syncRail()
  }, [popular.length, syncRail])

  const scrollRail = (direction: -1 | 1) => {
    const el = railRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const step = card ? card.getBoundingClientRect().width + 12 : el.clientWidth
    el.scrollBy({ left: direction * step, behavior: 'smooth' })
  }

  const handlePlaceOrder = async () => {
    if (!user || items.length === 0) return
    setSubmitAttempted(true)
    if (!isValid) {
      // Move them to the first thing that needs fixing rather than leaving them
      // to hunt for it — the form is long enough to scroll an error off screen.
      // Keyed off `errors` rather than the rendered error nodes: those don't
      // exist yet on this tick, since setSubmitAttempted hasn't re-rendered.
      const firstField = FIELD_ORDER.find((f) => errors[f])
      if (firstField) {
        const el = document.getElementById(FIELD_IDS[firstField])
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.focus({ preventScroll: true })
      }
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
        phone_e164: phoneE164 ?? phone,
        line1: address,
        city: "Lahore",
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
    setOrderNumber(result.orderNumber)
    setSuccess(true)
  }

  if (authChecking) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-primary-brown" size={40} /></div>
  }

  if (success) {
    // The screen used to say "Order Confirmed!" and nothing else: no reference
    // to quote, no way to reach the order, no word about the email. The
    // customer had just committed to paying and was handed a dead end.
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent-green/50 md:h-[clamp(96px,8vw,140px)] md:w-[clamp(96px,8vw,140px)]">
          <CheckCircle className="h-12 w-12 text-primary-brown md:h-[clamp(48px,4vw,70px)] md:w-[clamp(48px,4vw,70px)]" />
        </div>
        <h1 className="ff-accia text-[clamp(42px,3.5vw,64px)] leading-none text-primary-brown">Order Confirmed!</h1>

        {orderNumber && (
          <div className="flex items-center gap-2.5 rounded-[12px] border border-primary-brown/25 bg-accent-green/40 px-5 py-3">
            <Package className="h-5 w-5 shrink-0 text-primary-brown" />
            <span className="ff-accia-light text-[clamp(15px,1vw,17px)] text-black/70">Your order number is</span>
            <strong className="ff-accia text-[clamp(18px,1.3vw,22px)] tracking-wide text-primary-brown">{orderNumber}</strong>
          </div>
        )}

        <p className="max-w-md ff-accia-light text-[clamp(17px,1.3vw,22px)] text-black/60">
          Thank you for your order. We are getting the oven ready! A confirmation email is on its way, and we will call to confirm before we start baking.
        </p>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <button onClick={() => router.push("/account/orders")} className="rounded-[10px] bg-primary-brown px-8 py-3 ff-accia text-[18px] text-white transition-all hover:bg-primary-brown/90 md:px-[clamp(32px,3vw,54px)] md:py-[clamp(12px,1vw,18px)] md:text-[clamp(18px,1.4vw,24px)]">
            Track your order
          </button>
          <button onClick={() => router.push("/")} className="rounded-[10px] border border-primary-brown px-8 py-3 ff-accia text-[18px] text-primary-brown transition-all hover:bg-primary-brown/5 md:px-[clamp(32px,3vw,54px)] md:py-[clamp(12px,1vw,18px)] md:text-[clamp(18px,1.4vw,24px)]">
            Continue Shopping
          </button>
        </div>
      </div>
    )
  }

  const inputCls = "h-11 w-full rounded-[10px] border border-primary-brown/30 bg-white px-4 ff-accia-light text-[16px] text-black outline-none transition-all placeholder:text-black/35 focus:border-primary-brown lg:h-[clamp(40px,2.66vw,52px)] lg:rounded-[clamp(8px,0.6vw,12px)] lg:px-[clamp(12px,1vw,18px)] lg:text-[clamp(15px,1.04vw,18px)]"
  const labelCls = "ff-accia text-[clamp(18px,1.45vw,25px)] text-black"
  const errorCls = "ff-apfel text-[13px] text-red-600"

  return (
    <div className="relative min-h-screen w-full overflow-x-clip bg-white">
      <Navbar />

      {/* Green panel with form + summary */}
      <div className="relative mx-auto mt-[clamp(108px,8.8vw,150px)] w-[calc(100%_-_24px)] rounded-[18px] bg-accent-green pb-14 pt-7 lg:w-[calc(100%_-_40px)] lg:rounded-[clamp(16px,1.4vw,24px)] lg:pb-[clamp(56px,5vw,86px)] lg:pt-[clamp(42px,3.76vw,64px)]">
        {/* drip bottom edge */}
        <div className="pointer-events-none absolute bottom-[-118px] left-0 z-0 hidden h-[clamp(126px,11rem,176px)] w-full lg:block">
          <Image src="/assets/vector14.svg" alt="" fill className="block h-full w-full object-fill" />
        </div>

        <div className="relative mx-auto flex w-[min(1390px,calc(100%_-_32px))] flex-col gap-6 lg:flex-row lg:items-start lg:gap-[clamp(20px,1.56vw,30px)]">
          {/* ===================== LEFT: FORM ===================== */}
          <div className="w-full lg:min-w-0 lg:flex-1">
            {/* Row 1: Full name | Mobile */}
            <div className="grid gap-4 md:grid-cols-2 lg:gap-[clamp(12px,0.8vw,18px)]">
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label htmlFor="co-name" className={labelCls}>Full Name</label>
                <input
                  id="co-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => markTouched('name')}
                  autoComplete="name"
                  placeholder="Enter your name"
                  aria-invalid={!!showError('name')}
                  aria-describedby={showError('name') ? 'co-name-error' : undefined}
                  className={inputCls}
                />
                {showError('name') && <p id="co-name-error" data-field-error="true" className={errorCls}>{errors.name}</p>}
              </div>
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label htmlFor="co-phone" className={labelCls}>Mobile Number</label>
                {/* type=tel + inputMode brings up a keypad instead of a QWERTY
                    keyboard - this is the number the COD rider will call. */}
                <input
                  id="co-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => markTouched('phone')}
                  autoComplete="tel"
                  placeholder="+92 300 1234567"
                  aria-invalid={!!showError('phone')}
                  aria-describedby={showError('phone') ? 'co-phone-error' : undefined}
                  className={inputCls}
                />
                {showError('phone') && <p id="co-phone-error" data-field-error="true" className={errorCls}>{errors.phone}</p>}
              </div>
            </div>

            {/* Row 2: Email */}
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:mt-[clamp(14px,1.1vw,22px)] lg:gap-[clamp(12px,0.8vw,18px)]">
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label htmlFor="co-email" className={labelCls}>Email Address</label>
                <input
                  id="co-email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => markTouched('email')}
                  autoComplete="email"
                  placeholder="Enter your email address"
                  aria-invalid={!!showError('email')}
                  aria-describedby={showError('email') ? 'co-email-error' : undefined}
                  className={inputCls}
                />
                {showError('email') && <p id="co-email-error" data-field-error="true" className={errorCls}>{errors.email}</p>}
              </div>
            </div>

            {/* Delivery address. This used to be a button that opened a native
                window.prompt(): unstyled, unvalidatable, impossible to review
                before submitting, and miserable on a phone. */}
            <div className="mt-4 space-y-2 lg:mt-[clamp(14px,1.1vw,22px)] lg:space-y-[clamp(6px,0.5vw,10px)]">
              <label htmlFor="co-address" className={labelCls}>Delivery Address</label>
              <textarea
                id="co-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onBlur={() => markTouched('address')}
                autoComplete="street-address"
                rows={3}
                placeholder="House / flat number, street, area - e.g. House 42, Street 7, Block C, Johar Town"
                aria-invalid={!!showError('address')}
                aria-describedby={showError('address') ? 'co-address-error' : 'co-address-hint'}
                className="w-full resize-none rounded-[10px] border border-primary-brown/30 bg-white px-4 py-3 ff-accia-light text-[16px] text-black outline-none transition-all placeholder:text-black/35 focus:border-primary-brown lg:rounded-[clamp(8px,0.6vw,12px)] lg:px-[clamp(12px,1vw,18px)] lg:text-[clamp(15px,1.04vw,18px)]"
              />
              {showError('address')
                ? <p id="co-address-error" data-field-error="true" className={errorCls}>{errors.address}</p>
                : <p id="co-address-hint" className="ff-apfel text-[13px] text-black/45">We currently deliver within Lahore only.</p>}
            </div>

            {/* Delivery slot */}
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:mt-[clamp(14px,1.1vw,22px)] lg:gap-[clamp(12px,0.8vw,18px)]">
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label htmlFor="co-date" className={labelCls}>Delivery Date</label>
                <input
                  id="co-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  onBlur={() => markTouched('deliveryDate')}
                  min={isoDay(MIN_LEAD_DAYS)}
                  max={isoDay(MAX_ORDER_DAYS)}
                  aria-invalid={!!showError('deliveryDate')}
                  aria-describedby={showError('deliveryDate') ? 'co-date-error' : undefined}
                  className={inputCls}
                />
                {showError('deliveryDate') && <p id="co-date-error" data-field-error="true" className={errorCls}>{errors.deliveryDate}</p>}
              </div>
              <div className="space-y-2 lg:space-y-[clamp(6px,0.5vw,10px)]">
                <label htmlFor="co-window" className={labelCls}>Delivery Window</label>
                <select id="co-window" value={deliveryWindow} onChange={(e) => setDeliveryWindow(e.target.value)} className={inputCls}>
                  <option value="">Any time</option>
                  <option value="10:00 AM - 1:00 PM">10:00 AM - 1:00 PM</option>
                  <option value="1:00 PM - 4:00 PM">1:00 PM - 4:00 PM</option>
                  <option value="4:00 PM - 7:00 PM">4:00 PM - 7:00 PM</option>
                </select>
              </div>
            </div>

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
          <div className="flex w-full flex-col self-start rounded-[16px] bg-white p-4 sm:p-5 lg:sticky lg:top-[130px] lg:w-[clamp(320px,26vw,390px)] lg:rounded-[clamp(12px,1vw,18px)] lg:p-[clamp(16px,1.2vw,24px)]">
            <h2 className="ff-accia text-[clamp(24px,1.45vw,28px)] text-black">Your cart</h2>

            {/* Items */}
            <div className="mt-4 space-y-4 pr-1 lg:mt-[clamp(12px,1vw,20px)] lg:space-y-[clamp(12px,1vw,20px)] lg:pr-[clamp(4px,0.3vw,6px)]">
              {items.length === 0 ? (
                <p className="py-8 text-center ff-accia-light text-[16px] text-black/50 lg:py-[clamp(24px,2vw,38px)] lg:text-[clamp(15px,1vw,17px)]">Your cart is empty.</p>
              ) : items.map((item) => (
                <div key={item.key} className="flex gap-3 lg:gap-[clamp(10px,0.8vw,16px)]">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] border border-primary-brown bg-[#ece9e2] lg:h-[clamp(64px,5.15vw,92px)] lg:w-[clamp(64px,5.15vw,92px)] lg:rounded-[clamp(8px,0.6vw,12px)]">
                    {item.image && <Image src={item.image} alt={item.name} fill className="object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 lg:gap-[clamp(8px,0.5vw,12px)]">
                      <h3 className="line-clamp-1 ff-accia text-[20px] leading-[1.05] text-black lg:text-[clamp(18px,1.1vw,22px)]">{item.name}</h3>
                      <button onClick={() => removeItem(item.key)} aria-label={`Remove ${item.name} from cart`} className="shrink-0 text-black/50 transition-colors hover:text-red-500"><Trash2 className="h-4 w-4 lg:h-[clamp(14px,1vw,18px)] lg:w-[clamp(14px,1vw,18px)]" /></button>
                    </div>
                    {item.variationLabel && <p className="mt-1 ff-apfel text-[12px] text-primary-brown">{item.variationLabel}</p>}
                    {item.description && <p className="mt-1 line-clamp-2 ff-accia-light text-[13px] capitalize leading-[1.2] text-black/55 lg:mt-[clamp(2px,0.2vw,4px)] lg:text-[clamp(12px,0.8vw,14px)]">{item.description}</p>}
                    <div className="mt-2 flex items-center justify-between lg:mt-[clamp(6px,0.4vw,10px)]">
                      <div className="inline-flex h-8 items-center gap-3 rounded-full border border-primary-brown/40 px-3 lg:h-[clamp(24px,1.6vw,32px)] lg:gap-[clamp(8px,0.6vw,12px)] lg:px-[clamp(8px,0.5vw,12px)]">
                        <button onClick={() => updateQuantity(item.key, item.quantity - 1)} aria-label={`Decrease quantity of ${item.name}`} className="text-primary-brown"><Minus className="h-3.5 w-3.5 lg:h-[clamp(12px,0.8vw,15px)] lg:w-[clamp(12px,0.8vw,15px)]" /></button>
                        <span className="ff-accia text-[16px] leading-none text-primary-brown lg:text-[clamp(14px,0.95vw,17px)]">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.key, item.quantity + 1)} aria-label={`Increase quantity of ${item.name}`} className="text-primary-brown"><Plus className="h-3.5 w-3.5 lg:h-[clamp(12px,0.8vw,15px)] lg:w-[clamp(12px,0.8vw,15px)]" /></button>
                      </div>
                      <div className="text-right">
                        <span className="ff-accia text-[16px] text-primary-brown lg:text-[clamp(15px,1vw,18px)]">{formatPkr(item.priceMinor * item.quantity)}</span>
                        {item.quantity > 1 && <p className="ff-apfel text-[11px] text-black/45">{item.quantity} &times; {formatPkr(item.priceMinor)}</p>}
                      </div>
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
                    <button onClick={() => scrollRail(-1)} disabled={railAtStart} aria-label="Previous popular item" className="disabled:opacity-30"><ChevronLeft className="h-5 w-4 lg:h-[clamp(16px,1.2vw,22px)] lg:w-[clamp(12px,0.8vw,16px)]" /></button>
                    <button onClick={() => scrollRail(1)} disabled={railAtEnd} aria-label="Next popular item" className="disabled:opacity-30"><ChevronRight className="h-5 w-4 lg:h-[clamp(16px,1.2vw,22px)] lg:w-[clamp(12px,0.8vw,16px)]" /></button>
                  </div>
                </div>
                <div
                  ref={railRef}
                  onScroll={syncRail}
                  className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth lg:mt-[clamp(8px,0.6vw,12px)] lg:gap-[clamp(8px,0.6vw,12px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {popular.map((p) => (
                      <div key={p.id} className="flex w-[220px] shrink-0 snap-start gap-3 rounded-[10px] bg-white p-2 lg:w-[clamp(220px,12.6vw,246px)] lg:gap-[clamp(8px,0.5vw,10px)] lg:rounded-[clamp(8px,0.5vw,10px)] lg:p-[clamp(8px,0.5vw,10px)]">
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[8px] border border-primary-brown bg-[#ece9e2] lg:h-[clamp(64px,4.3vw,82px)] lg:w-[clamp(64px,4.3vw,82px)] lg:rounded-[clamp(6px,0.4vw,8px)]">
                          {p.image_url && <Image src={p.image_url} alt={p.name} fill className="object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <h4 className="line-clamp-2 ff-accia text-[15px] leading-[1.0] text-black lg:text-[clamp(13px,0.85vw,15px)]">{p.name}</h4>
                          <p className="ff-accia text-[13px] text-primary-brown">{formatPkr(p.priceMinor, { trimDecimals: true })}</p>
                          {/* Labelled "Rs. 1,980.00" before, so nothing said it
                              was an action and a screen reader read out a bare
                              number with no verb. */}
                          <button
                            onClick={() => {
                              addItem({ id: p.id, name: p.name, priceMinor: p.priceMinor, quantity: 1, image: p.image_url || "/assets/product.svg", description: p.description ?? undefined })
                              toast.push({ kind: 'success', title: `Added to cart \u2014 ${p.name}`, durationMs: 4000 })
                            }}
                            aria-label={`Add ${p.name} to cart`}
                            className="flex items-center gap-1 self-start rounded-[6px] bg-accent-green px-2 py-1 ff-accia-light text-[12px] uppercase tracking-wide text-primary-brown transition-colors hover:bg-accent-green/70 lg:rounded-[clamp(5px,0.3vw,7px)] lg:px-[clamp(8px,0.5vw,10px)] lg:py-[clamp(2px,0.15vw,4px)]"
                          >
                            <ShoppingCart className="h-3 w-3" /> Add
                          </button>
                        </div>
                      </div>
                    ))}
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
              <div className="flex justify-between"><span className="ff-accia-light text-[17px] capitalize text-black lg:text-[clamp(16px,1.1vw,20px)]">Subtotal</span><span className="ff-accia-light text-[17px] text-black lg:text-[clamp(16px,1.1vw,20px)]">{formatPkr(subtotalMinor)}</span></div>
              {discountMinor > 0 && <div className="flex justify-between"><span className="ff-accia-light text-[17px] capitalize text-green-700 lg:text-[clamp(16px,1.1vw,20px)]">Discount</span><span className="ff-accia-light text-[17px] text-green-700 lg:text-[clamp(16px,1.1vw,20px)]">- {formatPkr(discountMinor)}</span></div>}
              <div className="flex justify-between"><span className="ff-accia-light text-[17px] capitalize text-black lg:text-[clamp(16px,1.1vw,20px)]">Delivery charges</span><span className="ff-accia-light text-[17px] text-black lg:text-[clamp(16px,1.1vw,20px)]">{formatPkr(deliveryMinor)}</span></div>
              {taxMinor > 0 && <div className="flex justify-between"><span className="ff-accia-light text-[17px] capitalize text-black lg:text-[clamp(16px,1.1vw,20px)]">Tax</span><span className="ff-accia-light text-[17px] text-black lg:text-[clamp(16px,1.1vw,20px)]">{formatPkr(taxMinor)}</span></div>}
              <div className="flex justify-between pt-1 lg:pt-[clamp(4px,0.3vw,6px)]"><span className="ff-accia-medium text-[19px] text-black lg:text-[clamp(18px,1.2vw,22px)]">Grand total</span><span className="ff-accia-medium text-[19px] text-black lg:text-[clamp(18px,1.2vw,22px)]">{formatPkr(grandTotalMinor)}</span></div>
            </div>

            {/* Place order */}
            <button
              onClick={handlePlaceOrder}
              disabled={loading || items.length === 0}
              aria-disabled={!isValid}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-[10px] bg-primary-brown transition-all hover:bg-primary-brown/90 disabled:opacity-50 lg:mt-[clamp(16px,1.2vw,24px)] lg:h-[clamp(44px,2.83vw,56px)] lg:rounded-[clamp(8px,0.6vw,12px)]"
            >
              {loading ? <Loader2 className="animate-spin text-white" size={20} /> : <span className="ff-accia text-[20px] text-white lg:text-[clamp(20px,1.4vw,24px)]">Place Order</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Footer (rendered in flow via a relative wrapper since Footer is absolute) */}
      <div className="mt-[clamp(42px,8vw,64px)] pb-6 lg:mt-[clamp(72px,10vw,140px)]">
        <Footer variant="flow" />
      </div>
    </div>
  )
}
