"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { formatPkr } from "@/lib/money"
import { ArrowRight, Loader2 } from "lucide-react"

interface OrderRow {
  id: string
  order_number: string
  status: string
  payment_status: string
  total_minor: number
  created_at: string
  order_items?: { id: string; product_name_snapshot: string; quantity: number }[]
}

function statusColor(s: string): string {
  switch (s) {
    case 'delivered':       return 'text-emerald-600 bg-emerald-100'
    case 'cancelled':       return 'text-red-600 bg-red-100'
    case 'failed_delivery': return 'text-amber-700 bg-amber-100'
    case 'disputed':        return 'text-purple-700 bg-purple-100'
    case 'out_for_delivery':return 'text-blue-700 bg-blue-100'
    default:                return 'text-primary-brown bg-accent-green/40'
  }
}

export default function OrdersHistory() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, payment_status, total_minor, created_at, order_items(id, product_name_snapshot, quantity)')
        .order('created_at', { ascending: false })
      setOrders((data as OrderRow[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-brown" size={28} /></div>
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-primary-brown/15 bg-accent-green/30 p-8 text-center">
        <p className="ff-accia text-[clamp(20px,1.4vw,26px)] text-primary-brown">No orders yet.</p>
        <p className="ff-accia-light text-sm text-black/60 mt-2">When you place your first order it&apos;ll appear here.</p>
        <Link href="/" className="inline-flex items-center gap-2 mt-4 bg-primary-brown text-white px-5 py-2.5 rounded-lg ff-apfel hover:bg-primary-brown/90 transition-all">
          Browse the menu <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="ff-accia text-[clamp(22px,1.6vw,28px)] text-primary-brown mb-2">Your orders</h2>
      {orders.map((o) => (
        <Link
          key={o.id}
          href={`/account/orders/${o.id}`}
          className="block rounded-2xl border border-primary-brown/15 bg-white p-5 hover:border-primary-brown/40 transition-all"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="ff-accia text-primary-brown text-lg">{o.order_number}</p>
              <p className="ff-apfel text-xs text-black/40">{new Date(o.created_at).toLocaleString()}</p>
              <p className="ff-accia-light text-sm text-black/70 mt-2 line-clamp-2">
                {o.order_items && o.order_items.length > 0
                  ? o.order_items.map((it) => `${it.quantity}× ${it.product_name_snapshot}`).join(' · ')
                  : 'No items.'}
              </p>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <span className={`inline-block ff-apfel text-xs px-2.5 py-1 rounded-full capitalize ${statusColor(o.status)}`}>
                {o.status.replace(/_/g, ' ')}
              </span>
              <p className="ff-accia text-primary-brown text-lg">{formatPkr(o.total_minor)}</p>
              <p className="ff-apfel text-xs text-black/40 capitalize">{o.payment_status}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
