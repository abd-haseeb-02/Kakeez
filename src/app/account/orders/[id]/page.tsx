"use client"

import Link from "next/link"
import Image from "next/image"
import { use, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { formatPkr } from "@/lib/money"
import { ArrowLeft, Loader2, MapPin, Banknote, Gift, Star, Check, Edit3 } from "lucide-react"

type OrderItem = {
  id: string
  product_id: string | null
  product_name_snapshot: string
  variation_label_snapshot: string | null
  image_storage_path_snapshot: string | null
  quantity: number
  unit_price_minor_snapshot: number
  line_total_minor_snapshot: number
  customer_notes: string | null
}

interface ExistingReview {
  product_id: string
  rating: number
  status: 'pending' | 'published' | 'rejected'
}

type Order = {
  id: string
  order_number: string
  status: string
  payment_status: string
  is_gift: boolean
  customer_name: string
  customer_email: string
  customer_phone: string
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  delivery_fee_minor: number
  total_minor: number
  delivery_address_snapshot: DeliveryAddressSnapshot
  created_at: string
  order_items: OrderItem[]
}

type DeliveryAddressSnapshot = {
  recipient_name?: string | null
  line1?: string | null
  line2?: string | null
  area?: string | null
  city?: string | null
  postal_code?: string | null
  instructions?: string | null
}

type HistoryEntry = {
  id: number
  from_status: string | null
  to_status: string
  created_at: string
}

function statusColor(s: string): string {
  switch (s) {
    case 'delivered':       return 'text-emerald-600 bg-emerald-100'
    case 'cancelled':       return 'text-red-600 bg-red-100'
    case 'failed_delivery': return 'text-amber-700 bg-amber-100'
    case 'out_for_delivery':return 'text-blue-700 bg-blue-100'
    case 'preparing':       return 'text-orange-700 bg-orange-100'
    default:                return 'text-primary-brown bg-accent-green/40'
  }
}

export default function CustomerOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [reviews, setReviews] = useState<ExistingReview[]>([])
  const [loading, setLoading] = useState(true)
  const [openReviewFor, setOpenReviewFor] = useState<string>("")

  const loadReviews = async () => {
    const { data } = await supabase
      .from('product_reviews')
      .select('product_id, rating, status')
    setReviews(((data as ExistingReview[]) ?? []))
  }

  useEffect(() => {
    const load = async () => {
      const [oRes, hRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, payment_status, is_gift, customer_name, customer_email, customer_phone, subtotal_minor, discount_minor, tax_minor, delivery_fee_minor, total_minor, delivery_address_snapshot, created_at, order_items(id, product_id, product_name_snapshot, variation_label_snapshot, image_storage_path_snapshot, quantity, unit_price_minor_snapshot, line_total_minor_snapshot, customer_notes)')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('order_status_history')
          .select('id, from_status, to_status, created_at')
          .eq('order_id', id)
          .order('created_at', { ascending: true }),
      ])
      setOrder(oRes.data as Order | null)
      setHistory((hRes.data as HistoryEntry[]) ?? [])
      await loadReviews()
      setLoading(false)

      // Per-order realtime: customer sees their order status change live as
      // the kitchen / rider progresses it (G.X §B.2.2).
      const channel = supabase
        .channel(`customer-order-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, async () => {
          const fresh = await supabase
            .from('orders')
            .select('id, order_number, status, payment_status, is_gift, customer_name, customer_email, customer_phone, subtotal_minor, discount_minor, tax_minor, delivery_fee_minor, total_minor, delivery_address_snapshot, created_at, order_items(id, product_id, product_name_snapshot, variation_label_snapshot, image_storage_path_snapshot, quantity, unit_price_minor_snapshot, line_total_minor_snapshot, customer_notes)')
            .eq('id', id)
            .maybeSingle()
          setOrder(fresh.data as Order | null)
          const fh = await supabase
            .from('order_status_history')
            .select('id, from_status, to_status, created_at')
            .eq('order_id', id)
            .order('created_at', { ascending: true })
          setHistory((fh.data as HistoryEntry[]) ?? [])
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
    const cleanup = load()
    return () => { void cleanup }
  }, [id])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-brown" size={28} /></div>
  }
  if (!order) {
    return (
      <div className="space-y-4">
        <Link href="/account/orders" className="ff-apfel text-sm text-primary-brown flex items-center gap-2"><ArrowLeft size={14} /> Back to orders</Link>
        <p className="ff-accia text-2xl text-primary-brown">Order not found.</p>
      </div>
    )
  }

  const addr = order.delivery_address_snapshot ?? {}

  return (
    <div className="space-y-6">
      <Link href="/account/orders" className="ff-apfel text-sm text-primary-brown flex items-center gap-2"><ArrowLeft size={14} /> Back to orders</Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="ff-accia text-[clamp(28px,2.2vw,36px)] text-primary-brown">{order.order_number}</h2>
          <p className="ff-apfel text-xs text-black/40 mt-1">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <span className={`inline-block ff-apfel text-sm px-3 py-1.5 rounded-full capitalize ${statusColor(order.status)}`}>
          {order.status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="rounded-[16px] border border-primary-brown/10 bg-white/75 p-5 shadow-sm">
        <p className="mb-3 ff-colville text-xs uppercase tracking-[0.12em] text-primary-brown/55">Items</p>
        <div className="divide-y divide-primary-brown/5">
          {order.order_items.map((it) => {
            const myReview = it.product_id ? reviews.find((r) => r.product_id === it.product_id) : null
            const canReview = order.status === 'delivered' && !!it.product_id && !myReview
            return (
              <div key={it.id} className="py-3">
                <div className="flex items-start gap-4">
                  {it.image_storage_path_snapshot && (
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[10px] border border-primary-brown/10 bg-[#ece9e2]">
                      <Image src={it.image_storage_path_snapshot} alt="" fill sizes="56px" className="object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="ff-accia text-primary-brown">{it.product_name_snapshot}</p>
                    {it.variation_label_snapshot && <p className="ff-apfel text-xs text-black/50">{it.variation_label_snapshot}</p>}
                    {it.customer_notes && <p className="ff-accia-light text-xs italic text-black/60 mt-1">&quot;{it.customer_notes}&quot;</p>}
                    {myReview && (
                      <p className="ff-apfel text-xs text-emerald-700 mt-1.5 flex items-center gap-1.5">
                        <Check size={12} /> You rated this {myReview.rating}/5 ·{' '}
                        <span className="capitalize">{myReview.status}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="ff-apfel text-sm text-black/70">{it.quantity} × {formatPkr(it.unit_price_minor_snapshot)}</p>
                    <p className="ff-accia text-primary-brown">{formatPkr(it.line_total_minor_snapshot)}</p>
                  </div>
                </div>
                {canReview && it.product_id && (
                  openReviewFor === it.id ? (
                    <ReviewForm
                      productId={it.product_id}
                      productName={it.product_name_snapshot}
                      onDone={async () => { setOpenReviewFor(""); await loadReviews() }}
                      onCancel={() => setOpenReviewFor("")}
                    />
                  ) : (
                    <button
                      onClick={() => setOpenReviewFor(it.id)}
                      className="mt-2 inline-flex items-center gap-1.5 ff-apfel text-xs text-primary-brown hover:opacity-70 transition-opacity"
                    >
                      <Edit3 size={11} /> Write a review
                    </button>
                  )
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-primary-brown/10 space-y-1.5">
          <MoneyRow label="Subtotal" minor={order.subtotal_minor} />
          {order.discount_minor > 0 && <MoneyRow label="Discount" minor={-order.discount_minor} accent="text-emerald-700" />}
          <MoneyRow label="Delivery" minor={order.delivery_fee_minor} />
          {order.tax_minor > 0 && <MoneyRow label="Tax" minor={order.tax_minor} />}
          <MoneyRow label="Grand total" minor={order.total_minor} bold />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[16px] border border-primary-brown/10 bg-white/75 p-5 shadow-sm">
          <p className="mb-2 flex items-center gap-2 ff-colville text-xs uppercase tracking-[0.12em] text-primary-brown/55"><MapPin size={12} /> Delivery</p>
          <div className="ff-accia-light text-sm leading-relaxed text-black/70">
            {addr.recipient_name && <p className="ff-accia text-primary-brown text-base">{addr.recipient_name}</p>}
            {addr.line1 && <p>{addr.line1}</p>}
            {addr.line2 && <p>{addr.line2}</p>}
            {(addr.area || addr.city) && <p>{[addr.area, addr.city].filter(Boolean).join(', ')}</p>}
            {addr.instructions && <p className="text-xs italic text-black/50 mt-2">&quot;{addr.instructions}&quot;</p>}
          </div>
        </div>

        <div className="rounded-[16px] border border-primary-brown/10 bg-white/75 p-5 shadow-sm">
          <p className="mb-2 flex items-center gap-2 ff-colville text-xs uppercase tracking-[0.12em] text-primary-brown/55"><Banknote size={12} /> Payment</p>
          <p className="ff-accia text-primary-brown">Cash on Delivery</p>
          <p className="ff-apfel text-sm text-black/60 capitalize mt-1">Status: {order.payment_status.replace(/_/g, ' ')}</p>
          {order.is_gift && <p className="ff-apfel text-xs text-primary-brown flex items-center gap-2 mt-2"><Gift size={12} /> Gift — prices hidden on receipt</p>}
        </div>
      </div>

      <div className="rounded-[16px] border border-primary-brown/10 bg-white/75 p-5 shadow-sm">
        <p className="mb-3 ff-colville text-xs uppercase tracking-[0.12em] text-primary-brown/55">Timeline</p>
        <ol className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-4">
              <span className="ff-apfel text-sm text-black/70 capitalize">
                {h.from_status ? `${h.from_status.replace(/_/g, ' ')} → ` : ''}{h.to_status.replace(/_/g, ' ')}
              </span>
              <span className="ff-apfel text-xs text-black/40">{new Date(h.created_at).toLocaleString()}</span>
            </li>
          ))}
          {history.length === 0 && <p className="ff-apfel text-sm text-black/40 italic">No history yet.</p>}
        </ol>
      </div>
    </div>
  )
}

function MoneyRow({ label, minor, accent, bold }: { label: string; minor: number; accent?: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'ff-accia text-base text-primary-brown mt-1' : 'ff-apfel text-sm text-black/70'} ${accent ?? ''}`}>
      <span>{label}</span>
      <span>{minor < 0 ? '−' : ''}{formatPkr(Math.abs(minor))}</span>
    </div>
  )
}

function ReviewForm({
  productId, productName, onDone, onCancel,
}: { productId: string; productName: string; onDone: () => void | Promise<void>; onCancel: () => void }) {
  const [rating, setRating]   = useState(5)
  const [title, setTitle]     = useState("")
  const [body, setBody]       = useState("")
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string>("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError("")
    const { error: rpcErr } = await supabase.rpc('submit_product_review', {
      p_product_id: productId,
      p_rating: rating,
      p_title: title || null,
      p_body: body || null,
    })
    setBusy(false)
    if (rpcErr) {
      const head = rpcErr.message?.split(':')[0]?.trim() ?? rpcErr.message ?? 'error'
      setError(
        head === 'already_reviewed'      ? "You've already reviewed this product." :
        head === 'not_verified_purchase' ? "We couldn't verify this purchase. Try refreshing." :
        head === 'invalid_rating'        ? 'Please pick a rating from 1 to 5.' :
                                           (rpcErr.message ?? 'Could not submit review.')
      )
      return
    }
    await onDone()
  }

  return (
    <form onSubmit={submit} className="mt-3 rounded-xl border border-primary-brown/15 bg-accent-green/15 p-4 space-y-3">
      <p className="ff-accia text-sm text-primary-brown">Reviewing <span className="text-black">{productName}</span></p>

      <div>
        <p className="ff-apfel text-xs text-black/40 mb-1.5 uppercase tracking-widest">Rating</p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className="transition-transform hover:scale-110"
            >
              <Star
                size={22}
                className={n <= rating ? 'text-amber-400 fill-amber-400' : 'text-black/15'}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="ff-apfel text-xs text-black/40 mb-1.5 block uppercase tracking-widest">Title (optional)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Sum it up in one line"
          className="w-full bg-white border border-primary-brown/15 rounded-lg px-3 py-2 outline-none focus:border-primary-brown/40 ff-apfel text-sm"
        />
      </div>

      <div>
        <label className="ff-apfel text-xs text-black/40 mb-1.5 block uppercase tracking-widest">Review (optional)</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="What did you love? Anything that could be better?"
          className="w-full bg-white border border-primary-brown/15 rounded-lg px-3 py-2 outline-none focus:border-primary-brown/40 ff-apfel text-sm resize-none"
        />
      </div>

      {error && <p className="ff-apfel text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-primary-brown text-white px-4 py-2 rounded-lg ff-apfel text-sm hover:bg-primary-brown/90 transition-all disabled:opacity-60"
        >
          {busy ? <Loader2 className="animate-spin inline" size={14} /> : 'Submit review'}
        </button>
        <button type="button" onClick={onCancel} className="ff-apfel text-xs text-black/50 hover:text-black/80">Cancel</button>
        <p className="ff-apfel text-[11px] text-black/40 ml-auto">Will appear after admin approval.</p>
      </div>
    </form>
  )
}
