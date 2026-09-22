"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Loader2, Lock, ArrowLeft, CheckCircle } from "lucide-react"

// Lands here after /auth/recover has redeemed the recovery token and written
// the session into cookies, so the browser client picks it up on first read.
// All that's left is capturing the new password and submitting it via
// auth.updateUser.
//
// The session isn't always there on the first read, which is why this doesn't
// just call getSession() once and call it a day. Two cases arrive late:
// GoTrue's implicit flow puts the session in the URL *fragment*, which the
// server never sees and the browser client has to parse itself
// (detectSessionInUrl); and the client's own cookie hydration is async. Both
// resolve through onAuthStateChange a tick or two after mount. Declaring the
// link dead before then is how a perfectly good reset link ends up showing
// "Link expired".

// Does the URL still carry something the Supabase client might turn into a
// session? If so, a missing session means "not yet", not "expired".
const urlHasAuthMaterial = () => {
  if (typeof window === 'undefined') return false
  return /access_token=|refresh_token=|token_hash=|[?&]code=/.test(
    window.location.hash + window.location.search
  )
}

// How long to let a pending sign-in land before showing the expired state.
const HYDRATION_GRACE_MS = 2500

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
    let cancelled = false
    let graceTimer: ReturnType<typeof setTimeout> | undefined

    const accept = () => {
      if (cancelled) return
      setSessionOk(true)
      setReady(true)
      // Drop the recovery token out of the address bar now that it's spent, so
      // a refresh doesn't replay it and it can't leak via the Referer header.
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }

    // Subscribe first: a fragment-borne session (PASSWORD_RECOVERY / SIGNED_IN)
    // can land between this line and getSession() resolving.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) accept()
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) { accept(); return }
      if (!urlHasAuthMaterial()) { setReady(true); return }
      // Something in the URL is still being redeemed. Give it a moment; if the
      // subscription above hasn't fired by then, the link really is spent.
      graceTimer = setTimeout(() => { if (!cancelled) setReady(true) }, HYDRATION_GRACE_MS)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
      clearTimeout(graceTimer)
    }
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
