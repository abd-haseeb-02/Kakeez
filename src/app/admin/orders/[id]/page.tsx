"use client"

import { useEffect, useMemo, useState, use } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import { formatPkr } from "@/lib/money"
import {
  ArrowLeft, Loader2, Clock, CheckCircle, XCircle, Truck, MapPin,
  User, Mail, Phone, Gift, Banknote, AlertTriangle, RotateCcw, History,
} from "lucide-react"

// Order detail (admin) — Phase 3.
// Renders everything an admin needs to fulfill or argue about an order:
// customer + delivery address snapshot, line items with frozen prices,
// money breakdown, payment record, status timeline, and the same valid-
// transition gated status dropdown the list page uses.

type OrderItemRow = {
  id: string
  product_id: string | null
  variation_id: string | null
  product_name_snapshot: string
  variation_label_snapshot: string | null
  image_storage_path_snapshot: string | null
  is_perishable_snapshot: boolean
  is_custom: boolean
  unit_price_minor_snapshot: number
  quantity: number
  line_total_minor_snapshot: number
  customer_notes: string | null
}

type OrderRow = {
  id: string
  order_number: string
  user_id: string | null
  customer_name: string
  customer_email: string
  customer_phone: string
  status: string
  payment_status: string
  payment_method: string
  channel: string
  is_gift: boolean
  customer_note: string | null
  internal_note: string | null
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  delivery_fee_minor: number
  total_minor: number
  currency: string
  coupon_code: string | null
  delivery_address_snapshot: DeliveryAddressSnapshot
  delivery_slot_date: string | null
  delivery_slot_window: string | null
  created_at: string
  updated_at: string
  order_items: OrderItemRow[]
}

type HistoryRow = {
  id: number
  from_status: string | null
  to_status: string
  reason: string | null
  actor_role: string | null
  created_at: string
}

type PaymentRow = {
  id: string
  status: string
  amount_minor: number
  collected_amount_minor: number | null
  collected_at: string | null
  provider: string
  method: string
}

type Transition = { from_status: string; to_status: string }

type DeliveryAddressSnapshot = {
  recipient_name?: string | null
  line1?: string | null
  line2?: string | null
  area?: string | null
  city?: string | null
  postal_code?: string | null
  instructions?: string | null
}

