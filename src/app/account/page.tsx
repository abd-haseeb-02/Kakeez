"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { formatPkr } from "@/lib/money"
import { ArrowRight, Loader2, ShoppingBag, MapPin, Clock } from "lucide-react"

interface OrderRow {
  id: string
  order_number: string
  status: string
  total_minor: number
  created_at: string
  order_items?: { id: string }[]
}

export default function AccountDashboard() {
  const [recent, setRecent] = useState<OrderRow[]>([])
  const [addressCount, setAddressCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [oRes, aRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, total_minor, created_at, order_items(id)')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('addresses')
          .select('id', { count: 'exact', head: true }),
      ])
      setRecent((oRes.data as OrderRow[]) ?? [])
      setAddressCount(aRes.count ?? 0)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-brown" size={28} /></div>
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard icon={<ShoppingBag size={18} />} label="Orders" value={recent.length === 0 ? '0' : `${recent.length}+`} href="/account/orders" />
        <SummaryCard icon={<MapPin size={18} />} label="Saved addresses" value={String(addressCount)} href="/account/addresses" />
        <SummaryCard icon={<Clock size={18} />} label="Last order" value={recent[0] ? new Date(recent[0].created_at).toLocaleDateString() : 'None yet'} href="/account/orders" />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="ff-accia text-[clamp(22px,1.6vw,28px)] text-primary-brown">Recent orders</h2>
          <Link href="/account/orders" className="ff-apfel text-sm text-primary-brown underline-offset-4 underline">View all</Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-2xl border border-primary-brown/15 bg-accent-green/30 p-8 text-center">
            <p className="ff-accia text-[clamp(18px,1.3vw,22px)] text-primary-brown">No orders yet.</p>
            <p className="ff-accia-light text-sm text-black/60 mt-2">When you place your first order, it&apos;ll show up here.</p>
            <Link href="/" className="inline-flex items-center gap-2 mt-4 bg-primary-brown text-white px-5 py-2.5 rounded-lg ff-apfel hover:bg-primary-brown/90 transition-all">
              Browse the menu <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/account/orders/${o.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-primary-brown/15 bg-white px-4 py-3 hover:border-primary-brown/40 transition-all"
              >
                <div className="min-w-0">
                  <p className="ff-accia text-primary-brown">{o.order_number}</p>
                  <p className="ff-apfel text-xs text-black/40">{new Date(o.created_at).toLocaleDateString()} · {o.order_items?.length ?? 0} item(s)</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="ff-apfel text-sm text-black capitalize">{o.status.replace(/_/g, ' ')}</span>
                  <span className="ff-accia text-primary-brown">{formatPkr(o.total_minor)}</span>
                  <ArrowRight size={14} className="text-primary-brown/60" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-primary-brown/15 bg-white p-5 hover:border-primary-brown/40 transition-all">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 rounded-full bg-accent-green/40 flex items-center justify-center text-primary-brown">{icon}</div>
        <ArrowRight size={14} className="text-primary-brown/40" />
      </div>
      <p className="ff-apfel text-xs uppercase tracking-widest text-black/40 mt-4">{label}</p>
      <p className="ff-accia text-[clamp(22px,1.7vw,28px)] text-primary-brown mt-1">{value}</p>
    </Link>
  )
}
