"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import { formatPkr, rupeesToMinor } from "@/lib/money"
import { CONTACT, addressOneLine } from "@/lib/contact"
import { Save, Globe, Shield, CreditCard, Bell, Palette, Loader2, Truck, Percent } from "lucide-react"

type TabId = "general" | "delivery" | "tax" | "payments" | "security" | "notifications" | "appearance"

type TaxRateRow = {
  id: string
  name: string
  rate_bp: number
  applies_to: string
  is_default: boolean
}

type DeliveryZoneRow = {
  id: string
  name: string
  city: string
  status: "active" | "paused"
}

type DeliveryMethodRow = {
  id: string
  zone_id: string | null
  name: string
  type: "flat" | "free_over" | "pickup" | "per_km"
  base_fee_minor: number
  min_order_minor: number
  free_over_minor: number | null
  eta_hours: number | null
  status: "active" | "paused"
}

type TaxForm = {
  name: string
  ratePercent: string
}

type DeliveryForm = {
  zoneName: string
  city: string
  status: DeliveryZoneRow["status"]
  methodName: string
  baseFeeRupees: string
  etaHours: string
  methodStatus: DeliveryMethodRow["status"]
}

const DEFAULT_TAX_FORM: TaxForm = {
  name: "No tax",
  ratePercent: "0",
}

const DEFAULT_DELIVERY_FORM: DeliveryForm = {
  zoneName: "Lahore",
  city: "Lahore",
  status: "active",
  methodName: "Standard Lahore delivery",
  baseFeeRupees: "99.00",
  etaHours: "24",
  methodStatus: "active",
}

// The DB-backed store settings the General tab edits. Shop address/phone live
// in src/lib/contact.ts (code, not DB), so they are shown read-only there.
type GeneralForm = {
  brandName: string
  supportEmail: string
  supportWhatsapp: string
  leadTimeHours: string
  codOnly: boolean
  reviewAutoPublish: boolean
}

const DEFAULT_GENERAL_FORM: GeneralForm = {
  brandName: "Kakeez",
  supportEmail: "",
  supportWhatsapp: "",
  leadTimeHours: "24",
  codOnly: true,
  reviewAutoPublish: false,
}

// store_settings.value is jsonb: strings arrive quoted, booleans/numbers raw.
function settingText(value: unknown): string {
  if (value == null) return ""
  return typeof value === "string" ? value : String(value)
}
function settingBool(value: unknown): boolean {
  return value === true || value === "true"
}

