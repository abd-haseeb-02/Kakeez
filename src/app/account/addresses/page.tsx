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
  label: "",
  recipient_name: "",
  phone_e164: "+92",
  line1: "",
  line2: "",
  area: "",
  city: "Karachi",
  postal_code: "",
  landmark: "",
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
      .from("addresses")
      .select("*")
      .order("is_default_shipping", { ascending: false })
      .order("created_at", { ascending: false })
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
      label: a.label ?? "",
      recipient_name: a.recipient_name,
      phone_e164: a.phone_e164,
      line1: a.line1,
      line2: a.line2 ?? "",
      area: a.area ?? "",
      city: a.city,
      postal_code: a.postal_code ?? "",
      landmark: a.landmark ?? "",
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
      if (!session) throw new Error("Please sign in.")

      const payload = {
        user_id: session.user.id,
        label: form.label || null,
        recipient_name: form.recipient_name,
        phone_e164: form.phone_e164,
        line1: form.line1,
        line2: form.line2 || null,
        area: form.area || null,
        city: form.city || "Karachi",
        postal_code: form.postal_code || null,
        landmark: form.landmark || null,
        is_default_shipping: form.is_default_shipping,
      }

      if (form.is_default_shipping) {
        await supabase.from("addresses").update({ is_default_shipping: false }).eq("user_id", session.user.id)
      }

      if (editing) {
        const { error: upErr } = await supabase.from("addresses").update(payload).eq("id", editing.id)
        if (upErr) throw upErr
      } else {
        const { error: insErr } = await supabase.from("addresses").insert(payload)
        if (insErr) throw insErr
      }
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save address.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this address?")) return
    const { error: dErr } = await supabase.from("addresses").delete().eq("id", id)
    if (dErr) {
      setError(dErr.message)
      return
    }
    setAddresses((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="ff-accia text-[clamp(32px,3vw,48px)] leading-none text-primary-brown">Your addresses</h2>
        <button onClick={openAdd} className="flex h-11 items-center gap-2 rounded-[10px] bg-primary-brown px-4 ff-accia text-[16px] text-white transition-colors hover:bg-primary-brown/90">
          <Plus size={14} /> New address
        </button>
      </div>

      {error && <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-2 ff-apfel text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-brown" size={28} /></div>
      ) : addresses.length === 0 && !showForm ? (
        <div className="rounded-[16px] border border-primary-brown/10 bg-accent-green/45 p-8 text-center">
          <MapPin size={30} className="mx-auto mb-3 text-primary-brown/70" />
          <p className="ff-accia text-[clamp(24px,2.3vw,34px)] leading-none text-primary-brown">No addresses saved yet.</p>
          <p className="ff-colville-light mt-2 text-[15px] text-primary-brown/65">Save one to skip re-typing it on every checkout.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="relative rounded-[16px] border border-primary-brown/10 bg-white/75 p-5 shadow-sm">
              {a.is_default_shipping && (
                <span className="absolute right-3 top-3 rounded-full bg-accent-green px-2.5 py-1 ff-colville text-[11px] uppercase tracking-[0.12em] text-primary-brown">Default</span>
              )}
              <p className="ff-accia text-[24px] leading-none text-primary-brown">{a.label || a.recipient_name}</p>
              <p className="mt-2 ff-colville text-sm text-primary-brown/70">{a.recipient_name} · {a.phone_e164}</p>
              <p className="mt-3 ff-colville-light text-sm leading-relaxed text-primary-brown/65">
                {a.line1}
                {a.line2 && <><br />{a.line2}</>}
                {(a.area || a.city) && <><br />{[a.area, a.city].filter(Boolean).join(", ")}</>}
                {a.postal_code && ` ${a.postal_code}`}
                {a.landmark && <><br /><span className="italic">{a.landmark}</span></>}
              </p>
              <div className="mt-4 flex gap-2 border-t border-primary-brown/10 pt-3">
                <button onClick={() => openEdit(a)} className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-accent-green/55 py-2 ff-colville text-sm text-primary-brown transition-colors hover:bg-accent-green">
                  <Edit3 size={12} /> Edit
                </button>
                <button onClick={() => remove(a.id)} className="rounded-[8px] bg-red-50 px-3 py-2 text-red-500 transition-colors hover:bg-red-100" aria-label="Delete address">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-[18px] border border-white/70 bg-[#fffdf7] p-5 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between">
              <h3 className="ff-accia text-[clamp(32px,7vw,44px)] leading-none text-primary-brown">{editing ? "Edit address" : "New address"}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-brown/15 bg-white text-primary-brown transition-colors hover:bg-primary-brown hover:text-white"><X size={18} /></button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Label (optional)" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Home / Office" />
              <Field label="Recipient name" required value={form.recipient_name} onChange={(v) => setForm({ ...form, recipient_name: v })} />
              <Field label="Phone" required value={form.phone_e164} onChange={(v) => setForm({ ...form, phone_e164: v })} placeholder="+92..." />
              <Field label="City" required value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
              <div className="sm:col-span-2"><Field label="Address line 1" required value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} /></div>
              <div className="sm:col-span-2"><Field label="Address line 2 (optional)" value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} /></div>
              <Field label="Area (optional)" value={form.area} onChange={(v) => setForm({ ...form, area: v })} />
              <Field label="Postal code (optional)" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
              <div className="sm:col-span-2"><Field label="Landmark (optional)" value={form.landmark} onChange={(v) => setForm({ ...form, landmark: v })} /></div>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-[10px] bg-accent-green/45 p-3">
              <input type="checkbox" checked={form.is_default_shipping} onChange={(e) => setForm({ ...form, is_default_shipping: e.target.checked })} className="h-4 w-4 accent-primary-brown" />
              <span className="flex items-center gap-1.5 ff-colville text-sm text-primary-brown">{form.is_default_shipping && <Check size={14} />} Use as default delivery address</span>
            </label>

            <button type="submit" disabled={saving} className="h-12 w-full rounded-[10px] bg-primary-brown ff-accia text-[18px] text-white transition-colors hover:bg-primary-brown/90 disabled:opacity-60">
              {saving ? <Loader2 className="inline animate-spin" size={18} /> : editing ? "Update address" : "Save address"}
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
      <label className="mb-1.5 block ff-colville text-[13px] uppercase tracking-[0.08em] text-primary-brown/55">{label}</label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[10px] border border-primary-brown/15 bg-white/80 px-3 ff-apfel text-[15px] text-primary-brown outline-none transition-colors placeholder:text-primary-brown/35 focus:border-primary-brown"
      />
    </div>
  )
}
