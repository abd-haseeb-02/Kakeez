"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import { Check, Edit3, FolderTree, Loader2, Palette, Plus, Save, Tags, Trash2, X } from "lucide-react"

type CategoryRow = {
  id: string
  parent_id: string | null
  name: string
  slug: string
  description: string | null
  image_storage_path: string | null
  position: number
  status: "published" | "archived"
}

type AttributeRow = {
  id: string
  slug: string
  label: string
  label_ur: string | null
  kind: "single_select" | "multi_select"
  display_order: number
}

type AttributeValueRow = {
  id: string
  attribute_id: string
  slug: string
  label: string
  label_ur: string | null
  swatch_hex: string | null
  display_order: number
  is_active: boolean
}

type CategoryForm = {
  name: string
  slug: string
  parentId: string
  description: string
  imageUrl: string
  position: string
  status: CategoryRow["status"]
}

type AttributeForm = {
  label: string
  slug: string
  kind: AttributeRow["kind"]
  displayOrder: string
}

type ValueForm = {
  label: string
  slug: string
  swatchHex: string
  displayOrder: string
  isActive: boolean
}

const DEFAULT_CATEGORY: CategoryForm = {
  name: "",
  slug: "",
  parentId: "",
  description: "",
  imageUrl: "",
  position: "0",
  status: "published",
}

const DEFAULT_ATTRIBUTE: AttributeForm = {
  label: "",
  slug: "",
  kind: "single_select",
  displayOrder: "0",
}

