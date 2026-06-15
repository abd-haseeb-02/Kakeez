"use client"

import { useState, useEffect } from "react"
import { useCart } from "@/store/useCart"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Navbar from "@/components/shop/Navbar"
import { Loader2, CheckCircle, ArrowRight, ShieldCheck, Truck } from "lucide-react"

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        // Must be logged in to access checkout
        router.push('/')
      } else {
        setUser(session.user)
      }
      setAuthChecking(false)
    }
    checkAuth()
  }, [router])

  const handlePlaceOrder = async () => {
    if (!user) return
    setLoading(true)

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
        customer_email: user.email,
        total_amount: totalPrice(),
        status: 'pending'
      }])
      .select()

    if (orderError) {
      console.error(orderError)
      setLoading(false)
      return
    }

    const orderId = orderData[0].id

    try {
      const orderItems = items.map(item => ({
        order_id: orderId,
        product_id: item.id.length > 30 ? item.id : null,
        quantity: item.quantity,
        unit_price: item.price
      })).filter(item => item.product_id !== null)

      if (orderItems.length > 0) {
        await supabase.from('order_items').insert(orderItems)
      }
    } catch (e) {
      console.warn("Could not insert order items, product IDs might be mock IDs.")
    }

    clearCart()
    setLoading(false)
    setSuccess(true)
  }

  if (authChecking) {
    return <div className="min-h-screen bg-[#f8f5f0] flex items-center justify-center"><Loader2 className="animate-spin text-primary-brown" size={40} /></div>
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#f8f5f0] flex flex-col items-center justify-center space-y-[2vw]">
        <div className="w-[10vw] h-[10vw] bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle size={80} className="text-green-500" />
        </div>
        <h1 className="ff-accia text-[4vw] text-primary-brown">Order Confirmed!</h1>
        <p className="ff-colville text-[1.5vw] text-primary-brown/60">Thank you for your purchase. We are preparing your order.</p>
        <button 
          onClick={() => router.push('/')}
          className="mt-[2vw] bg-primary-brown text-white px-[4vw] py-[1.5vw] rounded-[1vw] ff-accia text-[1.5vw] hover:bg-primary-brown/90 transition-all"
        >
          Continue Shopping
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[#f8f5f0] min-h-screen relative overflow-hidden flex flex-col">
      <div className="relative w-full h-[15vw] bg-accent-green/30">
         <Navbar />
      </div>

      <div className="max-w-[70vw] mx-auto mt-[5vw] mb-[10vw] w-full">
        <h1 className="ff-accia text-[3.5vw] text-primary-brown mb-[3vw]">Secure Checkout</h1>

        <div className="flex gap-[4vw]">
          {/* Form Side */}
          <div className="flex-1 space-y-[3vw]">
            <div className="bg-white p-[3vw] rounded-[1.5vw] shadow-sm border border-primary-brown/10 space-y-[2vw]">
              <div className="flex items-center gap-[1vw] text-primary-brown border-b border-primary-brown/10 pb-[1vw]">
                <Truck size={24} />
                <h2 className="ff-accia text-[2vw]">Delivery Details</h2>
              </div>
              
              <div className="space-y-[1.5vw]">
                <div className="space-y-[0.5vw]">
                  <label className="ff-apfel text-[1vw] text-primary-brown/60">Full Name</label>
                  <input 
                    readOnly
                    value={user?.user_metadata?.full_name || ""}
                    className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-[0.8vw] px-[1.5vw] py-[1vw] outline-none text-primary-brown ff-apfel text-[1vw]"
                  />
                </div>
                <div className="space-y-[0.5vw]">
                  <label className="ff-apfel text-[1vw] text-primary-brown/60">Email Address</label>
                  <input 
                    readOnly
                    value={user?.email || ""}
                    className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-[0.8vw] px-[1.5vw] py-[1vw] outline-none text-primary-brown ff-apfel text-[1vw]"
                  />
                </div>
                <div className="space-y-[0.5vw]">
                  <label className="ff-apfel text-[1vw] text-primary-brown/60">Delivery Address</label>
                  <textarea 
                    readOnly
                    value={user?.user_metadata?.address || "Address not provided during signup."}
                    className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-[0.8vw] px-[1.5vw] py-[1vw] outline-none text-primary-brown ff-apfel text-[1vw] h-[6vw] resize-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-white p-[2vw] rounded-[1.5vw] shadow-sm border border-primary-brown/10 flex items-center justify-between text-primary-brown">
               <div className="flex items-center gap-[1vw]">
                 <ShieldCheck size={28} className="text-green-600" />
                 <span className="ff-apfel text-[1.2vw] font-bold">Secure Payment via Cash on Delivery</span>
               </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="w-[25vw] bg-white p-[3vw] rounded-[1.5vw] shadow-sm border border-primary-brown/10 h-fit space-y-[2vw]">
            <h2 className="ff-accia text-[2vw] text-primary-brown border-b border-primary-brown/10 pb-[1vw]">Summary</h2>
            
            <div className="space-y-[1vw] max-h-[20vw] overflow-y-auto pr-[1vw]">
              {items.map(item => (
                <div key={item.id} className="flex justify-between items-center text-primary-brown">
                  <div className="ff-apfel text-[1vw] w-[12vw] truncate">
                    {item.quantity}x {item.name}
                  </div>
                  <div className="ff-colville text-[1vw]">Rs. {item.price * item.quantity}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-primary-brown/10 pt-[2vw] space-y-[1vw]">
              <div className="flex justify-between items-center text-primary-brown/60">
                <span className="ff-colville text-[1.2vw]">Subtotal</span>
                <span className="ff-colville text-[1.2vw]">Rs. {totalPrice()}</span>
              </div>
              <div className="flex justify-between items-center text-primary-brown/60">
                <span className="ff-colville text-[1.2vw]">Delivery</span>
                <span className="ff-colville text-[1.2vw]">Free</span>
              </div>
              <div className="flex justify-between items-center text-primary-brown font-bold mt-[1vw]">
                <span className="ff-accia text-[1.8vw]">Total</span>
                <span className="ff-accia text-[1.8vw]">Rs. {totalPrice()}</span>
              </div>
            </div>

            <button 
              onClick={handlePlaceOrder}
              disabled={loading || items.length === 0}
              className="w-full bg-primary-brown text-white py-[1.2vw] rounded-[1vw] ff-accia text-[1.5vw] hover:bg-primary-brown/90 transition-all flex items-center justify-center gap-2 mt-[2vw]"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : "Place Order"}
              {!loading && <ArrowRight size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
