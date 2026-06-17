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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

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
      <form onSubmit={saveProfile} className="rounded-2xl border border-primary-brown/15 bg-white p-6 space-y-4">
        <h2 className="ff-accia text-[clamp(22px,1.6vw,28px)] text-primary-brown">Profile</h2>

        <Field label="Email" value={email} disabled hint="Email changes happen via Supabase email-change flow (Phase 5)." />
        <Field label="Full name" value={fullName} onChange={setFullName} required />
        <Field label="Phone (E.164)" value={phone} onChange={setPhone} placeholder="+923XXXXXXXXX" />

        {error && <p className="ff-apfel text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary-brown text-white px-5 py-2.5 rounded-lg ff-apfel hover:bg-primary-brown/90 transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin inline" size={16} /> : 'Save changes'}
          </button>
          {savedAt > 0 && Date.now() - savedAt < 5000 && (
            <span className="ff-apfel text-sm text-emerald-600 flex items-center gap-1.5"><Check size={14} /> Saved</span>
          )}
        </div>
      </form>

      <form onSubmit={changePassword} className="rounded-2xl border border-primary-brown/15 bg-white p-6 space-y-4">
        <h2 className="ff-accia text-[clamp(20px,1.4vw,26px)] text-primary-brown flex items-center gap-2"><KeyRound size={18} /> Change password</h2>
        <p className="ff-apfel text-xs text-black/50">Minimum 8 characters.</p>

        <Field label="New password" type="password" value={newPassword} onChange={setNewPassword} required />
        <Field label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirmPassword} required />

        {pwError && <p className="ff-apfel text-sm text-red-600">{pwError}</p>}
        {pwMessage && <p className="ff-apfel text-sm text-emerald-600">{pwMessage}</p>}

        <button
          type="submit"
          disabled={pwSaving || !newPassword}
          className="bg-primary-brown text-white px-5 py-2.5 rounded-lg ff-apfel hover:bg-primary-brown/90 transition-all disabled:opacity-60"
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
      <label className="ff-apfel text-xs text-black/50 block mb-1">{label}</label>
      <input
        type={type ?? 'text'}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-lg px-3 py-2 outline-none focus:border-primary-brown/40 ff-apfel text-sm disabled:opacity-60"
      />
      {hint && <p className="ff-apfel text-[11px] text-black/40 mt-1">{hint}</p>}
    </div>
  )
}
