"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { rupeesToMinor, formatPkr } from "@/lib/money"
import {
  Plus, Trash2, Edit3, Loader2, X, Image as ImageIcon, FolderPlus,
  Check, Settings2,
} from "lucide-react"

// Admin product editor — Phase 2 revamp on top of the new schema.
//
// Phase 2 scope = single hero image + single category per product, server
// status (draft/published/archived), is_perishable, integer-minor pricing.
// Multi-image gallery, multi-category M:M, and the variations matrix-builder
// land in a Phase 2 follow-up (the new schema already supports them — only the
// admin UX is incremental).

interface CategoryRow {
  id: string
  name: string
  slug: string
}

interface ProductRow {
  id: string
  name: string
  slug: string
  description: string | null
  base_price_minor: number
  status: 'draft' | 'published' | 'archived'
  type: string
  is_best_seller: boolean
  is_featured: boolean
  is_perishable: boolean
  // joins
  product_images?: { storage_path: string; position: number; is_featured: boolean }[]
  product_categories?: { category_id: string; categories?: { name: string; slug: string } | null }[]
}

interface ProductFormData {
  name: string
  priceRupees: string
  description: string
  imageUrl: string
  categoryId: string
  status: 'draft' | 'published' | 'archived'
  isBestSeller: boolean
  isFeatured: boolean
  isPerishable: boolean
}

const DEFAULT_FORM: ProductFormData = {
  name: "",
  priceRupees: "",
  description: "",
  imageUrl: "",
  categoryId: "",
  status: 'published',
  isBestSeller: false,
  isFeatured: false,
  isPerishable: true,
}

