"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { formatPkr } from "@/lib/money"
import { ArrowLeft, Loader2, MapPin, Banknote, Gift } from "lucide-react"

type OrderItem = {
  id: string
  product_name_snapshot: string
  variation_label_snapshot: string | null
  image_storage_path_snapshot: string | null
  quantity: number
  unit_price_minor_snapshot: number
  line_total_minor_snapshot: number
  customer_notes: string | null
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
  delivery_address_snapshot: Record<string, any>
  created_at: string
  order_items: OrderItem[]
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [oRes, hRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, payment_status, is_gift, customer_name, customer_email, customer_phone, subtotal_minor, discount_minor, tax_minor, delivery_fee_minor, total_minor, delivery_address_snapshot, created_at, order_items(id, product_name_snapshot, variation_label_snapshot, image_storage_path_snapshot, quantity, unit_price_minor_snapshot, line_total_minor_snapshot, customer_notes)')
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
      setLoading(false)

      // Per-order realtime: customer sees their order status change live as
      // the kitchen / rider progresses it (G.X §B.2.2).
      const channel = supabase
        .channel(`customer-order-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, async () => {
          const fresh = await supabase
            .from('orders')
            .select('id, order_number, status, payment_status, is_gift, customer_name, customer_email, customer_phone, subtotal_minor, discount_minor, tax_minor, delivery_fee_minor, total_minor, delivery_address_snapshot, created_at, order_items(id, product_name_snapshot, variation_label_snapshot, image_storage_path_snapshot, quantity, unit_price_minor_snapshot, line_total_minor_snapshot, customer_notes)')
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

      <div className="rounded-2xl border border-primary-brown/15 bg-white p-5">
        <p className="ff-apfel text-xs uppercase tracking-widest text-black/30 mb-3">Items</p>
        <div className="divide-y divide-primary-brown/5">
          {order.order_items.map((it) => (
            <div key={it.id} className="py-3 flex items-start gap-4">
              {it.image_storage_path_snapshot && (
                <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden border border-primary-brown/15 bg-[#ece9e2]">
                  <img src={it.image_storage_path_snapshot} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="ff-accia text-primary-brown">{it.product_name_snapshot}</p>
                {it.variation_label_snapshot && <p className="ff-apfel text-xs text-black/50">{it.variation_label_snapshot}</p>}
                {it.customer_notes && <p className="ff-accia-light text-xs italic text-black/60 mt-1">&quot;{it.customer_notes}&quot;</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="ff-apfel text-sm text-black/70">{it.quantity} × {formatPkr(it.unit_price_minor_snapshot)}</p>
                <p className="ff-accia text-primary-brown">{formatPkr(it.line_total_minor_snapshot)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-primary-brown/10 space-y-1.5">
          <MoneyRow label="Subtotal" minor={order.subtotal_minor} />
          {order.discount_minor > 0 && <MoneyRow label="Discount" minor={-order.discount_minor} accent="text-emerald-700" />}
          <MoneyRow label="Delivery" minor={order.delivery_fee_minor} />
          {order.tax_minor > 0 && <MoneyRow label="Tax" minor={order.tax_minor} />}
          <MoneyRow label="Grand total" minor={order.total_minor} bold />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-primary-brown/15 bg-white p-5">
          <p className="ff-apfel text-xs uppercase tracking-widest text-black/30 mb-2 flex items-center gap-2"><MapPin size={12} /> Delivery</p>
          <div className="ff-accia-light text-sm leading-relaxed text-black/70">
            {addr.recipient_name && <p className="ff-accia text-primary-brown text-base">{addr.recipient_name}</p>}
            {addr.line1 && <p>{addr.line1}</p>}
            {addr.line2 && <p>{addr.line2}</p>}
            {(addr.area || addr.city) && <p>{[addr.area, addr.city].filter(Boolean).join(', ')}</p>}
            {addr.instructions && <p className="text-xs italic text-black/50 mt-2">&quot;{addr.instructions}&quot;</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-primary-brown/15 bg-white p-5">
          <p className="ff-apfel text-xs uppercase tracking-widest text-black/30 mb-2 flex items-center gap-2"><Banknote size={12} /> Payment</p>
          <p className="ff-accia text-primary-brown">Cash on Delivery</p>
          <p className="ff-apfel text-sm text-black/60 capitalize mt-1">Status: {order.payment_status.replace(/_/g, ' ')}</p>
          {order.is_gift && <p className="ff-apfel text-xs text-primary-brown flex items-center gap-2 mt-2"><Gift size={12} /> Gift — prices hidden on receipt</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-primary-brown/15 bg-white p-5">
        <p className="ff-apfel text-xs uppercase tracking-widest text-black/30 mb-3">Timeline</p>
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