const DEFAULT_VALUE: ValueForm = {
  label: "",
  slug: "",
  swatchHex: "",
  displayOrder: "0",
  isActive: true,
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export default function CatalogPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [attributes, setAttributes] = useState<AttributeRow[]>([])
  const [values, setValues] = useState<AttributeValueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activePane, setActivePane] = useState<"categories" | "attributes">("categories")
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(DEFAULT_CATEGORY)
  const [attributeForm, setAttributeForm] = useState<AttributeForm>(DEFAULT_ATTRIBUTE)
  const [valueForm, setValueForm] = useState<ValueForm>(DEFAULT_VALUE)
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null)
  const [editingAttribute, setEditingAttribute] = useState<AttributeRow | null>(null)
  const [editingValue, setEditingValue] = useState<AttributeValueRow | null>(null)
  const [selectedAttributeId, setSelectedAttributeId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    const [catRes, attrRes, valueRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, parent_id, name, slug, description, image_storage_path, position, status")
        .order("position", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("attributes")
        .select("id, slug, label, label_ur, kind, display_order")
        .order("display_order", { ascending: true })
        .order("label", { ascending: true }),
      supabase
        .from("attribute_values")
        .select("id, attribute_id, slug, label, label_ur, swatch_hex, display_order, is_active")
        .order("display_order", { ascending: true })
        .order("label", { ascending: true }),
    ])

    if (catRes.error) toast.push({ kind: "warn", title: "Could not load categories", body: catRes.error.message })
    else setCategories((catRes.data as CategoryRow[] | null) ?? [])

    if (attrRes.error) toast.push({ kind: "warn", title: "Could not load attributes", body: attrRes.error.message })
    else {
      const rows = (attrRes.data as AttributeRow[] | null) ?? []
      setAttributes(rows)
      setSelectedAttributeId((current) => current || rows[0]?.id || "")
    }

    if (valueRes.error) toast.push({ kind: "warn", title: "Could not load attribute values", body: valueRes.error.message })
    else setValues((valueRes.data as AttributeValueRow[] | null) ?? [])

    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  )

  const selectedAttribute = attributes.find((attribute) => attribute.id === selectedAttributeId) ?? null
  const selectedValues = values.filter((value) => value.attribute_id === selectedAttributeId)

  const resetCategory = () => {
    setEditingCategory(null)
    setCategoryForm(DEFAULT_CATEGORY)
  }

  const resetAttribute = () => {
    setEditingAttribute(null)
    setAttributeForm(DEFAULT_ATTRIBUTE)
  }

  const resetValue = () => {
    setEditingValue(null)
    setValueForm(DEFAULT_VALUE)
  }

  const editCategory = (category: CategoryRow) => {
    setEditingCategory(category)
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      parentId: category.parent_id ?? "",
      description: category.description ?? "",
      imageUrl: category.image_storage_path ?? "",
      position: category.position.toString(),
      status: category.status,
    })
  }

  const saveCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const name = categoryForm.name.trim()
    const slug = categoryForm.slug.trim() || slugify(name)
    if (!name || !slug) {
      toast.push({ kind: "warn", title: "Category needs a name" })
      setSaving(false)
      return
    }

    const payload = {
      name,
      slug,
      parent_id: categoryForm.parentId || null,
      description: categoryForm.description.trim() || null,
      image_storage_path: categoryForm.imageUrl.trim() || null,
      position: Number(categoryForm.position) || 0,
      status: categoryForm.status,
    }

    const result = editingCategory
      ? await supabase.from("categories").update(payload).eq("id", editingCategory.id).select("id, parent_id, name, slug, description, image_storage_path, position, status").single()
      : await supabase.from("categories").insert(payload).select("id, parent_id, name, slug, description, image_storage_path, position, status").single()

    if (result.error) {
      toast.push({ kind: "warn", title: "Could not save category", body: result.error.message })
    } else {
      const row = result.data as CategoryRow
      setCategories((prev) => editingCategory ? prev.map((category) => category.id === row.id ? row : category) : [...prev, row])
      resetCategory()
      toast.push({ kind: "success", title: editingCategory ? "Category updated" : "Category created" })
    }
    setSaving(false)
  }

  const removeCategory = async (category: CategoryRow) => {
    if (!confirm(`Delete category "${category.name}"? Products attached to it will block deletion.`)) return
    const { error } = await supabase.from("categories").delete().eq("id", category.id)
    if (error) {
      toast.push({ kind: "warn", title: "Could not delete category", body: error.message })
      return
    }
    setCategories((prev) => prev.filter((row) => row.id !== category.id))
    if (editingCategory?.id === category.id) resetCategory()
    toast.push({ kind: "success", title: "Category deleted" })
  }

  const editAttribute = (attribute: AttributeRow) => {
    setEditingAttribute(attribute)
    setSelectedAttributeId(attribute.id)
    setAttributeForm({
      label: attribute.label,
      slug: attribute.slug,
      kind: attribute.kind,
      displayOrder: attribute.display_order.toString(),
    })
    resetValue()
  }

  const saveAttribute = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    const label = attributeForm.label.trim()
    const slug = attributeForm.slug.trim() || slugify(label)
    if (!label || !slug) {
      toast.push({ kind: "warn", title: "Attribute needs a label" })
      setSaving(false)
      return
    }

    const payload = {
      label,
      slug,
      kind: attributeForm.kind,
      display_order: Number(attributeForm.displayOrder) || 0,
    }

    const result = editingAttribute
      ? await supabase.from("attributes").update(payload).eq("id", editingAttribute.id).select("id, slug, label, label_ur, kind, display_order").single()
      : await supabase.from("attributes").insert(payload).select("id, slug, label, label_ur, kind, display_order").single()

    if (result.error) {
      toast.push({ kind: "warn", title: "Could not save attribute", body: result.error.message })
    } else {
      const row = result.data as AttributeRow
      setAttributes((prev) => editingAttribute ? prev.map((attribute) => attribute.id === row.id ? row : attribute) : [...prev, row])
      setSelectedAttributeId(row.id)
      resetAttribute()
      toast.push({ kind: "success", title: editingAttribute ? "Attribute updated" : "Attribute created" })
    }
    setSaving(false)
  }

  const removeAttribute = async (attribute: AttributeRow) => {
    if (!confirm(`Delete attribute "${attribute.label}" and all of its values?`)) return
    const { error } = await supabase.from("attributes").delete().eq("id", attribute.id)
    if (error) {
      toast.push({ kind: "warn", title: "Could not delete attribute", body: error.message })
      return
    }
    setAttributes((prev) => prev.filter((row) => row.id !== attribute.id))
    setValues((prev) => prev.filter((row) => row.attribute_id !== attribute.id))
    if (selectedAttributeId === attribute.id) setSelectedAttributeId(attributes.find((row) => row.id !== attribute.id)?.id ?? "")
    if (editingAttribute?.id === attribute.id) resetAttribute()
    toast.push({ kind: "success", title: "Attribute deleted" })
  }

  const editValue = (value: AttributeValueRow) => {
    setEditingValue(value)
    setValueForm({
      label: value.label,
      slug: value.slug,
      swatchHex: value.swatch_hex ?? "",
      displayOrder: value.display_order.toString(),
      isActive: value.is_active,
    })
  }

  const saveValue = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedAttributeId) return
    setSaving(true)
    const label = valueForm.label.trim()
    const slug = valueForm.slug.trim() || slugify(label)
    if (!label || !slug) {
      toast.push({ kind: "warn", title: "Value needs a label" })
      setSaving(false)
      return
    }

    const payload = {
      attribute_id: selectedAttributeId,
      label,
      slug,
      swatch_hex: valueForm.swatchHex.trim() || null,
      display_order: Number(valueForm.displayOrder) || 0,
      is_active: valueForm.isActive,
    }

    const result = editingValue
      ? await supabase.from("attribute_values").update(payload).eq("id", editingValue.id).select("id, attribute_id, slug, label, label_ur, swatch_hex, display_order, is_active").single()
      : await supabase.from("attribute_values").insert(payload).select("id, attribute_id, slug, label, label_ur, swatch_hex, display_order, is_active").single()

    if (result.error) {
      toast.push({ kind: "warn", title: "Could not save value", body: result.error.message })
    } else {
      const row = result.data as AttributeValueRow
      setValues((prev) => editingValue ? prev.map((value) => value.id === row.id ? row : value) : [...prev, row])
      resetValue()
      toast.push({ kind: "success", title: editingValue ? "Value updated" : "Value created" })
    }
    setSaving(false)
  }

  const removeValue = async (value: AttributeValueRow) => {
    if (!confirm(`Delete value "${value.label}"? Existing variations can block deletion.`)) return
    const { error } = await supabase.from("attribute_values").delete().eq("id", value.id)
    if (error) {
      toast.push({ kind: "warn", title: "Could not delete value", body: error.message })
      return
    }
    setValues((prev) => prev.filter((row) => row.id !== value.id))
    if (editingValue?.id === value.id) resetValue()
    toast.push({ kind: "success", title: "Value deleted" })
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition-all ff-apfel placeholder:text-white/25 focus:border-primary-brown"
  const labelCls = "text-xs uppercase tracking-[0.16em] text-white/35 ff-apfel"
  const cardCls = "rounded-2xl border border-white/10 bg-white/[0.035] p-5"

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="admin-pill mb-3 inline-flex rounded-full px-3 py-1 ff-apfel text-[11px] uppercase tracking-[0.16em]">Catalog foundation</p>
          <h1 className="text-3xl font-bold ff-accia text-primary-brown">Catalog</h1>
          <p className="mt-1 ff-apfel text-white/50">Manage categories, attributes, and the reusable option values that power product variations.</p>
        </div>
        <div className="inline-flex rounded-2xl bg-white/5 p-1">
          <button onClick={() => setActivePane("categories")} className={`flex items-center gap-2 rounded-xl px-4 py-2 ff-apfel text-sm transition-all ${activePane === "categories" ? "bg-primary-brown text-white" : "text-white/50 hover:text-white"}`}>
            <FolderTree size={16} />
            Categories
          </button>
          <button onClick={() => setActivePane("attributes")} className={`flex items-center gap-2 rounded-xl px-4 py-2 ff-apfel text-sm transition-all ${activePane === "attributes" ? "bg-primary-brown text-white" : "text-white/50 hover:text-white"}`}>
            <Tags size={16} />
            Attributes
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-card flex min-h-[420px] items-center justify-center rounded-3xl text-primary-brown">
          <Loader2 className="animate-spin" size={36} />
        </div>
      ) : activePane === "categories" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="admin-card rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="ff-accia text-2xl text-white">Categories</h2>
              <span className="ff-apfel text-sm text-white/35">{categories.length} total</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10">
              {categories.map((category) => (
                <div key={category.id} className="grid gap-4 border-b border-white/10 p-4 last:border-b-0 md:grid-cols-[1fr_150px_100px_90px] md:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="ff-accia text-xl text-white">{category.name}</p>
                      {category.status === "published" && <Check size={14} className="text-emerald-300" />}
                    </div>
                    <p className="mt-1 ff-apfel text-xs text-white/35">/{category.slug}{category.parent_id ? ` - child of ${categoryNameById.get(category.parent_id) ?? "Unknown"}` : ""}</p>
                    {category.description && <p className="mt-2 line-clamp-2 ff-apfel text-sm text-white/45">{category.description}</p>}
                  </div>
                  <span className="ff-apfel text-sm text-white/45">{category.parent_id ? categoryNameById.get(category.parent_id) ?? "Unknown" : "Top level"}</span>
                  <span className="ff-apfel text-sm text-white/45">#{category.position}</span>
                  <div className="flex items-center gap-2 md:justify-end">
                    <button onClick={() => editCategory(category)} className="rounded-lg bg-white/10 p-2 text-white/60 transition-colors hover:text-primary-brown" aria-label="Edit category"><Edit3 size={15} /></button>
                    <button onClick={() => void removeCategory(category)} className="rounded-lg bg-white/10 p-2 text-white/60 transition-colors hover:text-red-300" aria-label="Delete category"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p className="p-10 text-center ff-apfel text-white/40">No categories yet.</p>}
            </div>
          </div>

          <form onSubmit={saveCategory} className={`${cardCls} self-start`}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="ff-accia text-2xl text-white">{editingCategory ? "Edit Category" : "New Category"}</h2>
              {editingCategory && <button type="button" onClick={resetCategory} className="rounded-lg bg-white/10 p-2 text-white/60 hover:text-white" aria-label="Cancel edit"><X size={16} /></button>}
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className={labelCls}>Name</label>
                <input value={categoryForm.name} onChange={(e) => setCategoryForm((form) => ({ ...form, name: e.target.value, slug: form.slug || slugify(e.target.value) }))} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Slug</label>
                <input value={categoryForm.slug} onChange={(e) => setCategoryForm((form) => ({ ...form, slug: slugify(e.target.value) }))} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Parent</label>
                <select value={categoryForm.parentId} onChange={(e) => setCategoryForm((form) => ({ ...form, parentId: e.target.value }))} className={inputCls}>
                  <option value="">Top level</option>
                  {categories.filter((category) => category.id !== editingCategory?.id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Description</label>
                <textarea value={categoryForm.description} onChange={(e) => setCategoryForm((form) => ({ ...form, description: e.target.value }))} className={`${inputCls} h-24 resize-none`} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelCls}>Position</label>
                  <input value={categoryForm.position} onChange={(e) => setCategoryForm((form) => ({ ...form, position: e.target.value }))} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Status</label>
                  <select value={categoryForm.status} onChange={(e) => setCategoryForm((form) => ({ ...form, status: e.target.value as CategoryRow["status"] }))} className={inputCls}>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-brown px-5 py-3 ff-apfel font-bold text-white transition-all hover:bg-primary-brown/90 disabled:opacity-60">
                {saving ? <Loader2 className="animate-spin" size={18} /> : editingCategory ? <Save size={18} /> : <Plus size={18} />}
                {editingCategory ? "Save Category" : "Create Category"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_400px]">
          <div className="space-y-4">
            <form onSubmit={saveAttribute} className={cardCls}>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="ff-accia text-2xl text-white">{editingAttribute ? "Edit Attribute" : "New Attribute"}</h2>
                {editingAttribute && <button type="button" onClick={resetAttribute} className="rounded-lg bg-white/10 p-2 text-white/60 hover:text-white" aria-label="Cancel edit"><X size={16} /></button>}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={labelCls}>Label</label>
                  <input value={attributeForm.label} onChange={(e) => setAttributeForm((form) => ({ ...form, label: e.target.value, slug: form.slug || slugify(e.target.value) }))} className={inputCls} />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Slug</label>
                  <input value={attributeForm.slug} onChange={(e) => setAttributeForm((form) => ({ ...form, slug: slugify(e.target.value) }))} className={inputCls} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className={labelCls}>Kind</label>
                    <select value={attributeForm.kind} onChange={(e) => setAttributeForm((form) => ({ ...form, kind: e.target.value as AttributeRow["kind"] }))} className={inputCls}>
                      <option value="single_select">Single select</option>
                      <option value="multi_select">Multi select</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className={labelCls}>Order</label>
                    <input value={attributeForm.displayOrder} onChange={(e) => setAttributeForm((form) => ({ ...form, displayOrder: e.target.value }))} className={inputCls} />
                  </div>
                </div>
                <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-brown px-5 py-3 ff-apfel font-bold text-white transition-all hover:bg-primary-brown/90 disabled:opacity-60">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : editingAttribute ? <Save size={18} /> : <Plus size={18} />}
                  {editingAttribute ? "Save Attribute" : "Create Attribute"}
                </button>
              </div>
            </form>

            <div className={cardCls}>
              <h2 className="mb-4 ff-accia text-2xl text-white">Attributes</h2>
              <div className="space-y-2">
                {attributes.map((attribute) => (
                  <button key={attribute.id} onClick={() => setSelectedAttributeId(attribute.id)} className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all ${selectedAttributeId === attribute.id ? "bg-primary-brown text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
                    <span>
                      <span className="block ff-accia text-lg">{attribute.label}</span>
                      <span className="ff-apfel text-xs opacity-60">{attribute.slug}</span>
                    </span>
                    <span className="ff-apfel text-xs opacity-60">{values.filter((value) => value.attribute_id === attribute.id).length}</span>
                  </button>
                ))}
                {attributes.length === 0 && <p className="py-8 text-center ff-apfel text-white/35">No attributes yet.</p>}
              </div>
            </div>
          </div>

          <div className="admin-card rounded-3xl p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="ff-accia text-2xl text-white">{selectedAttribute?.label ?? "Attribute Values"}</h2>
                <p className="mt-1 ff-apfel text-sm text-white/40">{selectedAttribute ? `${selectedValues.length} reusable values` : "Create or select an attribute first."}</p>
              </div>
              {selectedAttribute && (
                <div className="flex items-center gap-2">
                  <button onClick={() => editAttribute(selectedAttribute)} className="rounded-lg bg-white/10 p-2 text-white/60 transition-colors hover:text-primary-brown" aria-label="Edit attribute"><Edit3 size={15} /></button>
                  <button onClick={() => void removeAttribute(selectedAttribute)} className="rounded-lg bg-white/10 p-2 text-white/60 transition-colors hover:text-red-300" aria-label="Delete attribute"><Trash2 size={15} /></button>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              {selectedValues.map((value) => (
                <div key={value.id} className="grid gap-4 border-b border-white/10 p-4 last:border-b-0 md:grid-cols-[1fr_100px_90px] md:items-center">
                  <div className="flex items-center gap-3">
                    <span className="h-5 w-5 rounded-full border border-white/20" style={{ backgroundColor: value.swatch_hex ?? "transparent" }} />
                    <div>
                      <p className="ff-accia text-lg text-white">{value.label}</p>
                      <p className="ff-apfel text-xs text-white/35">{value.slug}{!value.is_active ? " - inactive" : ""}</p>
                    </div>
                  </div>
                  <span className="ff-apfel text-sm text-white/45">#{value.display_order}</span>
                  <div className="flex items-center gap-2 md:justify-end">
                    <button onClick={() => editValue(value)} className="rounded-lg bg-white/10 p-2 text-white/60 transition-colors hover:text-primary-brown" aria-label="Edit value"><Edit3 size={15} /></button>
                    <button onClick={() => void removeValue(value)} className="rounded-lg bg-white/10 p-2 text-white/60 transition-colors hover:text-red-300" aria-label="Delete value"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              {selectedAttribute && selectedValues.length === 0 && <p className="p-10 text-center ff-apfel text-white/35">No values yet.</p>}
            </div>
          </div>

          <form onSubmit={saveValue} className={`${cardCls} self-start`}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="ff-accia text-2xl text-white">{editingValue ? "Edit Value" : "New Value"}</h2>
              {editingValue && <button type="button" onClick={resetValue} className="rounded-lg bg-white/10 p-2 text-white/60 hover:text-white" aria-label="Cancel edit"><X size={16} /></button>}
            </div>
            <fieldset disabled={!selectedAttributeId} className="space-y-4 disabled:opacity-40">
              <div className="space-y-2">
                <label className={labelCls}>Label</label>
                <input value={valueForm.label} onChange={(e) => setValueForm((form) => ({ ...form, label: e.target.value, slug: form.slug || slugify(e.target.value) }))} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className={labelCls}>Slug</label>
                <input value={valueForm.slug} onChange={(e) => setValueForm((form) => ({ ...form, slug: slugify(e.target.value) }))} className={inputCls} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelCls}>Swatch</label>
                  <div className="flex gap-2">
                    <input value={valueForm.swatchHex} onChange={(e) => setValueForm((form) => ({ ...form, swatchHex: e.target.value }))} placeholder="#d8b08c" className={inputCls} />
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      {valueForm.swatchHex ? <span className="h-6 w-6 rounded-full border border-white/20" style={{ backgroundColor: valueForm.swatchHex }} /> : <Palette size={18} className="text-white/25" />}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Order</label>
                  <input value={valueForm.displayOrder} onChange={(e) => setValueForm((form) => ({ ...form, displayOrder: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <label className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 ff-apfel text-sm text-white/70">
                Active
                <input type="checkbox" checked={valueForm.isActive} onChange={(e) => setValueForm((form) => ({ ...form, isActive: e.target.checked }))} className="h-4 w-4 accent-primary-brown" />
              </label>
              <button disabled={saving || !selectedAttributeId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-brown px-5 py-3 ff-apfel font-bold text-white transition-all hover:bg-primary-brown/90 disabled:opacity-60">
                {saving ? <Loader2 className="animate-spin" size={18} /> : editingValue ? <Save size={18} /> : <Plus size={18} />}
                {editingValue ? "Save Value" : "Create Value"}
              </button>
            </fieldset>
          </form>
        </div>
      )}
    </div>
  )
}
