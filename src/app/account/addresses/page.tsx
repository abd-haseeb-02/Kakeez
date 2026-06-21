"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2, Plus, Trash2, Edit3, MapPin, Check, X } from "lucide-react"

interface AddressRow {
  id: string
  user_id: string
  label: string | null
  recipient_name: string
  phone_e164: string
  line1: string
  line2: string | null
  area: string | null
  city: string
  postal_code: string | null
  landmark: string | null
  is_default_shipping: boolean
  is_default_billing: boolean
}

interface FormData {
  label: string
  recipient_name: string
  phone_e164: string
  line1: string
  line2: string
  area: string
  city: string
  postal_code: string
  landmark: string
  is_default_shipping: boolean
}

const DEFAULT_FORM: FormData = {
  label: '',
  recipient_name: '',
  phone_e164: '+92',
  line1: '',
  line2: '',
  area: '',
  city: 'Karachi',
  postal_code: '',
  landmark: '',
  is_default_shipping: false,
}

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<AddressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<AddressRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('addresses')
      .select('*')
      .order('is_default_shipping', { ascending: false })
      .order('created_at', { ascending: false })
    setAddresses((data as AddressRow[]) ?? [])
    setLoading(false)
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...DEFAULT_FORM, is_default_shipping: addresses.length === 0 })
    setError("")
    setShowForm(true)
  }
  const openEdit = (a: AddressRow) => {
    setEditing(a)
    setForm({
      label: a.label ?? '',
      recipient_name: a.recipient_name,
      phone_e164: a.phone_e164,
      line1: a.line1,
      line2: a.line2 ?? '',
      area: a.area ?? '',
      city: a.city,
      postal_code: a.postal_code ?? '',
      landmark: a.landmark ?? '',
      is_default_shipping: a.is_default_shipping,
    })
    setError("")
    setShowForm(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Please sign in.')

      const payload = {
        user_id: session.user.id,
        label: form.label || null,
        recipient_name: form.recipient_name,
        phone_e164: form.phone_e164,
        line1: form.line1,
        line2: form.line2 || null,
        area: form.area || null,
        city: form.city || 'Karachi',
        postal_code: form.postal_code || null,
        landmark: form.landmark || null,
        is_default_shipping: form.is_default_shipping,
      }

      // Enforce at most one default-shipping per user — clear other defaults
      // if this row is being promoted.
      if (form.is_default_shipping) {
        await supabase.from('addresses').update({ is_default_shipping: false }).eq('user_id', session.user.id)
      }

      if (editing) {
        const { error: upErr } = await supabase.from('addresses').update(payload).eq('id', editing.id)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase.from('addresses').insert(payload)
        if (insErr) throw insErr
      }
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save address.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this address?')) return
    const { error: dErr } = await supabase.from('addresses').delete().eq('id', id)
    if (dErr) { setError(dErr.message); return }
    setAddresses((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="ff-accia text-[clamp(22px,1.6vw,28px)] text-primary-brown">Your addresses</h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary-brown text-white px-4 py-2 rounded-lg ff-apfel text-sm hover:bg-primary-brown/90 transition-all"
        >
          <Plus size={14} /> New address
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 ff-apfel text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-brown" size={28} /></div>
      ) : addresses.length === 0 && !showForm ? (
        <div className="rounded-2xl border border-primary-brown/15 bg-accent-green/30 p-8 text-center">
          <MapPin size={28} className="mx-auto text-primary-brown/60 mb-3" />
          <p className="ff-accia text-primary-brown">No addresses saved yet.</p>
          <p className="ff-apfel text-sm text-black/50 mt-1">Save one to skip re-typing it on every checkout.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-2xl border border-primary-brown/15 bg-white p-5 relative">
              {a.is_default_shipping && (
                <span className="absolute top-3 right-3 ff-apfel text-[10px] uppercase tracking-widest bg-primary-brown/10 text-primary-brown px-2 py-0.5 rounded">Default</span>
              )}
              <p className="ff-accia text-primary-brown">{a.label || a.recipient_name}</p>
              <p className="ff-apfel text-sm text-black/70 mt-1">{a.recipient_name} · {a.phone_e164}</p>
              <p className="ff-accia-light text-sm text-black/60 mt-2 leading-relaxed">
                {a.line1}
                {a.line2 && <><br />{a.line2}</>}
                {(a.area || a.city) && <><br />{[a.area, a.city].filter(Boolean).join(', ')}</>}
                {a.postal_code && ` ${a.postal_code}`}
                {a.landmark && <><br /><span className="italic">{a.landmark}</span></>}
              </p>
              <div className="flex gap-2 mt-4 pt-3 border-t border-primary-brown/10">
                <button onClick={() => openEdit(a)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs ff-apfel bg-primary-brown/5 hover:bg-primary-brown/10 transition-all">
                  <Edit3 size={12} /> Edit
                </button>
                <button onClick={() => remove(a.id)} className="px-3 py-1.5 rounded-md bg-red-50 text-red-500 hover:bg-red-100 transition-all">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={submit} className="w-full max-w-lg bg-white rounded-3xl p-8 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="ff-accia text-2xl text-primary-brown">{editing ? 'Edit address' : 'New address'}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="text-black/40 hover:text-black"><X size={20} /></button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Label (optional)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Home / Office" />
              <Field label="Recipient name" required value={form.recipient_name} onChange={(v) => setForm({ ...form, recipient_name: v })} />
              <Field label="Phone" required value={form.phone_e164} onChange={(v) => setForm({ ...form, phone_e164: v })} placeholder="+92…" />
              <Field label="City" required value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <div className="sm:col-span-2">
                <Field label="Address line 1" required value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} />
              </div>
              <div className="sm:col-span-2">
                <Field label="Address line 2 (optional)" value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} />
              </div>
              <Field label="Area (optional)" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
              <Field label="Postal code (optional)" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
              <div className="sm:col-span-2">
                <Field label="Landmark (optional)" value={form.landmark} onChange={(v) => setForm({ ...form, landmark: v })} />
              </div>
            </div>

            <label className="flex items-center gap-3 bg-primary-brown/5 p-3 rounded-lg cursor-pointer">
              <input type="checkbox" checked={form.is_default_shipping} onChange={(e) => setForm({ ...form, is_default_shipping: e.target.checked })} className="w-4 h-4 accent-primary-brown" />
              <span className="ff-apfel text-sm text-black/80 flex items-center gap-1.5">{form.is_default_shipping && <Check size={14} className="text-primary-brown" />} Use as default delivery address</span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary-brown text-white py-3 rounded-lg ff-accia text-base hover:bg-primary-brown/90 transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin inline" size={18} /> : editing ? 'Update address' : 'Save address'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="ff-apfel text-xs text-black/50 block mb-1">{label}</label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-primary-brown/5 border border-primary-brown/10 rounded-lg px-3 py-2 outline-none focus:border-primary-brown/40 ff-apfel text-sm"
      />
    </div>
  )
}
