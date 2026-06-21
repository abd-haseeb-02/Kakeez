"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { formatPkr } from "@/lib/money"
import { useCart } from "@/store/useCart"
import { ArrowRight, Heart, Loader2, ShoppingCart, Trash2 } from "lucide-react"

interface WishlistProduct {
  product_id: string
  product: {
    id: string
    slug: string
    name: string
    description: string | null
    base_price_minor: number
    status: string
    product_images: { storage_path: string; position: number; is_featured: boolean }[]
  } | null
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string>("")
  const addItem = useCart((s) => s.addItem)

  const load = async () => {
    setLoading(true)
    // Wishlist row + items + each item's product (joined).
    const { data: wlRows } = await supabase
      .from('wishlists')
      .select('id, wishlist_items(product_id, product:products(id, slug, name, description, base_price_minor, status, product_images(storage_path, position, is_featured)))')
      .maybeSingle()
    const flat: WishlistProduct[] = ((wlRows as unknown as { wishlist_items?: WishlistProduct[] })?.wishlist_items) ?? []
    // Hide products that have since been archived / unpublished so the
    // wishlist doesn't render broken cards.
    setItems(flat.filter((it) => it.product?.status === 'published'))
    setLoading(false)
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [])

  const remove = async (productId: string) => {
    setBusyId(productId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: wl } = await supabase.from('wishlists').select('id').eq('user_id', user.id).maybeSingle()
    if (wl?.id) {
      await supabase.from('wishlist_items').delete().eq('wishlist_id', wl.id).eq('product_id', productId)
    }
    setItems((prev) => prev.filter((it) => it.product_id !== productId))
    setBusyId("")
  }

  const moveToCart = (it: WishlistProduct) => {
    if (!it.product) return
    const hero = it.product.product_images?.find((i) => i.is_featured) ?? it.product.product_images?.[0]
    addItem({
      id: it.product.id,
      name: it.product.name,
      price: it.product.base_price_minor / 100,
      quantity: 1,
      image: hero?.storage_path ?? '/assets/product.svg',
      description: it.product.description ?? undefined,
    })
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-brown" size={28} /></div>
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-primary-brown/15 bg-accent-green/30 p-8 text-center">
        <Heart size={28} className="mx-auto text-primary-brown/60 mb-3" />
        <p className="ff-accia text-[clamp(20px,1.4vw,26px)] text-primary-brown">Your wishlist is empty</p>
        <p className="ff-accia-light text-sm text-black/60 mt-2">Tap the heart on any product to save it for later.</p>
        <Link href="/" className="inline-flex items-center gap-2 mt-4 bg-primary-brown text-white px-5 py-2.5 rounded-lg ff-apfel hover:bg-primary-brown/90 transition-all">
          Browse the menu <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="ff-accia text-[clamp(22px,1.6vw,28px)] text-primary-brown mb-2">Saved for later</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((it) => {
          if (!it.product) return null
          const hero = it.product.product_images?.find((i) => i.is_featured) ?? it.product.product_images?.[0]
          return (
            <div key={it.product_id} className="rounded-2xl border border-primary-brown/15 bg-white p-4 flex gap-4">
              <Link href={`/product/${it.product.slug}`} className="w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-primary-brown/15 bg-[#ece9e2]">
                {hero?.storage_path && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hero.storage_path} alt={it.product.name} className="w-full h-full object-cover" />
                )}
              </Link>
              <div className="flex-1 min-w-0 flex flex-col">
                <Link href={`/product/${it.product.slug}`} className="ff-accia text-primary-brown leading-tight hover:opacity-80">
                  {it.product.name}
                </Link>
                <p className="ff-accia text-primary-brown text-base mt-1">{formatPkr(it.product.base_price_minor)}</p>
                <div className="flex items-center gap-2 mt-auto pt-2">
                  <button
                    onClick={() => moveToCart(it)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 ff-apfel text-xs bg-primary-brown text-white py-2 rounded-lg hover:bg-primary-brown/90 transition-all"
                  >
                    <ShoppingCart size={12} /> Add to cart
                  </button>
                  <button
                    onClick={() => remove(it.product_id)}
                    disabled={busyId === it.product_id}
                    className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all disabled:opacity-50"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
