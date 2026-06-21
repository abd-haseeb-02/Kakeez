"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2, Check, KeyRound } from "lucide-react"

export default function ProfilePage() {
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number>(0)
  const [showSaved, setShowSaved] = useState(false)
  const [error, setError] = useState<string>("")

  // Password change
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<string>("")
  const [pwError, setPwError] = useState<string>("")

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setEmail(session.user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone_e164')
        .eq('id', session.user.id)
        .maybeSingle()
      setFullName(data?.full_name ?? '')
      setPhone(data?.phone_e164 ?? '')
      setLoading(false)
    }
    load()
  }, [])

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Please sign in.')
      const { error: upErr } = await supabase
        .from('profiles')
        .update({ full_name: fullName || null, phone_e164: phone || null })
        .eq('id', session.user.id)
      if (upErr) throw upErr
      setSavedAt(Date.now())
      setShowSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!savedAt) return
    const timeout = window.setTimeout(() => setShowSaved(false), 5000)
    return () => window.clearTimeout(timeout)
  }, [savedAt])

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError("")
    setPwMessage("")
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return }
    setPwSaving(true)
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password: newPassword })
      if (upErr) throw upErr
      setPwMessage('Password updated.')
      setNewPassword(''); setConfirmPassword('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not update password.')
    } finally {
      setPwSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-brown" size={28} /></div>
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="space-y-4 rounded-[16px] border border-primary-brown/10 bg-white/75 p-5 shadow-sm sm:p-6">
        <div>
          <p className="ff-colville text-[13px] uppercase tracking-[0.12em] text-primary-brown/55">Account details</p>
          <h2 className="ff-accia mt-1 text-[clamp(32px,3vw,48px)] leading-none text-primary-brown">Profile</h2>
        </div>

        <Field label="Email" value={email} disabled hint="Email changes happen via Supabase email-change flow (Phase 5)." />
        <Field label="Full name" value={fullName} onChange={setFullName} required />
        <Field label="Phone (E.164)" value={phone} onChange={setPhone} placeholder="+923XXXXXXXXX" />

        {error && <p className="ff-apfel text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="h-11 rounded-[10px] bg-primary-brown px-5 ff-accia text-[17px] text-white transition-colors hover:bg-primary-brown/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin inline" size={16} /> : 'Save changes'}
          </button>
          {showSaved && (
            <span className="flex items-center gap-1.5 rounded-full bg-accent-green px-3 py-1 ff-colville text-sm text-primary-brown"><Check size={14} /> Saved</span>
          )}
        </div>
      </form>

      <form onSubmit={changePassword} className="space-y-4 rounded-[16px] border border-primary-brown/10 bg-white/75 p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 ff-accia text-[clamp(28px,2.5vw,40px)] leading-none text-primary-brown"><KeyRound size={20} /> Change password</h2>
        <p className="ff-colville-light text-sm text-primary-brown/60">Minimum 8 characters.</p>

        <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} required />
        <Field label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirmPassword} required />

        {pwError && <p className="ff-apfel text-sm text-red-600">{pwError}</p>}
        {pwMessage && <p className="ff-apfel text-sm text-emerald-600">{pwMessage}</p>}

        <button
          type="submit"
          disabled={pwSaving || !newPassword}
          className="h-11 rounded-[10px] bg-primary-brown px-5 ff-accia text-[17px] text-white transition-colors hover:bg-primary-brown/90 disabled:opacity-60"
        >
          {pwSaving ? <Loader2 className="animate-spin inline" size={16} /> : 'Update password'}
        </button>
      </form>
    </div>
  )
}

function Field({
  label, value, onChange, type, required, disabled, placeholder, hint,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; required?: boolean; disabled?: boolean;
  placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block ff-colville text-[13px] uppercase tracking-[0.08em] text-primary-brown/55">{label}</label>
      <input
        type={type ?? 'text'}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-[10px] border border-primary-brown/15 bg-white/80 px-4 ff-apfel text-[15px] text-primary-brown outline-none transition-colors placeholder:text-primary-brown/35 focus:border-primary-brown disabled:opacity-60"
      />
      {hint && <p className="mt-1 ff-colville-light text-[12px] text-primary-brown/50">{hint}</p>}
    </div>
  )
}