const IMG_MIME_ALLOW = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif'])
const IMG_MAX_BYTES = 5 * 1024 * 1024 // 5 MB

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'product'
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [globalError, setGlobalError] = useState<string>("")

  const [isProductModalOpen, setProductModalOpen] = useState(false)
  const [isCategoryModalOpen, setCategoryModalOpen] = useState(false)
  const [isEditCategoryModalOpen, setEditCategoryModalOpen] = useState(false)

  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null)
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null)

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<ProductFormData>(DEFAULT_FORM)
  const [categoryFormData, setCategoryFormData] = useState({ name: "" })

  useEffect(() => { fetchInitialData() }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    setGlobalError("")
    const [prodRes, catRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, slug, description, base_price_minor, status, type, is_best_seller, is_featured, is_perishable, product_images(storage_path, position, is_featured), product_categories(category_id, categories(name, slug))')
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name, slug').order('name'),
    ])

    if (prodRes.error) {
      setGlobalError(`Could not load products: ${prodRes.error.message}`)
    } else if (prodRes.data) {
      setProducts(prodRes.data as unknown as ProductRow[])
    }

    if (catRes.error) {
      setGlobalError((prev) => prev || `Could not load categories: ${catRes.error.message}`)
    } else if (catRes.data) {
      setCategories(catRes.data as CategoryRow[])
      if (catRes.data.length > 0) {
        setFormData((prev) => ({ ...prev, categoryId: prev.categoryId || catRes.data[0].id }))
      }
    }
    setLoading(false)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const heroImage = (p: ProductRow): string | null => {
    const imgs = p.product_images ?? []
    const featured = imgs.find((i) => i.is_featured)
    return (featured ?? imgs[0])?.storage_path ?? null
  }
  const primaryCategoryName = (p: ProductRow): string | null =>
    p.product_categories?.[0]?.categories?.name ?? null
  const primaryCategoryId = (p: ProductRow): string | null =>
    p.product_categories?.[0]?.category_id ?? null

  // ── Image upload (validated client + storage RLS) ─────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) return
      const file = e.target.files[0]

      if (!IMG_MIME_ALLOW.has(file.type)) {
        alert('Only PNG, JPG, WebP or AVIF images are allowed.')
        return
      }
      if (file.size > IMG_MAX_BYTES) {
        alert('Image must be 5 MB or smaller.')
        return
      }

      const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : 'bin'
      const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`
      const path = `uploads/${id}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(path, file, { contentType: file.type })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path)
      setFormData((prev) => ({ ...prev, imageUrl: publicUrl }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.'
      alert(`Error uploading image: ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  // ── Product modal lifecycle ───────────────────────────────────────────────
  const openAdd = () => {
    setEditingProduct(null)
    setFormData({
      ...DEFAULT_FORM,
      categoryId: activeTab !== 'all' ? activeTab : (categories[0]?.id ?? ''),
    })
    setProductModalOpen(true)
  }

  const openEdit = (product: ProductRow) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      priceRupees: (product.base_price_minor / 100).toFixed(2),
      description: product.description ?? '',
      imageUrl: heroImage(product) ?? '',
      categoryId: primaryCategoryId(product) ?? categories[0]?.id ?? '',
      status: product.status,
      isBestSeller: product.is_best_seller,
      isFeatured: product.is_featured,
      isPerishable: product.is_perishable,
    })
    setProductModalOpen(true)
  }

  // ── Submit (create or edit) ───────────────────────────────────────────────
  const submitProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setGlobalError("")

    try {
      const basePriceMinor = rupeesToMinor(formData.priceRupees || '0')
      if (basePriceMinor < 0) throw new Error('Price must be 0 or greater.')

      if (editingProduct) {
        // ── Edit
        const { error: upErr } = await supabase
          .from('products')
          .update({
            name: formData.name,
            base_price_minor: basePriceMinor,
            description: formData.description || null,
            status: formData.status,
            is_best_seller: formData.isBestSeller,
            is_featured: formData.isFeatured,
            is_perishable: formData.isPerishable,
          })
          .eq('id', editingProduct.id)
        if (upErr) throw upErr

        // Image: if changed, replace the featured product_images row
        const existingHero = heroImage(editingProduct)
        if (formData.imageUrl && formData.imageUrl !== existingHero) {
          await supabase.from('product_images').delete().eq('product_id', editingProduct.id).eq('position', 0)
          await supabase.from('product_images').insert({
            product_id: editingProduct.id,
            storage_path: formData.imageUrl,
            position: 0,
            is_featured: true,
          })
        }

        // Category: if changed, replace the single product_categories row
        const existingCatId = primaryCategoryId(editingProduct)
        if (formData.categoryId && formData.categoryId !== existingCatId) {
          await supabase.from('product_categories').delete().eq('product_id', editingProduct.id)
          await supabase.from('product_categories').insert({
            product_id: editingProduct.id,
            category_id: formData.categoryId,
            position: 0,
          })
        }
      } else {
        // ── Create
        const slug = `${slugify(formData.name)}-${Math.floor(Math.random() * 1e6).toString(36)}`
        const { data: created, error: insErr } = await supabase
          .from('products')
          .insert({
            type: 'physical',
            status: formData.status,
            name: formData.name,
            slug,
            description: formData.description || null,
            base_price_minor: basePriceMinor,
            track_inventory: false,
            stock_quantity: 0,
            is_best_seller: formData.isBestSeller,
            is_featured: formData.isFeatured,
            is_perishable: formData.isPerishable,
            published_at: formData.status === 'published' ? new Date().toISOString() : null,
          })
          .select('id')
          .single()
        if (insErr || !created) throw insErr ?? new Error('Insert failed')

        if (formData.imageUrl) {
          await supabase.from('product_images').insert({
            product_id: created.id,
            storage_path: formData.imageUrl,
            position: 0,
            is_featured: true,
          })
        }
        if (formData.categoryId) {
          await supabase.from('product_categories').insert({
            product_id: created.id,
            category_id: formData.categoryId,
            position: 0,
          })
        }
      }

      setProductModalOpen(false)
      await fetchInitialData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.'
      setGlobalError(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete product ────────────────────────────────────────────────────────
  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product? This cannot be undone.')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { setGlobalError(error.message); return }
    setProducts((prev) => prev.filter((p) => p.id !== id))
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const openEditCategory = (cat: CategoryRow) => {
    setEditingCategory(cat)
    setCategoryFormData({ name: cat.name })
    setEditCategoryModalOpen(true)
  }
  const submitCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setGlobalError("")
    const slug = slugify(categoryFormData.name)
    try {
      if (editingCategory) {
        const { data, error } = await supabase
          .from('categories')
          .update({ name: categoryFormData.name, slug })
          .eq('id', editingCategory.id)
          .select('id, name, slug')
          .single()
        if (error) throw error
        if (data) setCategories((prev) => prev.map((c) => c.id === editingCategory.id ? data as CategoryRow : c))
        setEditCategoryModalOpen(false)
      } else {
        const { data, error } = await supabase
          .from('categories')
          .insert({ name: categoryFormData.name, slug, status: 'published' })
          .select('id, name, slug')
          .single()
        if (error) throw error
        if (data) setCategories((prev) => [...prev, data as CategoryRow])
        setCategoryModalOpen(false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed.'
      setGlobalError(msg)
    } finally {
      setSaving(false)
    }
  }
  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category? It must have no products attached.')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      // New schema uses ON DELETE RESTRICT — Postgres will refuse with a
      // foreign-key violation if products still reference this category.
      setGlobalError(
        error.code === '23503'
          ? 'This category still has products attached. Reassign or delete them first.'
          : error.message
      )
      return
    }
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setActiveTab('all')
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (activeTab === 'all') return products
    return products.filter((p) => p.product_categories?.some((pc) => pc.category_id === activeTab))
  }, [products, activeTab])

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <p className="admin-pill mb-3 inline-flex rounded-full px-3 py-1 ff-apfel text-[11px] uppercase tracking-[0.16em]">Catalog control</p>
          <h1 className="text-3xl font-bold ff-accia text-primary-brown">Products</h1>
          <p className="text-white/50 ff-apfel mt-1">Manage your bakery inventory and categories.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => { setEditingCategory(null); setCategoryFormData({ name: '' }); setCategoryModalOpen(true) }}
            className="flex items-center gap-2 bg-white/5 text-white px-6 py-3 rounded-xl hover:bg-white/10 transition-all ff-apfel font-bold border border-white/10"
          >
            <FolderPlus size={20} /> New Category
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-primary-brown text-white px-6 py-3 rounded-xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold"
          >
            <Plus size={20} /> Add Product
          </button>
        </div>
      </div>

      {globalError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 ff-apfel text-sm flex items-start gap-3">
          <X size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Could not complete the action</p>
            <p className="opacity-80 mt-0.5">{globalError}</p>
            <p className="opacity-60 mt-1 text-xs">
              If this is &quot;new row violates row-level security policy&quot;, you need an admin profile.
              Sign up via the storefront, then in Studio SQL editor run
              <span className="font-mono"> UPDATE public.profiles SET role = &apos;admin&apos; WHERE id = (SELECT id FROM auth.users WHERE email = &apos;your-email&apos;);</span>
            </p>
          </div>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-4 border-b border-white/5 pb-4">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-6 py-2 rounded-full ff-apfel text-sm whitespace-nowrap transition-all ${activeTab === 'all' ? 'bg-primary-brown text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
        >
          All Items
        </button>
        {categories.map((cat) => (
          <div key={cat.id} className="group relative">
            <button
              onClick={() => setActiveTab(cat.id)}
              className={`px-6 py-2 pr-10 rounded-full ff-apfel text-sm whitespace-nowrap transition-all ${activeTab === cat.id ? 'bg-primary-brown text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
            >
              {cat.name}
            </button>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={() => openEditCategory(cat)} className="p-1 hover:text-white transition-colors"><Settings2 size={12} /></button>
              <button onClick={() => deleteCategory(cat.id)} className="p-1 hover:text-red-400 transition-colors text-red-500/50"><X size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Category create / edit modal */}
      {(isCategoryModalOpen || isEditCategoryModalOpen) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <form onSubmit={submitCategory} className="bg-[#121212] border border-white/10 p-8 rounded-3xl w-full max-w-md space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold ff-accia text-primary-brown">{isEditCategoryModalOpen ? 'Edit Category' : 'New Category'}</h2>
              <button type="button" onClick={() => { setCategoryModalOpen(false); setEditCategoryModalOpen(false) }} className="text-white/20 hover:text-white"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Category Name</label>
                <input
                  required
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white"
                  placeholder="e.g. Brownies"
                />
              </div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-primary-brown text-white py-4 rounded-2xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold disabled:opacity-60">
              {saving ? <Loader2 className="animate-spin inline" size={18} /> : isEditCategoryModalOpen ? 'Update Category' : 'Create Category'}
            </button>
          </form>
        </div>
      )}

      {/* Product create / edit modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={submitProduct} className="bg-[#121212] border border-white/10 p-8 rounded-3xl w-full max-w-lg space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold ff-accia text-primary-brown">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
              <button type="button" onClick={() => setProductModalOpen(false)} className="text-white/20 hover:text-white"><X size={24} /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Hero image */}
              <div className="col-span-2">
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Product Image</label>
                <div className="flex gap-4 items-center">
                  <div className="w-24 h-24 bg-white/5 rounded-2xl overflow-hidden flex items-center justify-center border border-dashed border-white/10">
                    {formData.imageUrl
                      ? <img src={formData.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <ImageIcon className="text-white/10" size={32} />
                    }
                  </div>
                  <div className="flex-1">
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={handleImageUpload} className="hidden" id="image-upload" />
                    <label htmlFor="image-upload" className="inline-block bg-white/5 border border-white/10 px-4 py-2 rounded-lg cursor-pointer hover:bg-white/10 transition-all text-xs ff-apfel">
                      {uploading ? 'Uploading…' : 'Upload New Image'}
                    </label>
                    <p className="text-[10px] text-white/20 mt-2">PNG, JPG, WebP or AVIF up to 5MB. Replaces the hero image.</p>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Product Name</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Base Price (PKR)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.priceRupees}
                  onChange={(e) => setFormData({ ...formData, priceRupees: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white"
                  placeholder="e.g. 1800.00"
                />
                <p className="text-[10px] text-white/30 mt-1">Stored as integer paisa server-side ({formatPkr(rupeesToMinor(formData.priceRupees || '0'))}).</p>
              </div>

              <div>
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white"
                >
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['draft', 'published', 'archived'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({ ...formData, status: s })}
                      className={`px-3 py-2 rounded-lg ff-apfel text-xs capitalize transition-all ${formData.status === s ? 'bg-primary-brown text-white' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-white/30 mt-1">Only <span className="text-white/60">published</span> products appear in the storefront.</p>
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white h-24 resize-none"
                />
              </div>

              <ToggleRow
                id="is-best-seller"
                label="Mark as Best Seller"
                checked={formData.isBestSeller}
                onChange={(v) => setFormData({ ...formData, isBestSeller: v })}
              />
              <ToggleRow
                id="is-featured"
                label="Featured on home"
                checked={formData.isFeatured}
                onChange={(v) => setFormData({ ...formData, isFeatured: v })}
              />
              <ToggleRow
                id="is-perishable"
                label="Perishable (won't restock on cancel)"
                checked={formData.isPerishable}
                onChange={(v) => setFormData({ ...formData, isPerishable: v })}
                className="col-span-2"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={uploading || saving}
                className="flex-1 bg-primary-brown text-white px-6 py-4 rounded-2xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin inline" size={18} /> : editingProduct ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Products grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary-brown" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const img = heroImage(product)
            const catName = primaryCategoryName(product)
            return (
              <div key={product.id} className="admin-card rounded-2xl overflow-hidden group transition-all flex flex-col">
                <div className="h-48 bg-white/5 relative border-b border-white/10">
                  {img
                    ? <img src={img} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
                    : <div className="absolute inset-0 flex items-center justify-center opacity-20"><Plus size={48} /></div>
                  }
                  <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                    {product.is_best_seller && (
                      <span className="bg-primary-brown text-[8px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-lg">Best Seller</span>
                    )}
                    {product.status !== 'published' && (
                      <span className="bg-amber-500/80 text-[8px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-lg capitalize">{product.status}</span>
                    )}
                    {catName && (
                      <span className="bg-white/10 backdrop-blur-md text-[8px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">{catName}</span>
                    )}
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold ff-accia truncate">{product.name}</h3>
                    <p className="text-primary-brown font-bold mt-1 ff-apfel">{formatPkr(product.base_price_minor)}</p>
                  </div>
                  <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                    <button
                      onClick={() => openEdit(product)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all text-xs ff-apfel"
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ToggleRow({
  id, label, checked, onChange, className,
}: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <div className={`flex items-center gap-3 bg-white/5 p-4 rounded-xl ${className ?? ''}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 accent-primary-brown"
      />
      <label htmlFor={id} className="text-white/80 ff-apfel cursor-pointer flex items-center gap-2">
        {checked && <Check size={14} className="text-primary-brown" />}
        {label}
      </label>
    </div>
  )
}
