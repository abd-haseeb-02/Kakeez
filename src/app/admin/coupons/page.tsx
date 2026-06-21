"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import { rupeesToMinor, formatPkr } from "@/lib/money"
import {
  Plus, Edit3, Trash2, X, Loader2, Calendar, Percent, Tag, Truck, Check,
} from "lucide-react"

interface CouponRow {
  id: string
  code: string
  type: 'percent' | 'fixed_cart' | 'fixed_product' | 'free_shipping'
  value_minor: number | null
  percent_bp: number | null
  min_order_minor: number | null
  max_discount_minor: number | null
  usage_limit: number | null
  usage_limit_per_user: number | null
  starts_at: string | null
  expires_at: string | null
  status: 'active' | 'paused' | 'archived'
  created_at: string
  redemption_count?: number
}

type FormState = {
  code: string
  type: CouponRow['type']
  percentText: string         // e.g. "10" for 10%
  valueRupees: string         // for fixed_cart
  minOrderRupees: string
  maxDiscountRupees: string
  usageLimit: string
  usageLimitPerUser: string
  startsAt: string
  expiresAt: string
  status: CouponRow['status']
}

const DEFAULT_FORM: FormState = {
  code: '',
  type: 'percent',
  percentText: '10',
  valueRupees: '',
  minOrderRupees: '',
  maxDiscountRupees: '',
  usageLimit: '',
  usageLimitPerUser: '',
  startsAt: '',
  expiresAt: '',
  status: 'active',
}

function typeIcon(t: CouponRow['type']) {
  switch (t) {
    case 'percent':       return <Percent size={14} className="text-emerald-300" />
    case 'fixed_cart':    return <Tag size={14} className="text-amber-300" />
    case 'free_shipping': return <Truck size={14} className="text-blue-300" />
    default:              return <Tag size={14} className="text-white/40" />
  }
}

