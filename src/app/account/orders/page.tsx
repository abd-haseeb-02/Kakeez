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
      <div className="rounded-[16px] border border-primary-brown/10 bg-accent-green/45 p-8 text-center">
        <p className="ff-accia text-[clamp(24px,2.3vw,34px)] leading-none text-primary-brown">No orders yet.</p>
        <p className="ff-colville-light mt-2 text-[15px] text-primary-brown/65">When you place your first order it&apos;ll appear here.</p>
        <Link href="/" className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary-brown px-5 ff-accia text-[17px] text-white transition-colors hover:bg-primary-brown/90">
          Browse the menu <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="mb-3 ff-accia text-[clamp(32px,3vw,48px)] leading-none text-primary-brown">Your orders</h2>
      {orders.map((o) => (
        <Link
          key={o.id}
          href={`/account/orders/${o.id}`}
          className="block rounded-[16px] border border-primary-brown/10 bg-white/75 p-5 shadow-sm transition-all hover:border-primary-brown/35 hover:bg-white"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="ff-accia text-[24px] leading-none text-primary-brown">{o.order_number}</p>
              <p className="mt-1 ff-colville-light text-sm text-primary-brown/55">{new Date(o.created_at).toLocaleString()}</p>
              <p className="mt-2 line-clamp-2 ff-colville-light text-sm text-primary-brown/65">
                {o.order_items && o.order_items.length > 0
                  ? o.order_items.map((it) => `${it.quantity}× ${it.product_name_snapshot}`).join(' · ')
                  : 'No items.'}
              </p>
            </div>
            <div className="shrink-0 space-y-1 text-right">
              <span className={`inline-block ff-apfel text-xs px-2.5 py-1 rounded-full capitalize ${statusColor(o.status)}`}>
                {o.status.replace(/_/g, ' ')}
              </span>
              <p className="ff-accia text-[22px] leading-none text-primary-brown">{formatPkr(o.total_minor)}</p>
              <p className="ff-colville-light text-xs capitalize text-primary-brown/55">{o.payment_status}</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
