"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Loader2, Lock, ArrowLeft, CheckCircle } from "lucide-react"

// Lands here after the recovery email link. Supabase Auth's client-side
// detectSessionInUrl exchanges the recovery token for a short-lived session
// automatically, so we just need to capture the new password and submit it
// via auth.updateUser.

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [sessionOk, setSessionOk] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    // After the redirect, the client SDK consumes the token from the URL.
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSessionOk(!!session)
      setReady(true)
    }
    check()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    const { error: uErr } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (uErr) { setError(uErr.message); return }
    setDone(true)
    // Auto-redirect home after a beat.
    setTimeout(() => router.replace('/'), 2000)
  }

  if (!ready) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-primary-brown" size={28} /></div>
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 ff-apfel text-sm text-primary-brown hover:opacity-80">
          <ArrowLeft size={14} /> Back to Kakeez
        </Link>

        <div className="rounded-3xl border border-primary-brown/15 bg-white p-8 shadow-sm">
          {done ? (
            <div className="text-center">
              <CheckCircle className="text-emerald-500 mx-auto mb-4" size={40} />
              <h1 className="ff-accia text-[clamp(28px,2.2vw,36px)] text-primary-brown">Password updated</h1>
              <p className="ff-accia-light text-sm text-black/60 mt-2">Taking you home…</p>
            </div>
          ) : !sessionOk ? (
            <>
              <h1 className="ff-accia text-[clamp(28px,2.2vw,36px)] text-primary-brown">Link expired</h1>
              <p className="ff-accia-light text-sm text-black/60 mt-2">
                This reset link is no longer valid. Request a new one from the forgot-password page.
              </p>
              <Link href="/forgot-password" className="inline-block mt-4 bg-primary-brown text-white px-5 py-2.5 rounded-lg ff-accia hover:bg-primary-brown/90 transition-all">
                Request a new link
              </Link>
            </>
          ) : (
            <>
              <h1 className="ff-accia text-[clamp(28px,2.2vw,36px)] text-primary-brown">Set a new password</h1>
              <p className="ff-accia-light text-sm text-black/60 mt-2">Minimum 8 characters.</p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-brown/50" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full bg-primary-brown/5 border border-primary-brown/15 rounded-lg pl-10 pr-3 py-3 outline-none focus:border-primary-brown/40 ff-apfel text-sm"
                  />
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-brown/50" />
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full bg-primary-brown/5 border border-primary-brown/15 rounded-lg pl-10 pr-3 py-3 outline-none focus:border-primary-brown/40 ff-apfel text-sm"
                  />
                </div>

                {error && <p className="ff-apfel text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-primary-brown text-white py-3 rounded-lg ff-accia hover:bg-primary-brown/90 transition-all disabled:opacity-60"
                >
                  {saving ? <Loader2 className="animate-spin inline" size={18} /> : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
