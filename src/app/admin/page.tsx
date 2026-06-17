"use client"

import {
  TrendingUp,
  Users,
  ShoppingBag,
  DollarSign,
  ArrowUpRight,
  Clock,
} from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import { formatPkr } from "@/lib/money"

export default function AdminDashboard() {
  const [liveOrders, setLiveOrders] = useState<any[]>([])
  const toast = useToast()
  const [stats, setStats] = useState([
    { label: "Total Revenue", value: "Rs. 0", icon: DollarSign, trend: "Live", color: "text-green-400" },
    { label: "Active Orders", value: "0", icon: ShoppingBag, trend: "Live", color: "text-blue-400" },
    { label: "Total Customers", value: "0", icon: Users, trend: "Live", color: "text-purple-400" },
    { label: "Total Products", value: "0", icon: TrendingUp, trend: "Live", color: "text-orange-400" },
  ])

  useEffect(() => {
    fetchDashboardData()

    // Subscribe to Realtime changes
    const channel = supabase
      .channel('realtime-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          // Project the realtime payload to the legacy render shape.
          const projected = {
            ...(payload.new as any),
            total_amount: ((payload.new as any).total_minor ?? 0) / 100,
          }
          setLiveOrders(prev => [projected, ...prev].slice(0, 10))
          toast.push({
            kind: 'info',
            title: `New order ${projected.order_number ?? '#' + projected.id?.slice(0, 8)}`,
            body: `${formatPkr(projected.total_minor ?? 0)} — ${projected.customer_name ?? 'customer'}`,
          })
          fetchDashboardData() // Refresh stats on new order
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchDashboardData = async () => {
    const [ordersRes, productsRes] = await Promise.all([
      supabase.from('orders').select('*, order_items(id)').order('created_at', { ascending: false }),
      supabase.from('products').select('id', { count: 'exact' })
    ])

    if (ordersRes.data) {
      // New schema: total_minor (paisa, integer). Project to total_amount
      // (rupees, number) so the existing render code stays the same.
      const orders = (ordersRes.data as any[]).map((o) => ({
        ...o,
        total_amount: (o.total_minor ?? 0) / 100,
      }))
      setLiveOrders(orders.slice(0, 10))

      const totalRevenue = orders.reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0)
      const uniqueCustomers = new Set(orders.map(o => o.customer_email)).size

      setStats([
        { label: "Total Revenue", value: `Rs. ${totalRevenue.toLocaleString()}`, icon: DollarSign, trend: "Live", color: "text-green-400" },
        { label: "Active Orders", value: orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').length.toString(), icon: ShoppingBag, trend: "Live", color: "text-blue-400" },
        { label: "Total Customers", value: uniqueCustomers.toString(), icon: Users, trend: "Live", color: "text-purple-400" },
        { label: "Total Products", value: productsRes.count?.toString() || "0", icon: TrendingUp, trend: "Live", color: "text-orange-400" },
      ])
    }
  }

  return (
    <div className="space-y-8 relative">
      {/* Page Header — new-order banner moved to the global ToastProvider so
          both the dashboard and the orders list now share the same UX. */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold ff-accia text-primary-brown">Overview</h1>
          <p className="text-white/50 ff-apfel mt-1">Welcome back, Admin! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-400 bg-green-400/10 px-3 py-2 rounded-full ff-apfel">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          System Live
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-[#121212] border border-white/5 p-6 rounded-2xl hover:border-primary-brown/30 transition-all">
            <div className="flex justify-between items-start">
              <div className={`p-3 bg-white/5 rounded-xl ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <span className="text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-full ff-apfel">
                {stat.trend}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-white/50 text-sm ff-apfel">{stat.label}</p>
              <h3 className="text-2xl font-bold mt-1 ff-accia">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders Section */}
      <div className="bg-[#121212] border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-xl font-bold ff-accia flex items-center gap-2">
            <Clock className="text-primary-brown" size={20} />
            Recent Orders
          </h2>
          <button className="text-sm text-primary-brown hover:underline ff-apfel flex items-center gap-1">
            View All <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider ff-apfel border-b border-white/5">
                <th className="px-6 py-4 font-medium">Order ID</th>
                <th className="px-6 py-4 font-medium">Customer</th>
                <th className="px-6 py-4 font-medium">Items</th>
                <th className="px-6 py-4 font-medium">Total</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {liveOrders.map((order) => (
                <tr key={order.id} className="hover:bg-white/5 transition-all">
                  <td className="px-6 py-4 font-medium ff-apfel text-primary-brown truncate max-w-[100px]">{order.id}</td>
                  <td className="px-6 py-4 ff-apfel">{order.customer_name}</td>
                  <td className="px-6 py-4 ff-apfel">{order.order_items?.length ?? 0}</td>
                  <td className="px-6 py-4 ff-apfel">Rs. {order.total_amount}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ff-apfel
                      ${order.status === 'baking' ? 'bg-orange-500/10 text-orange-400' :
                        order.status === 'pending' ? 'bg-blue-500/10 text-blue-400' :
                        order.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                        'bg-green-500/10 text-green-400'}
                    `}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white/50 text-sm ff-apfel">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