function statusBadgeColor(status: string): string {
  switch (status) {
    case 'pending_confirmation': return 'bg-blue-500/15 text-blue-300'
    case 'confirmed':            return 'bg-blue-500/25 text-blue-200'
    case 'preparing':            return 'bg-orange-500/15 text-orange-300'
    case 'ready_for_dispatch':   return 'bg-orange-500/25 text-orange-200'
    case 'out_for_delivery':     return 'bg-violet-500/15 text-violet-300'
    case 'delivered':            return 'bg-emerald-500/15 text-emerald-300'
    case 'failed_delivery':      return 'bg-amber-500/15 text-amber-300'
    case 'cancelled':            return 'bg-red-500/15 text-red-300'
    case 'disputed':             return 'bg-purple-500/15 text-purple-300'
    default:                     return 'bg-white/10 text-white/60'
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'pending_confirmation':
    case 'confirmed':            return <Clock size={14} />
    case 'preparing':            return <Loader2 size={14} className="animate-spin" />
    case 'ready_for_dispatch':
    case 'out_for_delivery':     return <Truck size={14} />
    case 'delivered':            return <CheckCircle size={14} />
    case 'failed_delivery':
    case 'cancelled':
    case 'disputed':             return <XCircle size={14} />
    default:                     return <Clock size={14} />
  }
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const toast = useToast()

  const [order, setOrder] = useState<OrderRow | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [payment, setPayment] = useState<PaymentRow | null>(null)
  const [transitions, setTransitions] = useState<Transition[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>("")

  const fetchAll = async () => {
    setLoading(true)
    const [oRes, hRes, pRes, tRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(id, product_id, variation_id, product_name_snapshot, variation_label_snapshot, image_storage_path_snapshot, is_perishable_snapshot, is_custom, unit_price_minor_snapshot, quantity, line_total_minor_snapshot, customer_notes)')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('order_status_history')
        .select('id, from_status, to_status, reason, actor_role, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('payments')
        .select('id, status, amount_minor, collected_amount_minor, collected_at, provider, method')
        .eq('order_id', id)
        .maybeSingle(),
      supabase.from('order_status_transitions').select('from_status, to_status'),
    ])
    if (oRes.data) setOrder(oRes.data as unknown as OrderRow)
    setHistory((hRes.data as HistoryRow[]) ?? [])
    setPayment((pRes.data as PaymentRow | null) ?? null)
    setTransitions((tRes.data as Transition[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll()
    // Realtime: keep this page in sync if another admin tab moves the order.
    const channel = supabase
      .channel(`admin-order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, fetchAll)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const allowedNextStatuses = useMemo<string[]>(() => {
    if (!order) return []
    return transitions.filter((t) => t.from_status === order.status).map((t) => t.to_status)
  }, [order, transitions])

  const doTransition = async (to: string, reason?: string) => {
    if (!order) return
    setBusy(true)
    setError("")
    const { error: rpcErr } = await supabase.rpc('update_order_status', {
      p_order_id: order.id,
      p_to_status: to,
      p_reason: reason ?? null,
    })
    setBusy(false)
    if (rpcErr) {
      const head = rpcErr.message?.split(':')[0]?.trim() ?? rpcErr.message ?? 'error'
      setError(rpcErr.message ?? 'Unknown error')
      toast.push({ kind: 'warn', title: 'Could not change status', body: head })
      return
    }
    toast.push({ kind: to === 'delivered' ? 'success' : 'info', title: `${order.order_number} → ${to.replace(/_/g, ' ')}` })
    await fetchAll()
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-brown" size={40} /></div>
  }
  if (!order) {
    return (
      <div className="space-y-6">
        <button onClick={() => router.push('/admin/orders')} className="ff-apfel text-sm text-white/50 hover:text-white flex items-center gap-2"><ArrowLeft size={14} /> Back to orders</button>
        <p className="ff-accia text-2xl text-primary-brown">Order not found.</p>
      </div>
    )
  }

  const addr = order.delivery_address_snapshot ?? {}

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <button onClick={() => router.push('/admin/orders')} className="ff-apfel text-sm text-white/50 hover:text-white flex items-center gap-2 mb-3"><ArrowLeft size={14} /> Back to orders</button>
          <p className="admin-pill mb-3 inline-flex rounded-full px-3 py-1 ff-apfel text-[11px] uppercase tracking-[0.16em]">Order detail</p>
          <h1 className="text-3xl font-bold ff-accia text-primary-brown">Order {order.order_number}</h1>
          <p className="text-white/40 ff-apfel text-xs mt-1 font-mono">{order.id}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-full ff-apfel text-sm capitalize ${statusBadgeColor(order.status)}`}>
          {statusIcon(order.status)}
          {order.status.replace(/_/g, ' ')}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 ff-apfel text-sm flex items-start gap-3">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="opacity-60 hover:opacity-100"><XCircle size={14} /></button>
        </div>
      )}

      {/* Status transitions row */}
      <div className="admin-card rounded-2xl p-6 space-y-3">
        <p className="ff-apfel text-xs uppercase tracking-widest text-white/30">Transition status</p>
        {allowedNextStatuses.length === 0 ? (
          <p className="ff-apfel text-sm text-white/40">Terminal state — no further transitions allowed.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allowedNextStatuses.map((next) => (
              <button
                key={next}
                disabled={busy}
                onClick={() => doTransition(next)}
                className={`px-4 py-2 rounded-full ff-apfel text-sm capitalize transition-all border ${
                  next === 'cancelled' || next === 'failed_delivery'
                    ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                    : next === 'delivered'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                      : 'bg-primary-brown/20 border-primary-brown/40 text-primary-brown hover:bg-primary-brown/30'
                } disabled:opacity-50`}
              >
                {busy ? <Loader2 size={14} className="animate-spin inline" /> : `→ ${next.replace(/_/g, ' ')}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer + address column */}
        <div className="space-y-6 lg:col-span-1">
          <Panel title="Customer">
            <Row icon={<User size={14} />} label="Name" value={order.customer_name} />
            <Row icon={<Mail size={14} />} label="Email" value={order.customer_email} />
            <Row icon={<Phone size={14} />} label="Phone" value={order.customer_phone || '—'} />
            <Row icon={<Gift size={14} />} label="Gift?" value={order.is_gift ? 'Yes — hide prices on receipt' : 'No'} />
          </Panel>

          <Panel title="Delivery">
            <div className="flex items-start gap-2 text-white/80 ff-apfel text-sm leading-relaxed">
              <MapPin size={14} className="shrink-0 mt-1 text-primary-brown" />
              <div>
                {addr.recipient_name && <p className="font-bold">{addr.recipient_name}</p>}
                {addr.line1 && <p>{addr.line1}</p>}
                {addr.line2 && <p>{addr.line2}</p>}
                {(addr.area || addr.city) && <p>{[addr.area, addr.city].filter(Boolean).join(', ')}</p>}
                {addr.postal_code && <p>{addr.postal_code}</p>}
                {addr.instructions && <p className="mt-2 text-white/50 italic">&quot;{addr.instructions}&quot;</p>}
                {!addr.line1 && !addr.recipient_name && <p className="text-white/40 italic">No address snapshot on this order.</p>}
              </div>
            </div>
            {order.delivery_slot_date && (
              <p className="ff-apfel text-xs text-white/40 mt-3">Slot: {order.delivery_slot_date} {order.delivery_slot_window ?? ''}</p>
            )}
          </Panel>

          <Panel title="Payment">
            <Row icon={<Banknote size={14} />} label="Method" value="Cash on Delivery" />
            <Row icon={<Banknote size={14} />} label="Status" value={order.payment_status.replace(/_/g, ' ')} />
            {payment && (
              <>
                <Row label="Provider record" value={`${payment.provider} / ${payment.status}`} />
                {payment.collected_at && (
                  <Row label="Collected" value={`${formatPkr(payment.collected_amount_minor ?? 0)} at ${new Date(payment.collected_at).toLocaleString()}`} />
                )}
              </>
            )}
          </Panel>
        </div>

        {/* Items + totals + timeline column */}
        <div className="space-y-6 lg:col-span-2">
          <Panel title={`Items (${order.order_items.length})`}>
            <div className="divide-y divide-white/5">
              {order.order_items.map((item) => (
                <div key={item.id} className="py-3 flex items-start gap-4">
                  {item.image_storage_path_snapshot && (
                    <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                      <Image src={item.image_storage_path_snapshot} alt="" fill sizes="56px" className="object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="ff-accia text-white">{item.product_name_snapshot}</p>
                      {item.is_custom && <span className="text-[9px] uppercase tracking-widest bg-primary-brown/30 text-primary-brown px-1.5 py-0.5 rounded">custom</span>}
                      {item.is_perishable_snapshot && <span className="text-[9px] uppercase tracking-widest bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded">perishable</span>}
                    </div>
                    {item.variation_label_snapshot && <p className="text-xs text-white/40 ff-apfel">{item.variation_label_snapshot}</p>}
                    {item.customer_notes && <p className="text-xs text-white/50 ff-apfel mt-1 italic">&quot;{item.customer_notes}&quot;</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="ff-apfel text-sm text-white">{item.quantity} × {formatPkr(item.unit_price_minor_snapshot)}</p>
                    <p className="ff-accia text-primary-brown">{formatPkr(item.line_total_minor_snapshot)}</p>
                  </div>
                </div>
              ))}
              {order.order_items.length === 0 && (
                <p className="py-6 text-center text-amber-300 ff-apfel text-sm">
                  This order has no items — likely a legacy row from before Phase 1&apos;s
                  transactional create_order RPC.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Money">
            <MoneyRow label="Subtotal" minor={order.subtotal_minor} />
            {order.discount_minor > 0 && <MoneyRow label={order.coupon_code ? `Discount (${order.coupon_code})` : 'Discount'} minor={-order.discount_minor} accent="text-emerald-300" />}
            {order.tax_minor > 0 && <MoneyRow label="Tax" minor={order.tax_minor} />}
            <MoneyRow label="Delivery" minor={order.delivery_fee_minor} />
            <div className="border-t border-white/10 mt-2 pt-2">
              <MoneyRow label="Grand total" minor={order.total_minor} bold />
            </div>
          </Panel>

          <Panel title={<span className="flex items-center gap-2"><History size={16} /> Timeline</span>}>
            <ol className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusBadgeColor(h.to_status)}`}>{h.to_status.replace(/_/g, ' ')}</div>
                  <div className="flex-1 min-w-0">
                    <p className="ff-apfel text-xs text-white/60">
                      {h.from_status ? `from ${h.from_status.replace(/_/g, ' ')}` : 'order created'}
                      {h.actor_role ? ` · by ${h.actor_role}` : ''}
                    </p>
                    {h.reason && <p className="ff-apfel text-xs text-white/40 italic mt-0.5">{h.reason}</p>}
                  </div>
                  <p className="ff-apfel text-xs text-white/30 shrink-0">{new Date(h.created_at).toLocaleString()}</p>
                </li>
              ))}
              {history.length === 0 && (
                <p className="text-white/40 ff-apfel text-sm italic">No timeline entries yet.</p>
              )}
            </ol>
            {order.status === 'cancelled' && order.order_items.some((i) => !i.is_perishable_snapshot) && (
              <p className="mt-4 ff-apfel text-xs text-emerald-300 flex items-center gap-2"><RotateCcw size={12} /> Non-perishable items were restocked automatically by the cancel RPC.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="admin-card rounded-2xl p-6 space-y-3">
      <p className="ff-apfel text-xs uppercase tracking-widest text-white/30">{title}</p>
      <div>{children}</div>
    </div>
  )
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="text-primary-brown shrink-0">{icon}</div>
      <span className="ff-apfel text-xs text-white/40 w-20">{label}</span>
      <span className="ff-apfel text-sm text-white truncate">{value}</span>
    </div>
  )
}

function MoneyRow({ label, minor, accent, bold }: { label: string; minor: number; accent?: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? 'ff-accia text-base' : 'ff-apfel text-sm'} ${accent ?? 'text-white/80'}`}>
      <span>{label}</span>
      <span className={accent}>{minor < 0 ? '−' : ''}{formatPkr(Math.abs(minor))}</span>
    </div>
  )
}
