"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Plus, Trash2, Edit3, Loader2, X, Image as ImageIcon, FolderPlus, Edit, Check, Settings2 } from "lucide-react"

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("all")
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false)
  
  const [editingProduct, setEditingProduct] = useState<any>(null)
  const [editingCategory, setEditingCategory] = useState<any>(null)
  
  const [uploading, setUploading] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    description: "",
    image_url: "",
    category_id: "",
    is_best_seller: false
  })

  const [categoryFormData, setCategoryFormData] = useState({
    name: ""
  })

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    setLoading(true)
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, categories(name)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name')
    ])
    
    if (prodRes.data) setProducts(prodRes.data)
    if (catRes.data) {
      setCategories(catRes.data)
      if (catRes.data.length > 0) setFormData(prev => ({ ...prev, category_id: catRes.data[0].id }))
    }
    setLoading(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) return
      
      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `uploads/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(filePath)
      setFormData(prev => ({ ...prev, image_url: publicUrl }))
      
    } catch (error: any) {
      alert('Error uploading image: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const handleOpenAdd = () => {
    setEditingProduct(null)
    setFormData({
      name: "",
      price: "",
      description: "",
      image_url: "",
      category_id: activeTab !== "all" ? activeTab : (categories[0]?.id || ""),
      is_best_seller: false
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (product: any) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      price: product.price.toString(),
      description: product.description || "",
      image_url: product.image_url || "",
      category_id: product.category_id || categories[0]?.id || "",
      is_best_seller: product.is_best_seller || false
    })
    setIsModalOpen(true)
  }

  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat)
    setCategoryFormData({ name: cat.name })
    setIsEditCategoryModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { 
      name: formData.name, 
      price: parseFloat(formData.price), 
      description: formData.description,
      image_url: formData.image_url,
      category_id: formData.category_id,
      is_best_seller: formData.is_best_seller
    }

    if (editingProduct) {
      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', editingProduct.id)
        .select('*, categories(name)')

      if (!error && data) {
        setProducts(products.map(p => p.id === editingProduct.id ? data[0] : p))
        setIsModalOpen(false)
      }
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select('*, categories(name)')

      if (!error && data) {
        setProducts([data[0], ...products])
        setIsModalOpen(false)
      }
    }
  }

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const slug = categoryFormData.name.toLowerCase().replace(/ /g, '-')
    
    if (editingCategory) {
      // EDIT
      const { data, error } = await supabase
        .from('categories')
        .update({ name: categoryFormData.name, slug: slug })
        .eq('id', editingCategory.id)
        .select()
      
      if (!error && data) {
        setCategories(categories.map(c => c.id === editingCategory.id ? data[0] : c))
        setIsEditCategoryModalOpen(false)
      }
    } else {
      // CREATE
      const { data, error } = await supabase
        .from('categories')
        .insert([{ name: categoryFormData.name, slug: slug }])
        .select()

      if (!error && data) {
        setCategories([...categories, data[0]])
        setIsCategoryModalOpen(false)
      }
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm("Are you sure? Deleting this category will PERMANENTLY delete all products inside it.")) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) {
      setCategories(categories.filter(c => c.id !== id))
      setProducts(products.filter(p => p.category_id !== id))
      setActiveTab("all")
    }
  }

  const deleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (!error) setProducts(products.filter(p => p.id !== id))
  }

  const filteredProducts = activeTab === "all" 
    ? products 
    : products.filter(p => p.category_id === activeTab)

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold ff-accia text-primary-brown">Products</h1>
          <p className="text-white/50 ff-apfel mt-1">Manage your bakery inventory and categories.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-2 bg-white/5 text-white px-6 py-3 rounded-xl hover:bg-white/10 transition-all ff-apfel font-bold border border-white/10"
          >
            <FolderPlus size={20} /> New Category
          </button>
          <button 
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-primary-brown text-white px-6 py-3 rounded-xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold"
          >
            <Plus size={20} /> Add Product
          </button>
        </div>
      </div>

      {/* Category Tabs & Management */}
      <div className="flex flex-wrap gap-4 border-b border-white/5 pb-4">
        <button 
          onClick={() => setActiveTab("all")}
          className={`px-6 py-2 rounded-full ff-apfel text-sm whitespace-nowrap transition-all ${activeTab === "all" ? "bg-primary-brown text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
        >
          All Items
        </button>
        {categories.map(cat => (
          <div key={cat.id} className="group relative">
            <button 
              onClick={() => setActiveTab(cat.id)}
              className={`px-6 py-2 pr-10 rounded-full ff-apfel text-sm whitespace-nowrap transition-all ${activeTab === cat.id ? "bg-primary-brown text-white" : "bg-white/5 text-white/40 hover:bg-white/10"}`}
            >
              {cat.name}
            </button>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
               <button onClick={() => handleOpenEditCategory(cat)} className="p-1 hover:text-white transition-colors"><Settings2 size={12} /></button>
               <button onClick={() => deleteCategory(cat.id)} className="p-1 hover:text-red-400 transition-colors text-red-500/50"><X size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Category Edit Modal */}
      {(isCategoryModalOpen || isEditCategoryModalOpen) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <form onSubmit={handleCategorySubmit} className="bg-[#121212] border border-white/10 p-8 rounded-3xl w-full max-w-md space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold ff-accia text-primary-brown">{isEditCategoryModalOpen ? "Edit Category" : "New Category"}</h2>
              <button type="button" onClick={() => { setIsCategoryModalOpen(false); setIsEditCategoryModalOpen(false); }} className="text-white/20 hover:text-white"><X size={24} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Category Name</label>
                <input 
                  required
                  value={categoryFormData.name}
                  onChange={e => setCategoryFormData({ name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white"
                  placeholder="e.g. Brownies"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-primary-brown text-white py-4 rounded-2xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold">
              {isEditCategoryModalOpen ? "Update Category" : "Create Category"}
            </button>
          </form>
        </div>
      )}

      {/* Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-[#121212] border border-white/10 p-8 rounded-3xl w-full max-w-lg space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold ff-accia text-primary-brown">{editingProduct ? "Edit Product" : "New Product"}</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-white/20 hover:text-white"><X size={24} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Product Image</label>
                <div className="flex gap-4 items-center">
                  <div className="w-24 h-24 bg-white/5 rounded-2xl overflow-hidden flex items-center justify-center border border-dashed border-white/10">
                    {formData.image_url ? (
                      <img src={formData.image_url} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="text-white/10" size={32} />
                    )}
                  </div>
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden" 
                      id="image-upload"
                    />
                    <label 
                      htmlFor="image-upload"
                      className="inline-block bg-white/5 border border-white/10 px-4 py-2 rounded-lg cursor-pointer hover:bg-white/10 transition-all text-xs ff-apfel"
                    >
                      {uploading ? "Uploading..." : "Upload New Image"}
                    </label>
                    <p className="text-[10px] text-white/20 mt-2">PNG, JPG or WebP up to 5MB</p>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Product Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Price (Rs.)</label>
                <input 
                  required
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData({...formData, price: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Category</label>
                <select 
                  value={formData.category_id}
                  onChange={e => setFormData({...formData, category_id: e.target.value})}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white"
                >
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-white/30 mb-2 ff-apfel uppercase tracking-widest font-bold">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary-brown transition-all text-white h-24 resize-none"
                />
              </div>
              <div className="col-span-2 flex items-center gap-3 bg-white/5 p-4 rounded-xl">
                <input 
                  type="checkbox"
                  id="best-seller"
                  checked={formData.is_best_seller}
                  onChange={e => setFormData({...formData, is_best_seller: e.target.checked})}
                  className="w-5 h-5 accent-primary-brown"
                />
                <label htmlFor="best-seller" className="text-white/80 ff-apfel cursor-pointer">Mark as Best Seller</label>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="submit"
                disabled={uploading}
                className="flex-1 bg-primary-brown text-white px-6 py-4 rounded-2xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold disabled:opacity-50"
              >
                {editingProduct ? "Update Product" : "Save Product"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary-brown" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-[#121212] border border-white/5 rounded-2xl overflow-hidden group hover:border-primary-brown/30 transition-all flex flex-col">
              <div className="h-48 bg-white/5 relative border-b border-white/10">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center opacity-20"><Plus size={48} /></div>
                )}
                <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                  {product.is_best_seller && (
                    <span className="bg-primary-brown text-[8px] font-bold px-2 py-1 rounded-full uppercase tracking-wider shadow-lg">Best Seller</span>
                  )}
                  <span className="bg-white/10 backdrop-blur-md text-[8px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">{product.categories?.name}</span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold ff-accia truncate">{product.name}</h3>
                  <p className="text-primary-brown font-bold mt-1 ff-apfel">Rs. {product.price}</p>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
                  <button 
                    onClick={() => handleOpenEdit(product)}
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
          ))}
        </div>
      )}
    </div>
  )
}
