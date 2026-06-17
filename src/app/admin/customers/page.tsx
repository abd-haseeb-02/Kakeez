"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Users, Mail, Phone, Calendar, Loader2, ArrowUpRight } from "lucide-react"

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    // Derive customers from the orders table, aggregating real order count + spend.
    const { data } = await supabase
      .from('orders')
      .select('customer_name, customer_email, total_amount, created_at')
      .order('created_at', { ascending: false })

    if (data) {
      const byEmail = new Map<string, any>()
      for (const order of data) {
        const key = order.customer_email
        const existing = byEmail.get(key)
        if (existing) {
          existing.orderCount += 1
          existing.totalSpent += Number(order.total_amount) || 0
          // keep the earliest order date as the "joined" date
          if (new Date(order.created_at) < new Date(existing.created_at)) {
            existing.created_at = order.created_at
          }
        } else {
          byEmail.set(key, {
            customer_name: order.customer_name,
            customer_email: order.customer_email,
            created_at: order.created_at,
            orderCount: 1,
            totalSpent: Number(order.total_amount) || 0,
          })
        }
      }
      setCustomers(Array.from(byEmail.values()))
    }
    setLoading(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="admin-pill mb-3 inline-flex rounded-full px-3 py-1 ff-apfel text-[11px] uppercase tracking-[0.16em]">Customer intelligence</p>
        <h1 className="text-3xl font-bold ff-accia text-primary-brown">Customers</h1>
        <p className="text-white/50 ff-apfel mt-1">Manage your bakery's growing community.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary-brown" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((customer, idx) => (
            <div key={idx} className="admin-card p-6 rounded-3xl transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-2xl bg-primary-brown/10 flex items-center justify-center text-primary-brown font-bold text-xl ff-accia">
                  {customer.customer_name?.[0]?.toUpperCase() || "?"}
                </div>
                <button className="p-2 bg-white/5 rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                  <ArrowUpRight size={18} />
                </button>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl font-bold ff-accia">{customer.customer_name}</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-white/50 text-sm ff-apfel">
                    <Mail size={14} />
                    {customer.customer_email}
                  </div>
                  <div className="flex items-center gap-3 text-white/50 text-sm ff-apfel">
                    <Calendar size={14} />
                    Joined {new Date(customer.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex gap-4">
                 <div className="flex-1">
                   <p className="text-[10px] uppercase tracking-widest text-white/30 ff-apfel mb-1">Total Orders</p>
                   <p className="font-bold ff-accia">{customer.orderCount}</p>
                 </div>
                 <div className="flex-1 text-right">
                   <p className="text-[10px] uppercase tracking-widest text-white/30 ff-apfel mb-1">Spent</p>
                   <p className="font-bold ff-accia text-primary-brown">Rs. {customer.totalSpent.toLocaleString()}</p>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
