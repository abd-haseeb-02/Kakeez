"use client"

import { Suspense, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, Lock, ShieldCheck } from "lucide-react"

// Honors the ?next= param set by proxy.ts when an unauthed request hits
// /admin/*. Only paths under /admin are accepted as the post-login redirect
// — anything else falls back to /admin to avoid open-redirect cleverness.
function safeNext(raw: string | null): string {
  if (!raw) return '/admin'
  if (!raw.startsWith('/admin')) return '/admin'
  return raw
}

// Next 16 requires useSearchParams() to live inside a Suspense boundary
// so the page can still be statically prerendered. The form is the only
// part that needs the param, so we isolate it here.
export default function AdminLogin() {
  return (
    <Suspense fallback={
      <div className="admin-login-screen flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-primary-brown" size={28} />
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  )
}

function AdminLoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })

    if (error) {
      setError("Invalid credentials. Please try again.")
      setLoading(false)
    } else {
      router.push(next)
    }
  }

  return (
    <div className="admin-login-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[460px] space-y-8 rounded-2xl border border-white/10 bg-[rgba(24,22,18,0.86)] p-9 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary-brown/30 bg-primary-brown/10 shadow-lg shadow-black/20">
            <Lock className="text-primary-brown" size={30} />
          </div>
          <p className="ff-apfel text-[11px] uppercase tracking-[0.22em] text-primary-brown">Kakeez operations</p>
          <h1 className="mt-2 text-4xl font-bold ff-accia text-white">Admin Login</h1>
          <p className="text-white/50 ff-apfel mt-3">Secure access to orders, catalog, staff, and store settings.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm ff-apfel text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/50 mb-2 ff-apfel ml-1">Email Address</label>
              <input 
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 outline-none focus:border-primary-brown transition-all text-white"
                placeholder="Hello@kakeez.com"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-2 ff-apfel ml-1">Password</label>
              <input 
                required
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 outline-none focus:border-primary-brown transition-all text-white"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-primary-brown text-white px-6 py-4 rounded-xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold flex items-center justify-center gap-2 shadow-lg shadow-black/20"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Access Dashboard"}
          </button>

          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <ShieldCheck className="mt-0.5 text-primary-brown" size={18} />
            <p className="ff-apfel text-xs leading-relaxed text-white/45">
              Access is role-gated through Supabase profiles. Admin and staff roles can enter this studio.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
