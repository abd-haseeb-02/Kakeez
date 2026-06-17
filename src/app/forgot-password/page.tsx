"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Loader2, Mail, ArrowLeft } from "lucide-react"

// Forgot-password request page. Sends Supabase Auth's recovery email; the
// link in that email redirects to /reset-password where we call updateUser.

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string>("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: rErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })
    setLoading(false)
    if (rErr) { setError(rErr.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 ff-apfel text-sm text-primary-brown hover:opacity-80">
          <ArrowLeft size={14} /> Back to Kakeez
        </Link>

        <div className="rounded-3xl border border-primary-brown/15 bg-white p-8 shadow-sm">
          <h1 className="ff-accia text-[clamp(28px,2.2vw,36px)] text-primary-brown">Forgot your password?</h1>
          <p className="ff-accia-light text-sm text-black/60 mt-2">
            Enter the email tied to your Kakeez account and we&apos;ll send a reset link.
          </p>

          {sent ? (
            <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="ff-apfel text-sm text-emerald-700">
                If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox (and the spam folder).
              </p>
              <Link href="/" className="block mt-3 ff-apfel text-sm text-primary-brown underline-offset-2 underline">Return to Kakeez</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-brown/50" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-primary-brown/5 border border-primary-brown/15 rounded-lg pl-10 pr-3 py-3 outline-none focus:border-primary-brown/40 ff-apfel text-sm"
                />
              </div>

              {error && <p className="ff-apfel text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-brown text-white py-3 rounded-lg ff-accia hover:bg-primary-brown/90 transition-all disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin inline" size={18} /> : 'Send reset link'}
              </button>

              <p className="ff-apfel text-xs text-black/40 text-center">
                Remember your password? <Link href="/" className="text-primary-brown underline-offset-2 underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