function typeLabel(c: CouponRow): string {
  if (c.type === 'percent')       return `${((c.percent_bp ?? 0) / 100).toFixed(2)}%`
  if (c.type === 'fixed_cart')    return formatPkr(c.value_minor ?? 0)
  if (c.type === 'free_shipping') return 'Free shipping'
  return c.type
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<CouponRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    const { data: cRes, error } = await supabase
      .from('coupons')
      .select('*')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
    if (error) { toast.push({ kind: 'warn', title: 'Could not load coupons', body: error.message }); setLoading(false); return }
    // Pull redemption counts in one shot.
    const ids = ((cRes as CouponRow[]) ?? []).map((c) => c.id)
    let counts: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: rRes } = await supabase.from('coupon_redemptions').select('coupon_id').in('coupon_id', ids)
      counts = ((rRes as { coupon_id: string }[]) ?? []).reduce((acc, r) => {
        acc[r.coupon_id] = (acc[r.coupon_id] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
    setCoupons(((cRes as CouponRow[]) ?? []).map((c) => ({ ...c, redemption_count: counts[c.id] ?? 0 })))
    setLoading(false)
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openAdd = () => { setEditing(null); setForm(DEFAULT_FORM); setShowForm(true) }
  const openEdit = (c: CouponRow) => {
    setEditing(c)
    setForm({
      code: c.code,
      type: c.type,
      percentText: c.percent_bp != null ? (c.percent_bp / 100).toString() : '',
      valueRupees: c.value_minor != null ? (c.value_minor / 100).toFixed(2) : '',
      minOrderRupees: c.min_order_minor != null ? (c.min_order_minor / 100).toFixed(2) : '',
      maxDiscountRupees: c.max_discount_minor != null ? (c.max_discount_minor / 100).toFixed(2) : '',
      usageLimit: c.usage_limit?.toString() ?? '',
      usageLimitPerUser: c.usage_limit_per_user?.toString() ?? '',
      startsAt: c.starts_at ? c.starts_at.slice(0, 16) : '',
      expiresAt: c.expires_at ? c.expires_at.slice(0, 16) : '',
      status: c.status,
    })
    setShowForm(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        status: form.status,
        starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        min_order_minor: form.minOrderRupees ? rupeesToMinor(form.minOrderRupees) : null,
        max_discount_minor: form.maxDiscountRupees ? rupeesToMinor(form.maxDiscountRupees) : null,
        usage_limit: form.usageLimit ? parseInt(form.usageLimit, 10) : null,
        usage_limit_per_user: form.usageLimitPerUser ? parseInt(form.usageLimitPerUser, 10) : null,
        percent_bp: null,
        value_minor: null,
      }
      if (form.type === 'percent') {
        const n = Number(form.percentText)
        if (!Number.isFinite(n) || n <= 0 || n > 100) throw new Error('Percent must be between 0 and 100.')
        payload.percent_bp = Math.round(n * 100)
      } else if (form.type === 'fixed_cart') {
        if (!form.valueRupees) throw new Error('Fixed-cart amount is required.')
        payload.value_minor = rupeesToMinor(form.valueRupees)
      }
      // free_shipping carries no value.

      if (editing) {
        const { error } = await supabase.from('coupons').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.push({ kind: 'success', title: 'Coupon updated' })
      } else {
        const { error } = await supabase.from('coupons').insert(payload)
        if (error) throw error
        toast.push({ kind: 'success', title: 'Coupon created' })
      }
      setShowForm(false)
      await load()
    } catch (err) {
      toast.push({ kind: 'warn', title: 'Could not save coupon', body: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (c: CouponRow) => {
    if ((c.redemption_count ?? 0) > 0) {
      if (!confirm(`${c.code} has ${c.redemption_count} historic redemption(s). Archive instead of delete?`)) return
      const { error } = await supabase.from('coupons').update({ status: 'archived' }).eq('id', c.id)
      if (error) { toast.push({ kind: 'warn', title: 'Could not archive', body: error.message }); return }
      await load()
      return
    }
    if (!confirm(`Delete coupon "${c.code}"? Cannot be undone.`)) return
    const { error } = await supabase.from('coupons').delete().eq('id', c.id)
    if (error) { toast.push({ kind: 'warn', title: 'Could not delete', body: error.message }); return }
    setCoupons((prev) => prev.filter((x) => x.id !== c.id))
  }

  const grouped = useMemo(() => ({
    active:   coupons.filter((c) => c.status === 'active'),
    paused:   coupons.filter((c) => c.status === 'paused'),
    archived: coupons.filter((c) => c.status === 'archived'),
  }), [coupons])

  return (
    <div className="admin-modern space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <p className="admin-pill mb-3 inline-flex rounded-full px-3 py-1 ff-apfel text-[11px] uppercase tracking-[0.16em]">Pricing</p>
          <h1 className="text-3xl font-bold ff-accia text-primary-brown">Coupons</h1>
          <p className="text-white/50 ff-apfel mt-1">
            {grouped.active.length} active · {grouped.paused.length} paused · {grouped.archived.length} archived
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary-brown text-white px-5 py-2.5 rounded-xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold"
        >
          <Plus size={16} /> New coupon
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-brown" size={32} /></div>
      ) : coupons.length === 0 ? (
        <div className="admin-card rounded-2xl p-10 text-center">
          <Tag size={28} className="mx-auto text-white/30 mb-3" />
          <p className="ff-accia text-white">No coupons yet</p>
          <p className="ff-apfel text-sm text-white/40 mt-1">Create one to offer percent / fixed / free-shipping discounts at checkout.</p>
        </div>
      ) : (
        <div className="admin-card rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="text-white/30 text-xs uppercase tracking-wider ff-apfel border-b border-white/5">
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Discount</th>
                <th className="px-6 py-4">Rules</th>
                <th className="px-6 py-4">Window</th>
                <th className="px-6 py-4">Usage</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {coupons.map((c) => (
                <tr key={c.id} className={`hover:bg-white/5 transition-all ${c.status !== 'active' ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4 ff-apfel">
                    <div className="flex items-center gap-2">
                      {typeIcon(c.type)}
                      <code className="text-primary-brown text-sm">{c.code}</code>
                    </div>
                  </td>
                  <td className="px-6 py-4 ff-apfel text-sm text-white">{typeLabel(c)}</td>
                  <td className="px-6 py-4 ff-apfel text-xs text-white/60">
                    {c.min_order_minor ? <div>Min {formatPkr(c.min_order_minor)}</div> : null}
                    {c.max_discount_minor ? <div>Max {formatPkr(c.max_discount_minor)}</div> : null}
                    {!c.min_order_minor && !c.max_discount_minor ? <span className="text-white/30">—</span> : null}
                  </td>
                  <td className="px-6 py-4 ff-apfel text-xs text-white/60">
                    {(c.starts_at || c.expires_at) ? (
                      <div className="flex items-center gap-1.5"><Calendar size={11} className="text-white/30" />
                        <div>
                          {c.starts_at && <div>From {new Date(c.starts_at).toLocaleDateString()}</div>}
                          {c.expires_at && <div>Until {new Date(c.expires_at).toLocaleDateString()}</div>}
                        </div>
                      </div>
                    ) : <span className="text-white/30">Always</span>}
                  </td>
                  <td className="px-6 py-4 ff-apfel text-sm text-white">
                    {c.redemption_count ?? 0}
                    {c.usage_limit ? <span className="text-white/40"> / {c.usage_limit}</span> : null}
                    {c.usage_limit_per_user ? <span className="block text-[10px] text-white/40 mt-0.5">{c.usage_limit_per_user}/user</span> : null}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`ff-apfel text-[10px] uppercase tracking-wider px-2 py-1 rounded-full ${
                      c.status === 'active'   ? 'bg-emerald-500/15 text-emerald-300' :
                      c.status === 'paused'   ? 'bg-amber-500/15 text-amber-300' :
                                                'bg-white/5 text-white/40'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(c)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"><Edit3 size={14} /></button>
                      <button onClick={() => remove(c)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={submit} className="bg-[#121212] border border-white/10 p-8 rounded-3xl w-full max-w-lg space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold ff-accia text-primary-brown">{editing ? 'Edit coupon' : 'New coupon'}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-white/40 hover:text-white"><X size={20} /></button>
            </div>

            <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} required placeholder="WELCOME10" uppercase />

            <div>
              <label className="ff-apfel text-xs text-white/40 block mb-2 uppercase tracking-widest">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['percent', 'fixed_cart', 'free_shipping'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t })}
                    className={`px-3 py-2 rounded-lg ff-apfel text-xs capitalize transition-all border ${
                      form.type === t ? 'bg-primary-brown text-white border-primary-brown' : 'bg-white/5 text-white/50 hover:bg-white/10 border-white/10'
                    }`}
                  >
                    {t === 'percent' ? '% off' : t === 'fixed_cart' ? 'PKR off' : 'Free shipping'}
                  </button>
                ))}
              </div>
            </div>

            {form.type === 'percent' && (
              <Field label="Percent (0–100)" value={form.percentText} onChange={(v) => setForm({ ...form, percentText: v })} type="number" required />
            )}
            {form.type === 'fixed_cart' && (
              <Field label="Discount (PKR)" value={form.valueRupees} onChange={(v) => setForm({ ...form, valueRupees: v })} type="number" required />
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Min order (PKR)" value={form.minOrderRupees} onChange={(v) => setForm({ ...form, minOrderRupees: v })} type="number" />
              <Field label="Max discount (PKR)" value={form.maxDiscountRupees} onChange={(v) => setForm({ ...form, maxDiscountRupees: v })} type="number" />
              <Field label="Total uses (limit)" value={form.usageLimit} onChange={(v) => setForm({ ...form, usageLimit: v })} type="number" />
              <Field label="Uses per customer" value={form.usageLimitPerUser} onChange={(v) => setForm({ ...form, usageLimitPerUser: v })} type="number" />
              <Field label="Starts at" value={form.startsAt} onChange={(v) => setForm({ ...form, startsAt: v })} type="datetime-local" />
              <Field label="Expires at" value={form.expiresAt} onChange={(v) => setForm({ ...form, expiresAt: v })} type="datetime-local" />
            </div>

            <div>
              <label className="ff-apfel text-xs text-white/40 block mb-2 uppercase tracking-widest">Status</label>
              <div className="grid grid-cols-3 gap-2">
                {(['active', 'paused', 'archived'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, status: s })}
                    className={`px-3 py-2 rounded-lg ff-apfel text-xs capitalize transition-all border ${
                      form.status === s ? 'bg-primary-brown text-white border-primary-brown' : 'bg-white/5 text-white/50 hover:bg-white/10 border-white/10'
                    }`}
                  >
                    {form.status === s && <Check size={11} className="inline mr-1" />}{s}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-primary-brown text-white py-3.5 rounded-2xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin inline" size={18} /> : editing ? 'Update coupon' : 'Create coupon'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

function Field({
  label, value, onChange, type, required, placeholder, uppercase,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string; uppercase?: boolean;
}) {
  return (
    <div>
      <label className="ff-apfel text-[11px] text-white/40 block mb-1.5 uppercase tracking-widest">{label}</label>
      <input
        type={type ?? 'text'}
        required={required}
        value={value}
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:border-primary-brown transition-all ff-apfel text-sm text-white"
      />
    </div>
  )
}
