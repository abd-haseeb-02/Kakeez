"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { X, Mail, Lock, Loader2, User, Phone, MapPin } from "lucide-react"

export default function UserAuthPopup({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess?: () => void }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  if (!isOpen) return null

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        if (onSuccess) onSuccess()
        onClose()
      }
    } else {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            address: address
          }
        }
      })
      if (error) {
        setError(error.message)
        setLoading(false)
      } else {
        if (onSuccess) onSuccess()
        onClose()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="relative w-full max-w-[30vw] min-w-[350px] bg-white rounded-[2vw] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-[1.5vw] top-[1.5vw] text-primary-brown/40 hover:text-primary-brown">
          <X size={24} />
        </button>

        <div className="p-[3vw] space-y-[2vw]">
          <div className="text-center space-y-[0.5vw]">
            <h2 className="ff-accia text-[2.5vw] text-primary-brown">{isLogin ? "Welcome Back" : "Join Kakeez"}</h2>
            <p className="ff-colville-light text-[1vw] text-primary-brown/60">
              {isLogin ? "Sign in to manage your orders" : "Create an account to start ordering"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-[1.5vw]">
            {error && (
              <div className="bg-red-50 text-red-500 p-[1vw] rounded-[1vw] text-[0.9vw] text-center ff-apfel border border-red-100">
                {error}
              </div>
            )}

            <div className="space-y-[1vw]">
              {!isLogin && (
                <>
                  <div className="relative">
                    <User className="absolute left-[1vw] top-1/2 -translate-y-1/2 text-primary-brown/40" size={18} />
                    <input 
                      required
                      type="text"
                      placeholder="Full Name"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-[1vw] pl-[3vw] pr-[1vw] py-[1vw] outline-none focus:border-primary-brown/40 text-primary-brown ff-apfel text-[1vw]"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-[1vw] top-1/2 -translate-y-1/2 text-primary-brown/40" size={18} />
                    <input 
                      required
                      type="tel"
                      placeholder="Phone Number"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-[1vw] pl-[3vw] pr-[1vw] py-[1vw] outline-none focus:border-primary-brown/40 text-primary-brown ff-apfel text-[1vw]"
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-[1vw] top-[1vw] text-primary-brown/40" size={18} />
                    <textarea 
                      required
                      placeholder="Delivery Address"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-[1vw] pl-[3vw] pr-[1vw] py-[1vw] outline-none focus:border-primary-brown/40 text-primary-brown ff-apfel text-[1vw] h-[4vw] resize-none"
                    />
                  </div>
                </>
              )}

              <div className="relative">
                <Mail className="absolute left-[1vw] top-1/2 -translate-y-1/2 text-primary-brown/40" size={18} />
                <input 
                  required
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-[1vw] pl-[3vw] pr-[1vw] py-[1vw] outline-none focus:border-primary-brown/40 text-primary-brown ff-apfel text-[1vw]"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-[1vw] top-1/2 -translate-y-1/2 text-primary-brown/40" size={18} />
                <input 
                  required
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-[1vw] pl-[3vw] pr-[1vw] py-[1vw] outline-none focus:border-primary-brown/40 text-primary-brown ff-apfel text-[1vw]"
                />
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full bg-primary-brown text-white py-[1.2vw] rounded-[1vw] ff-accia text-[1.2vw] hover:bg-primary-brown/90 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? "Sign In" : "Create Account")}
            </button>
          </form>

          <div className="text-center">
             <button 
               onClick={() => {
                 setIsLogin(!isLogin)
                 setError("")
               }}
               className="ff-colville text-[1vw] text-primary-brown underline decoration-dotted"
             >
               {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
             </button>
          </div>
        </div>
      </div>
    </div>
  )
}
