"use client"

import { useState } from "react"
import { useCart } from "@/store/useCart"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { X, ShoppingBag, ArrowRight, Loader2, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import UserAuthPopup from "./UserAuthPopup"

export default function CartDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart()
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [showAuthPopup, setShowAuthPopup] = useState(false)
  const [checkoutError, setCheckoutError] = useState("")

  if (!isOpen) return null

  const router = useRouter()

  const handleCheckoutClick = async () => {
    setLoadingCheckout(true)
    setCheckoutError("")
    
    // 1. Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      setLoadingCheckout(false)
      setShowAuthPopup(true)
      return
    }

    // 2. Go to checkout page
    setLoadingCheckout(false)
    onClose()
    router.push('/checkout')
  }

  return (
    <>
      <UserAuthPopup 
        isOpen={showAuthPopup} 
        onClose={() => setShowAuthPopup(false)} 
        onSuccess={() => {
          setShowAuthPopup(false)
          handleCheckoutClick()
        }}
      />
      
      <div className="fixed inset-0 z-[100] flex justify-end">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
        
        {/* Drawer */}
        <div className="relative w-full max-w-[35vw] bg-white h-full shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">
          {/* Header */}
          <div className="p-[2.5vw] border-b border-primary-brown/10 flex justify-between items-center bg-accent-green/20">
            <div className="flex items-center gap-[1vw]">
              <ShoppingBag className="text-primary-brown" size={32} />
              <h2 className="ff-accia text-[2vw] text-primary-brown">Your Basket</h2>
            </div>
            <button onClick={onClose} className="p-[0.5vw] hover:bg-white rounded-full transition-all">
              <X size={24} className="text-primary-brown" />
            </button>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-[2.5vw] space-y-[2vw]">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-[1.5vw]">
                <div className="w-[10vw] h-[10vw] bg-primary-brown/5 rounded-full flex items-center justify-center">
                  <ShoppingBag size={48} className="text-primary-brown/20" />
                </div>
                <p className="ff-colville text-[1.2vw] text-primary-brown/60">Your basket is feeling a bit empty...</p>
                <button onClick={onClose} className="ff-accia text-[1vw] text-primary-brown underline underline-offset-4 font-bold uppercase">Start Shopping</button>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex gap-[1.5vw] group">
                  <div className="w-[8vw] h-[8vw] bg-[#ece9e2] rounded-[1vw] overflow-hidden relative border border-primary-brown/10">
                    <Image src={item.image} alt={item.name} fill className="object-cover" />
                  </div>
                  <div className="flex-1 space-y-[0.5vw]">
                    <div className="flex justify-between items-start">
                      <h3 className="ff-accia text-[1.2vw] text-primary-brown font-bold">{item.name}</h3>
                      <button onClick={() => removeItem(item.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 p-1 rounded">
                        <X size={16} />
                      </button>
                    </div>
                    <p className="ff-colville text-[1vw] text-primary-brown/60">Rs. {item.price}</p>
                    <div className="flex items-center gap-[1vw] pt-[0.5vw]">
                      <div className="flex items-center border border-primary-brown/20 rounded-lg overflow-hidden">
                        <button 
                          onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          className="px-2 py-1 hover:bg-primary-brown/5 transition-all"
                        >-</button>
                        <span className="px-3 py-1 ff-apfel text-[0.9vw] border-x border-primary-brown/20">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-1 hover:bg-primary-brown/5 transition-all"
                        >+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="p-[2.5vw] bg-white border-t border-primary-brown/10 space-y-[1.5vw]">
              {checkoutError && (
                <p className="text-red-500 text-[1vw] ff-apfel bg-red-50 p-2 rounded-lg text-center">{checkoutError}</p>
              )}
              <div className="flex justify-between items-end">
                <span className="ff-colville-light text-[1.2vw] text-primary-brown/60 uppercase tracking-widest">Subtotal</span>
                <span className="ff-accia text-[1.8vw] text-primary-brown font-bold text-right leading-none">Rs. {totalPrice()}</span>
              </div>
              <p className="ff-colville-light text-[0.8vw] text-primary-brown/40">Shipping and taxes calculated at checkout.</p>
              <button 
                onClick={handleCheckoutClick}
                disabled={loadingCheckout}
                className="w-full bg-primary-brown text-white py-[1.2vw] rounded-[1vw] ff-accia text-[1.2vw] hover:bg-primary-brown/90 transition-all flex items-center justify-center gap-2 group"
              >
                {loadingCheckout ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    Checkout Now
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-all" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Mini Checkout Confirmation Modal (Mock) */}
        {isCheckingOut && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-dark/90 backdrop-blur-xl" onClick={() => setIsCheckingOut(false)}></div>
            <div className="relative bg-white p-[4vw] rounded-[3vw] text-center space-y-[2vw] max-w-[30vw] animate-in zoom-in-95 duration-500">
              <div className="w-[6vw] h-[6vw] bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={48} className="text-green-500" />
              </div>
              <h3 className="ff-accia text-[2vw] text-primary-brown">Order Confirmed!</h3>
              <p className="ff-colville-light text-[1.1vw] text-primary-brown/60">Thank you for your order. We're getting the oven ready!</p>
              <button 
                onClick={() => {
                  setIsCheckingOut(false)
                  onClose()
                }}
                className="bg-primary-brown text-white px-[3vw] py-[1vw] rounded-[1vw] ff-accia text-[1.2vw]"
              >
                Sweet!
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
