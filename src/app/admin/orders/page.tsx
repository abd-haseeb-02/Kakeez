"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ShoppingBag, Search, Filter, Loader2, CheckCircle, Clock, Truck, XCircle } from "lucide-react"

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name))')
      .order('created_at', { ascending: false })
    if (data) setOrders(data)
    setLoading(false)
  }

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
    
    if (!error) {
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    }
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'pending': return <Clock size={16} className="text-blue-400" />
      case 'baking': return <Loader2 size={16} className="text-orange-400 animate-spin" />
      case 'delivered': return <CheckCircle size={16} className="text-green-400" />
      case 'cancelled': return <XCircle size={16} className="text-red-400" />
      default: return <Clock size={16} />
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold ff-accia text-primary-brown">Order Management</h1>
        <p className="text-white/50 ff-apfel mt-1">Track and fulfill your bakery orders in real-time.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary-brown" size={40} />
        </div>
      ) : (
        <div className="bg-[#121212] border border-white/5 rounded-2xl overflow-hidden">
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
                  <tr key={order.id} className="hover:bg-white/5 transition-all">
                    <td className="px-6 py-4 ff-apfel text-primary-brown truncate max-w-[100px]">{order.id}</td>
                    <td className="px-6 py-4">
                      <div className="ff-apfel">{order.customer_name}</div>
                      <div className="text-xs text-white/30">{order.customer_email}</div>
                    </td>
                    <td className="px-6 py-4 ff-apfel">
                      {order.order_items?.length || 0} items
                    </td>
                    <td className="px-6 py-4 ff-apfel text-green-400">Rs. {order.total_amount}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(order.status)}
                        <span className="capitalize text-sm ff-apfel">{order.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs outline-none focus:border-primary-brown transition-all"
                      >
                        <option value="pending">Pending</option>
                        <option value="baking">Baking</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
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
