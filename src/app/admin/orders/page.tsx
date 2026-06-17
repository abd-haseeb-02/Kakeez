"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import { formatPkr } from "@/lib/money"
import { Loader2, CheckCircle, Clock, Truck, XCircle, ExternalLink } from "lucide-react"

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const toast = useToast()

  useEffect(() => {
    fetchOrders()

    // Phase 3: orders list now subscribes to realtime INSERT + UPDATE so
    // status changes from elsewhere (rider RPCs, customer cancel, other
    // admin tabs) reflect live without a refresh. The dashboard also
    // subscribes; that's fine — two subscriptions, one shared topic.
    const channel = supabase
      .channel('admin-orders-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const o = payload.new as any
        setOrders((prev) => [{ ...o, total_amount: (o.total_minor ?? 0) / 100, order_items: [] }, ...prev])
        toast.push({
          kind: 'info',
          title: `New order ${o.order_number ?? '#' + o.id?.slice(0, 8)}`,
          body: `${formatPkr(o.total_minor ?? 0)} — ${o.customer_name ?? 'customer'}`,
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const next = payload.new as any
        const prev = payload.old as any
        setOrders((cur) => cur.map((o) => o.id === next.id ? { ...o, ...next, total_amount: (next.total_minor ?? 0) / 100 } : o))
        if (prev?.status !== next?.status) {
          toast.push({
            kind: next.status === 'delivered' ? 'success' : next.status === 'cancelled' || next.status === 'failed_delivery' ? 'warn' : 'info',
            title: `Order ${next.order_number ?? '#' + next.id.slice(0, 8)}`,
            body: `${prev?.status ?? '—'} → ${next?.status}`,
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // toast.push and router are stable refs from their providers; safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    // New schema: order_items now carries an immutable product_name_snapshot
    // taken at checkout, so we don't have to join back to products at all.
    // total_amount → total_minor (integer paisa); divide by 100 for display.
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(id, product_name_snapshot, quantity, unit_price_minor_snapshot)')
      .order('created_at', { ascending: false })
    if (data) {
      setOrders(
        (data as any[]).map((o) => ({
          ...o,
          total_amount: (o.total_minor ?? 0) / 100,
        }))
      )
    }
    setLoading(false)
  }

  const updateStatus = async (orderId: string, newStatus: string) => {
    // Phase 3: direct UPDATE on orders is REVOKE'd from authenticated. Status
    // changes now go through update_order_status RPC which validates the
    // transition against order_status_transitions and writes an audit row.
    const { error } = await supabase.rpc('update_order_status', {
      p_order_id: orderId,
      p_to_status: newStatus,
      p_reason: null,
    })
    if (error) {
      const code = error.message?.split(':')[0]?.trim() ?? error.message
      toast.push({
        kind: 'warn',
        title: 'Could not change status',
        body: code === 'invalid_transition' ? 'That status change is not allowed from the current state.' : (error.message ?? 'Unknown error'),
      })
      return
    }
    // The optimistic local update will be confirmed by the realtime UPDATE
    // handler above (the same channel sees our own write), but applying it
    // immediately keeps the dropdown snappy.
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o))
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'pending_confirmation': return <Clock size={16} className="text-blue-400" />
      case 'confirmed':            return <Clock size={16} className="text-blue-500" />
      case 'preparing':            return <Loader2 size={16} className="text-orange-400 animate-spin" />
      case 'ready_for_dispatch':   return <Truck size={16} className="text-orange-300" />
      case 'out_for_delivery':     return <Truck size={16} className="text-blue-400" />
      case 'delivered':            return <CheckCircle size={16} className="text-green-400" />
      case 'failed_delivery':      return <XCircle size={16} className="text-amber-400" />
      case 'cancelled':            return <XCircle size={16} className="text-red-400" />
      case 'disputed':             return <XCircle size={16} className="text-purple-400" />
      default: return <Clock size={16} />
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="admin-pill mb-3 inline-flex rounded-full px-3 py-1 ff-apfel text-[11px] uppercase tracking-[0.16em]">Kitchen queue</p>
        <h1 className="text-3xl font-bold ff-accia text-primary-brown">Order Management</h1>
        <p className="text-white/50 ff-apfel mt-1">Track and fulfill your bakery orders in real-time.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary-brown" size={40} />
        </div>
      ) : (
        <div className="admin-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-white/30 text-xs uppercase tracking-wider ff-apfel border-b border-white/5">
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Items</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-all cursor-pointer" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                    <td className="px-6 py-4 ff-apfel text-primary-brown">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{order.order_number ?? order.id?.slice(0, 8)}</span>
                        <ExternalLink size={12} className="text-white/30" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="ff-apfel">{order.customer_name}</div>
                      <div className="text-xs text-white/30">{order.customer_email}</div>
                    </td>
                    <td className="px-6 py-4 ff-apfel">
                      {order.order_items?.length || 0} items
                    </td>
                    <td className="px-6 py-4 ff-apfel text-green-400">{formatPkr((order.total_minor ?? order.total_amount * 100) ?? 0)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(order.status)}
                        <span className="capitalize text-sm ff-apfel">{order.status.replace(/_/g, ' ')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={order.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); updateStatus(order.id, e.target.value) }}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary-brown transition-all"
                      >
                        <option value="pending_confirmation">Pending Confirmation</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready_for_dispatch">Ready for Dispatch</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="delivered">Delivered</option>
                        <option value="failed_delivery">Failed Delivery</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="disputed">Disputed</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
