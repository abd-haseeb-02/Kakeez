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
          .from("orders")
          .select("id, order_number, status, total_minor, created_at, order_items(id)")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("addresses")
          .select("id", { count: "exact", head: true }),
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
        <SummaryCard icon={<ShoppingBag size={18} />} label="Orders" value={recent.length === 0 ? "0" : `${recent.length}+`} href="/account/orders" />
        <SummaryCard icon={<MapPin size={18} />} label="Saved addresses" value={String(addressCount)} href="/account/addresses" />
        <SummaryCard icon={<Clock size={18} />} label="Last order" value={recent[0] ? new Date(recent[0].created_at).toLocaleDateString() : "None yet"} href="/account/orders" />
      </div>

      <div>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="ff-accia text-[clamp(32px,3vw,48px)] leading-none text-primary-brown">Recent orders</h2>
          <Link href="/account/orders" className="ff-apfel text-sm text-primary-brown underline underline-offset-4">View all</Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-[16px] border border-primary-brown/10 bg-accent-green/45 p-8 text-center">
            <p className="ff-accia text-[clamp(24px,2.3vw,34px)] leading-none text-primary-brown">No orders yet.</p>
            <p className="ff-colville-light mt-2 text-[15px] text-primary-brown/65">When you place your first order, it&apos;ll show up here.</p>
            <Link href="/" className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary-brown px-5 ff-accia text-[17px] text-white transition-colors hover:bg-primary-brown/90">
              Browse the menu <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/account/orders/${o.id}`}
                className="flex items-center justify-between gap-4 rounded-[14px] border border-primary-brown/10 bg-white/75 px-4 py-3 transition-all hover:border-primary-brown/35 hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="ff-accia text-[20px] leading-tight text-primary-brown">{o.order_number}</p>
                  <p className="ff-colville-light text-sm text-primary-brown/55">{new Date(o.created_at).toLocaleDateString()} · {o.order_items?.length ?? 0} item(s)</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="ff-colville text-sm capitalize text-primary-brown/70">{o.status.replace(/_/g, " ")}</span>
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
    <Link href={href} className="rounded-[16px] border border-primary-brown/10 bg-white/75 p-5 shadow-sm transition-all hover:border-primary-brown/35 hover:bg-white">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-green text-primary-brown">{icon}</div>
        <ArrowRight size={14} className="text-primary-brown/40" />
      </div>
      <p className="ff-colville mt-4 text-[13px] uppercase tracking-[0.12em] text-primary-brown/55">{label}</p>
      <p className="ff-accia mt-1 text-[clamp(26px,2.4vw,36px)] leading-none text-primary-brown">{value}</p>
    </Link>
  )
}