function settingsErrorMessage(raw: string): string {
  const head = raw.split(":")[0].trim()
  switch (head) {
    case "admin_required": return "Only an admin can change store settings."
    case "auth_required":  return "Your session expired. Sign in again."
    case "invalid_rate":   return "Tax rate must be between 0 and 100%."
    case "invalid_fee":    return "Delivery fee cannot be negative."
    case "invalid_eta":    return "ETA hours cannot be negative."
    case "invalid_status": return "That status is not supported."
    case "key_required":   return "Setting key is missing."
    default:               return raw
  }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<"tax" | "delivery" | "general" | null>(null)
  const [taxRow, setTaxRow] = useState<TaxRateRow | null>(null)
  const [zoneRow, setZoneRow] = useState<DeliveryZoneRow | null>(null)
  const [methodRow, setMethodRow] = useState<DeliveryMethodRow | null>(null)
  const [taxForm, setTaxForm] = useState<TaxForm>(DEFAULT_TAX_FORM)
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>(DEFAULT_DELIVERY_FORM)
  const [generalForm, setGeneralForm] = useState<GeneralForm>(DEFAULT_GENERAL_FORM)
  const toast = useToast()

  const tabs: { id: TabId; label: string; icon: typeof Globe }[] = [
    { id: "general", label: "General", icon: Globe },
    { id: "delivery", label: "Delivery", icon: Truck },
    { id: "tax", label: "Tax", icon: Percent },
    { id: "payments", label: "Payments", icon: CreditCard },
    { id: "security", label: "Security", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "appearance", label: "Appearance", icon: Palette },
  ]

  const load = async () => {
    setLoading(true)

    // store_settings is readable only through the admin RPC (the table's own
    // SELECT policy exposes just a public allow-list of keys).
    const { data: settingsData, error: settingsError } = await supabase.rpc('admin_list_store_settings')
    if (settingsError) {
      toast.push({ kind: "warn", title: "Could not load store settings", body: settingsError.message })
    } else {
      const map = new Map(((settingsData as { key: string; value: unknown }[] | null) ?? []).map((r) => [r.key, r.value]))
      setGeneralForm({
        brandName: settingText(map.get('brand_name')) || DEFAULT_GENERAL_FORM.brandName,
        supportEmail: settingText(map.get('support_email')),
        supportWhatsapp: settingText(map.get('support.whatsapp_e164')),
        leadTimeHours: settingText(map.get('default_lead_time_hours')) || '24',
        codOnly: settingBool(map.get('cod_only')),
        reviewAutoPublish: settingBool(map.get('review.auto_publish')),
      })
    }

    const { data: taxData, error: taxError } = await supabase
      .from("tax_rates")
      .select("id, name, rate_bp, applies_to, is_default")
      .eq("is_default", true)
      .limit(1)
      .maybeSingle()

    if (taxError) {
      toast.push({ kind: "warn", title: "Could not load tax settings", body: taxError.message })
    } else if (taxData) {
      const row = taxData as TaxRateRow
      setTaxRow(row)
      setTaxForm({ name: row.name, ratePercent: (row.rate_bp / 100).toString() })
    }

    const { data: zones, error: zoneError } = await supabase
      .from("delivery_zones")
      .select("id, name, city, status")
      .order("created_at", { ascending: true })
      .limit(1)

    if (zoneError) {
      toast.push({ kind: "warn", title: "Could not load delivery zones", body: zoneError.message })
      setLoading(false)
      return
    }

    const zone = ((zones as DeliveryZoneRow[] | null) ?? [])[0] ?? null
    setZoneRow(zone)

    if (zone) {
      setDeliveryForm((prev) => ({
        ...prev,
        zoneName: zone.name,
        city: zone.city,
        status: zone.status,
      }))

      const { data: methods, error: methodError } = await supabase
        .from("delivery_methods")
        .select("id, zone_id, name, type, base_fee_minor, min_order_minor, free_over_minor, eta_hours, status")
        .eq("zone_id", zone.id)
        .order("created_at", { ascending: true })
        .limit(1)

      if (methodError) {
        toast.push({ kind: "warn", title: "Could not load delivery method", body: methodError.message })
      } else {
        const method = ((methods as DeliveryMethodRow[] | null) ?? [])[0] ?? null
        setMethodRow(method)
        if (method) {
          setDeliveryForm((prev) => ({
            ...prev,
            methodName: method.name,
            baseFeeRupees: (method.base_fee_minor / 100).toFixed(2),
            etaHours: method.eta_hours?.toString() ?? "",
            methodStatus: method.status,
          }))
        }
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveTax = async () => {
    setSaving("tax")
    const rateNumber = Number(taxForm.ratePercent)
    if (!Number.isFinite(rateNumber) || rateNumber < 0) {
      toast.push({ kind: "warn", title: "Invalid tax rate" })
      setSaving(null)
      return
    }

    // tax_rates has INSERT/UPDATE REVOKEd from `authenticated`; the RPC is the
    // supported write path and re-validates the rate server-side.
    const { data, error } = await supabase.rpc('admin_save_tax_rate', {
      p_id: taxRow?.id ?? null,
      p_name: taxForm.name.trim() || "Default tax",
      p_rate_bp: Math.round(rateNumber * 100),
    })

    if (error) {
      toast.push({ kind: "warn", title: "Could not save tax settings", body: settingsErrorMessage(error.message) })
    } else {
      const row = data as TaxRateRow
      setTaxRow(row)
      setTaxForm({ name: row.name, ratePercent: (row.rate_bp / 100).toString() })
      toast.push({ kind: "success", title: "Tax settings saved" })
    }
    setSaving(null)
  }

  const saveGeneral = async () => {
    setSaving("general")
    const lead = Number(generalForm.leadTimeHours)
    if (!Number.isInteger(lead) || lead < 0) {
      toast.push({ kind: "warn", title: "Lead time must be a whole number of hours" })
      setSaving(null)
      return
    }

    // store_settings.value is jsonb, so strings are passed as JSON strings.
    const entries: [string, unknown][] = [
      ['brand_name', generalForm.brandName.trim()],
      ['support_email', generalForm.supportEmail.trim()],
      ['support.whatsapp_e164', generalForm.supportWhatsapp.trim()],
      ['default_lead_time_hours', lead],
      ['cod_only', generalForm.codOnly],
      ['review.auto_publish', generalForm.reviewAutoPublish],
    ]

    for (const [key, value] of entries) {
      const { error } = await supabase.rpc('admin_set_store_setting', { p_key: key, p_value: value })
      if (error) {
        toast.push({ kind: "warn", title: `Could not save ${key}`, body: settingsErrorMessage(error.message) })
        setSaving(null)
        return
      }
    }

    toast.push({ kind: "success", title: "Store settings saved" })
    setSaving(null)
  }

  const saveDelivery = async () => {
    setSaving("delivery")
    let baseFeeMinor = 0
    try {
      baseFeeMinor = rupeesToMinor(deliveryForm.baseFeeRupees || "0")
    } catch (err) {
      toast.push({ kind: "warn", title: "Invalid delivery fee", body: err instanceof Error ? err.message : "Unknown error" })
      setSaving(null)
      return
    }

    const etaHours = deliveryForm.etaHours ? Number(deliveryForm.etaHours) : null
    if (etaHours != null && (!Number.isInteger(etaHours) || etaHours < 0)) {
      toast.push({ kind: "warn", title: "ETA must be a whole number of hours" })
      setSaving(null)
      return
    }

    // delivery_zones + delivery_methods are both REVOKEd from `authenticated`.
    // One RPC saves the pair together so a half-save can't strand a method
    // pointing at a zone that failed to write.
    const { data, error } = await supabase.rpc('admin_save_delivery', {
      p_zone_id: zoneRow?.id ?? null,
      p_zone_name: deliveryForm.zoneName.trim() || "Delivery zone",
      p_city: deliveryForm.city.trim() || "Lahore",
      p_zone_status: deliveryForm.status,
      p_method_id: methodRow?.id ?? null,
      p_method_name: deliveryForm.methodName.trim() || "Standard delivery",
      p_base_fee_minor: baseFeeMinor,
      p_eta_hours: etaHours,
      p_method_status: deliveryForm.methodStatus,
    })

    if (error) {
      toast.push({ kind: "warn", title: "Could not save delivery settings", body: settingsErrorMessage(error.message) })
    } else {
      const result = data as { zone: DeliveryZoneRow; method: DeliveryMethodRow }
      const savedZone = result.zone
      const method = result.method
      setZoneRow(savedZone)
      setMethodRow(method)
      setDeliveryForm((prev) => ({
        ...prev,
        zoneName: savedZone.name,
        city: savedZone.city,
        status: savedZone.status,
        methodName: method.name,
        baseFeeRupees: (method.base_fee_minor / 100).toFixed(2),
        etaHours: method.eta_hours?.toString() ?? "",
        methodStatus: method.status,
      }))
      toast.push({ kind: "success", title: "Delivery settings saved" })
    }

    setSaving(null)
  }

  const inputCls = "w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white outline-none transition-all ff-apfel placeholder:text-white/25 focus:border-primary-brown"
  const labelCls = "text-sm text-white/35 ff-apfel"
  const panelCls = "rounded-2xl border border-white/10 bg-white/[0.03] p-5"
  let previewDeliveryFeeMinor = methodRow?.base_fee_minor ?? 0
  try {
    previewDeliveryFeeMinor = rupeesToMinor(deliveryForm.baseFeeRupees || "0")
  } catch {
    previewDeliveryFeeMinor = methodRow?.base_fee_minor ?? 0
  }
  const previewTaxRate = Number.isFinite(Number(taxForm.ratePercent)) ? Number(taxForm.ratePercent) : 0

  return (
    <div className="space-y-8">
      <div>
        <p className="admin-pill mb-3 inline-flex rounded-full px-3 py-1 ff-apfel text-[11px] uppercase tracking-[0.16em]">Store configuration</p>
        <h1 className="text-3xl font-bold ff-accia text-primary-brown">Settings</h1>
        <p className="text-white/50 ff-apfel mt-1">Configure your bakeshop&apos;s preferences and security.</p>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:gap-10">
        <aside className="grid gap-2 sm:grid-cols-2 xl:w-64 xl:grid-cols-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all ff-apfel text-sm ${
                activeTab === tab.id
                  ? "bg-primary-brown text-white shadow-lg shadow-primary-brown/20"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </aside>

        <main className="admin-card min-h-[520px] flex-1 rounded-3xl p-6 md:p-10">
          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center text-primary-brown">
              <Loader2 className="animate-spin" size={34} />
            </div>
          ) : activeTab === "general" ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold ff-accia text-white">General Settings</h2>
                  <p className="mt-1 ff-apfel text-sm text-white/45">Stored in the database and read by the storefront.</p>
                </div>
                <button onClick={saveGeneral} disabled={saving === "general"} className="flex items-center justify-center gap-2 rounded-2xl bg-primary-brown px-6 py-3 text-white transition-all ff-apfel font-bold hover:bg-primary-brown/90 disabled:opacity-60">
                  {saving === "general" ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save
                </button>
              </div>

              <div className={panelCls}>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className={labelCls}>Brand Name</label>
                    <input value={generalForm.brandName} onChange={(e) => setGeneralForm((f) => ({ ...f, brandName: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Support Email</label>
                    <input value={generalForm.supportEmail} onChange={(e) => setGeneralForm((f) => ({ ...f, supportEmail: e.target.value }))} placeholder="hello@kakeez.com" className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Support WhatsApp (E.164)</label>
                    <input value={generalForm.supportWhatsapp} onChange={(e) => setGeneralForm((f) => ({ ...f, supportWhatsapp: e.target.value }))} placeholder="923174304211" className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Default Lead Time (hours)</label>
                    <input value={generalForm.leadTimeHours} onChange={(e) => setGeneralForm((f) => ({ ...f, leadTimeHours: e.target.value }))} inputMode="numeric" className={inputCls} />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                    <input type="checkbox" checked={generalForm.codOnly} onChange={(e) => setGeneralForm((f) => ({ ...f, codOnly: e.target.checked }))} className="h-4 w-4 accent-primary-brown" />
                    <span className="ff-apfel text-sm text-white/70">Cash on delivery only</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                    <input type="checkbox" checked={generalForm.reviewAutoPublish} onChange={(e) => setGeneralForm((f) => ({ ...f, reviewAutoPublish: e.target.checked }))} className="h-4 w-4 accent-primary-brown" />
                    <span className="ff-apfel text-sm text-white/70">Auto-publish new reviews</span>
                  </label>
                </div>
              </div>

              <div className={panelCls}>
                <h3 className="mb-2 ff-accia text-xl text-white">Storefront contact</h3>
                <p className="ff-apfel text-sm text-white/45">
                  The public address and phone live in code (<code className="text-primary-brown">src/lib/contact.ts</code>) so they stay
                  consistent across the footer, contact page and business schema. Edit them there and redeploy.
                </p>
                <div className="mt-4 space-y-1 ff-apfel text-sm text-white/70">
                  <div>{CONTACT.email}</div>
                  <div>{CONTACT.phone}</div>
                  <div>{addressOneLine}</div>
                </div>
              </div>
            </div>
          ) : activeTab === "delivery" ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold ff-accia text-white">Delivery</h2>
                  <p className="mt-1 ff-apfel text-sm text-white/45">Current checkout fee: {formatPkr(previewDeliveryFeeMinor)}</p>
                </div>
                <button onClick={saveDelivery} disabled={saving === "delivery"} className="flex items-center justify-center gap-2 rounded-2xl bg-primary-brown px-6 py-3 text-white transition-all ff-apfel font-bold hover:bg-primary-brown/90 disabled:opacity-60">
                  {saving === "delivery" ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save
                </button>
              </div>

              <div className={panelCls}>
                <h3 className="mb-4 ff-accia text-xl text-white">Zone</h3>
                <div className="grid gap-5 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className={labelCls}>Zone Name</label>
                    <input value={deliveryForm.zoneName} onChange={(e) => setDeliveryForm((f) => ({ ...f, zoneName: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>City</label>
                    <input value={deliveryForm.city} onChange={(e) => setDeliveryForm((f) => ({ ...f, city: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Status</label>
                    <select value={deliveryForm.status} onChange={(e) => setDeliveryForm((f) => ({ ...f, status: e.target.value as DeliveryZoneRow["status"] }))} className={inputCls}>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={panelCls}>
                <h3 className="mb-4 ff-accia text-xl text-white">Method</h3>
                <div className="grid gap-5 md:grid-cols-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className={labelCls}>Method Name</label>
                    <input value={deliveryForm.methodName} onChange={(e) => setDeliveryForm((f) => ({ ...f, methodName: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Flat Fee</label>
                    <input value={deliveryForm.baseFeeRupees} onChange={(e) => setDeliveryForm((f) => ({ ...f, baseFeeRupees: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>ETA Hours</label>
                    <input value={deliveryForm.etaHours} onChange={(e) => setDeliveryForm((f) => ({ ...f, etaHours: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Method Status</label>
                    <select value={deliveryForm.methodStatus} onChange={(e) => setDeliveryForm((f) => ({ ...f, methodStatus: e.target.value as DeliveryMethodRow["status"] }))} className={inputCls}>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "tax" ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold ff-accia text-white">Tax</h2>
                  <p className="mt-1 ff-apfel text-sm text-white/45">Default checkout rate: {previewTaxRate}%</p>
                </div>
                <button onClick={saveTax} disabled={saving === "tax"} className="flex items-center justify-center gap-2 rounded-2xl bg-primary-brown px-6 py-3 text-white transition-all ff-apfel font-bold hover:bg-primary-brown/90 disabled:opacity-60">
                  {saving === "tax" ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save
                </button>
              </div>

              <div className={panelCls}>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className={labelCls}>Rate Name</label>
                    <input value={taxForm.name} onChange={(e) => setTaxForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Rate Percent</label>
                    <input value={taxForm.ratePercent} onChange={(e) => setTaxForm((f) => ({ ...f, ratePercent: e.target.value }))} className={inputCls} />
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "payments" ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-2xl font-bold ff-accia text-white">Payments</h2>
              <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
                <div className="flex items-center gap-3 ff-apfel text-amber-300 font-bold uppercase text-xs tracking-widest">
                  <CreditCard size={18} />
                  Cash on Delivery only - at launch
                </div>
                <p className="ff-apfel text-white/70 leading-relaxed">
                  Online payment providers (Card, JazzCash, Easypaisa) are not enabled yet. To enable them, contact engineering.
                </p>
                <p className="ff-apfel text-white/50 text-sm leading-relaxed">
                  COD-specific controls - daily order caps, first-order value limit, blocklist - will live under <span className="text-primary-brown">Operations - COD Risk</span>.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-white/20">
              {(() => {
                const currentTab = tabs.find((t) => t.id === activeTab)
                if (!currentTab) return null
                const Icon = currentTab.icon
                return <Icon size={64} className="mb-4" />
              })()}
              <p className="ff-accia text-xl">Module Coming Soon</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
