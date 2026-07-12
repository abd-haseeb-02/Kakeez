"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { ArrowRight, X, Mail, Lock, Loader2, User, Phone, MapPin, CakeSlice, CheckCircle2 } from "lucide-react"

const MIN_PASSWORD = 8

export default function UserAuthPopup({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess?: () => void }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [signupNeedsEmailConfirmation, setSignupNeedsEmailConfirmation] = useState(false)

  if (!isOpen) return null

  const fieldClass =
    "h-12 w-full rounded-[10px] border border-primary-brown/20 bg-white/75 pl-11 pr-4 ff-apfel text-[15px] text-primary-brown outline-none transition-colors placeholder:text-primary-brown/40 focus:border-primary-brown focus:bg-white"
  const iconClass = "absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-brown/45"

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
      // Phase 4: enforce min length client-side; Phase 5 will raise the
      // Supabase project's password policy server-side too.
      if (password.length < MIN_PASSWORD) {
        setError(`Password must be at least ${MIN_PASSWORD} characters.`)
        setLoading(false)
        return
      }
      const { data: signupData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            address: address,
          },
        },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      // handle_new_user trigger created a profiles row with role='customer';
      // sync phone + persist the initial address so the customer doesn't
      // have to retype them on first checkout. Best-effort: failures here
      // don't undo the signup.
      const userId = signupData?.user?.id
      if (userId) {
        await supabase.from('profiles').update({
          full_name: fullName || null,
          phone_e164: phone || null,
        }).eq('id', userId)

        if (address?.trim()) {
          await supabase.from('addresses').insert({
            user_id: userId,
            recipient_name: fullName,
            phone_e164: phone || '+92',
            line1: address.trim(),
            city: 'Karachi',
            is_default_shipping: true,
          })
        }
      }
      if (signupData.session) {
        if (onSuccess) onSuccess()
        onClose()
      } else {
        setSignupNeedsEmailConfirmation(true)
      }
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-5 sm:px-6">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

      <div className="relative max-h-[calc(100vh-32px)] w-full max-w-[520px] overflow-hidden rounded-[18px] border border-white/70 bg-[#fffdf7] text-primary-brown shadow-[0_24px_80px_rgba(51,34,16,0.32)] animate-in fade-in zoom-in-95 duration-300">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-primary-brown/15 bg-white/80 text-primary-brown transition-colors hover:bg-primary-brown hover:text-white"
          aria-label="Close auth popup"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,#e1eab4_0%,rgba(225,234,180,0)_100%)]" />

        <div className="relative max-h-[calc(100vh-32px)] overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary-brown/20 bg-white shadow-sm">
            {signupNeedsEmailConfirmation ? <Mail className="h-6 w-6" /> : <CakeSlice className="h-6 w-6" />}
          </div>

          <div className="mt-4 text-center">
            <h2 className="ff-accia text-[clamp(34px,8vw,52px)] leading-[0.95] text-primary-brown">
              {signupNeedsEmailConfirmation ? "Check Email" : isLogin ? "Welcome Back" : "Join Kakeez"}
            </h2>
            <p className="mx-auto mt-3 max-w-[360px] ff-colville-light text-[15px] leading-relaxed text-primary-brown/70">
              {signupNeedsEmailConfirmation ? "Confirm your email, then come back and sign in" : isLogin ? "Sign in to manage your orders" : "Create an account to start ordering"}
            </p>
          </div>

          {signupNeedsEmailConfirmation ? (
            <div className="mt-6 space-y-5 rounded-[14px] border border-primary-brown/15 bg-white/70 p-5 text-center">
              <CheckCircle2 className="mx-auto h-9 w-9 text-primary-brown" />
              <p className="ff-apfel text-[15px] leading-relaxed text-primary-brown/75">
                We sent a confirmation link to <strong>{email}</strong>. Open it, then come back and sign in.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSignupNeedsEmailConfirmation(false)
                  setIsLogin(true)
                }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-primary-brown ff-accia text-[18px] text-white transition-colors hover:bg-primary-brown/90"
              >
                Go to Sign In <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
          <form onSubmit={handleAuth} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-center ff-apfel text-[14px] leading-snug text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {!isLogin && (
                <>
                  <div className="relative">
                    <User className={iconClass} />
                    <input 
                      required
                      type="text"
                      placeholder="Full Name"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div className="relative">
                    <Phone className={iconClass} />
                    <input 
                      required
                      type="tel"
                      placeholder="Phone Number"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 h-4 w-4 text-primary-brown/45" />
                    <textarea 
                      required
                      placeholder="Delivery Address"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="min-h-[92px] w-full resize-none rounded-[10px] border border-primary-brown/20 bg-white/75 py-3 pl-11 pr-4 ff-apfel text-[15px] text-primary-brown outline-none transition-colors placeholder:text-primary-brown/40 focus:border-primary-brown focus:bg-white"
                    />
                  </div>
                </>
              )}

              <div className="relative">
                <Mail className={iconClass} />
                <input 
                  required
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="relative">
                <Lock className={iconClass} />
                <input
                  required
                  type="password"
                  minLength={isLogin ? undefined : MIN_PASSWORD}
                  placeholder={isLogin ? "Password" : `Password (${MIN_PASSWORD}+ characters)`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={fieldClass}
                />
              </div>
              {isLogin && (
                <div className="text-right">
                  <Link href="/forgot-password" onClick={onClose} className="ff-apfel text-[14px] text-primary-brown/70 underline underline-offset-4 transition-colors hover:text-primary-brown">
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>

            <button 
              disabled={loading}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[10px] bg-primary-brown px-4 ff-accia text-[20px] text-white transition-colors hover:bg-primary-brown/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? "Sign In" : "Create Account")}
            </button>
          </form>
          )}

          {!signupNeedsEmailConfirmation && <div className="mt-5 text-center">
             <button 
               onClick={() => {
                 setIsLogin(!isLogin)
                 setError("")
               }}
               className="ff-colville text-[15px] text-primary-brown underline decoration-dotted underline-offset-4 transition-opacity hover:opacity-70"
             >
               {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
             </button>
          </div>}
        </div>
      </div>
    </div>
  )
}
