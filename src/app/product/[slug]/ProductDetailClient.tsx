"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Gift, Loader2, Minus, Plus } from "lucide-react"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/store/useCart"
import { formatPkr } from "@/lib/money"
import { Star, Heart } from "lucide-react"

// Phase 2: route is now /product/[slug] (matches the slugs ETL'd from the
// 88 legacy products into the new schema). For backward compatibility with
// old shared UUID links, if the param doesn't match by slug we fall back to
// matching by id.

type ProductRow = {
  id: string
  slug: string
  name: string
  description: string | null
  base_price_minor: number
  is_perishable: boolean
  rating_avg?: number | null
  rating_count?: number | null
  product_categories?: { category_id: string; categories?: { name: string; slug: string } | null }[]
  product_images?: { storage_path: string; position: number; is_featured: boolean }[]
}

type ProductAttributeJoinRow = {
  attribute_id: string
  display_order: number | null
  attributes?: { id: string; slug: string; label: string } | null
}

type AttributeValueRow = {
  id: string
  attribute_id: string
  slug: string
  label: string
  display_order: number | null
  is_active: boolean
}

type ReviewRow = {
  id: string
  rating: number
  title: string | null
  body: string | null
  verified_purchase: boolean
  created_at: string
}

type VariationRow = {
  id: string
  sku: string | null
  price_delta_minor: number
  is_active: boolean
  variation_attribute_values: { attribute_id: string; attribute_value_id: string }[]
}

type AttributeWithValues = {
  id: string
  slug: string
  label: string
  values: { id: string; slug: string; label: string }[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<ProductRow | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [wishlisted, setWishlisted] = useState(false)
  const [wishBusy, setWishBusy] = useState(false)
  const [variations, setVariations] = useState<VariationRow[]>([])
  const [productAttributes, setProductAttributes] = useState<AttributeWithValues[]>([])
  const [related, setRelated] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [instructions, setInstructions] = useState("")
  const [isGift, setIsGift] = useState(false)
  // Customer-selected attribute_value_id per attribute_id
  const [picked, setPicked] = useState<Record<string, string>>({})
  const addItem = useCart((state) => state.addItem)
  const router = useRouter()

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)

      // Try slug first; if not found and param looks like a UUID, fall back.
      let row: ProductRow | null = null
      const slugRes = await supabase
        .from("products")
        .select("id, slug, name, description, base_price_minor, is_perishable, rating_avg, rating_count, product_categories(category_id, categories(name, slug)), product_images(storage_path, position, is_featured)")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle()

      if (slugRes.data) {
        row = slugRes.data as ProductRow
      } else if (UUID_RE.test(slug)) {
        const idRes = await supabase
          .from("products")
          .select("id, slug, name, description, base_price_minor, is_perishable, rating_avg, rating_count, product_categories(category_id, categories(name, slug)), product_images(storage_path, position, is_featured)")
          .eq("id", slug)
          .eq("status", "published")
          .maybeSingle()
        row = idRes.data as ProductRow | null
      }

      if (!row) {
        setProduct(null)
        setRelated([])
        setVariations([])
        setProductAttributes([])
        setLoading(false)
        return
      }

      setProduct(row as ProductRow)

      // Phase 6: published reviews. RLS allows anon to read where
      // status='published', so this works for signed-out visitors too.
      const { data: revRes } = await supabase
        .from('product_reviews')
        .select('id, rating, title, body, verified_purchase, created_at')
        .eq('product_id', row.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20)
      setReviews((revRes as ReviewRow[]) ?? [])

      // Wishlist state. RLS scopes wishlist_items to the signed-in user;
      // anon visitors just see false (no row).
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: wl } = await supabase
          .from('wishlists')
          .select('id, wishlist_items!inner(product_id)')
          .eq('user_id', user.id)
          .eq('wishlist_items.product_id', row.id)
          .maybeSingle()
        setWishlisted(!!wl)
      }

      // Fetch variations + the attributes this product uses. If neither
      // returns rows the picker stays hidden — current 88 ETL products have
      // no variations, so this is the common path.
      const [varRes, paRes] = await Promise.all([
        supabase
          .from("product_variations")
          .select("id, sku, price_delta_minor, is_active, variation_attribute_values(attribute_id, attribute_value_id)")
          .eq("product_id", row.id)
          .eq("is_active", true)
          .is("deleted_at", null),
        supabase
          .from("product_attributes")
          .select("attribute_id, display_order, attributes(id, slug, label)")
          .eq("product_id", row.id)
          .order("display_order"),
      ])

      setVariations((varRes.data as VariationRow[]) ?? [])

      const attrRows = (paRes.data as ProductAttributeJoinRow[]) ?? []
      if (attrRows.length > 0) {
        const attrIds = attrRows.map((r) => r.attribute_id)
        const valuesRes = await supabase
          .from("attribute_values")
          .select("id, attribute_id, slug, label, display_order, is_active")
          .in("attribute_id", attrIds)
          .eq("is_active", true)
          .order("display_order")
        const grouped: AttributeWithValues[] = attrRows.map((r) => ({
          id: r.attribute_id,
          slug: r.attributes?.slug ?? "",
          label: r.attributes?.label ?? "",
          values: ((valuesRes.data as AttributeValueRow[]) ?? [])
            .filter((v) => v.attribute_id === r.attribute_id)
            .map((v) => ({ id: v.id, slug: v.slug, label: v.label })),
        }))
        setProductAttributes(grouped)
      } else {
        setProductAttributes([])
      }

      // Related products in the first category
      const firstCatId = row.product_categories?.[0]?.category_id
      if (firstCatId) {
        const { data: rel } = await supabase
          .from("products")
          .select("id, slug, name, description, base_price_minor, is_perishable, product_categories!inner(category_id), product_images(storage_path, position, is_featured)")
          .eq("product_categories.category_id", firstCatId)
          .eq("status", "published")
          .neq("id", row.id)
          .limit(3)
        setRelated((rel as ProductRow[]) ?? [])
      } else {
        setRelated([])
      }

      setLoading(false)
    }
    fetchAll()
  }, [slug])

  const hero = useMemo(() => {
    const imgs = product?.product_images ?? []
    return (imgs.find((i) => i.is_featured) ?? imgs[0])?.storage_path ?? "/assets/product.svg"
  }, [product])

  // Resolve the variation that matches the current picks (all attributes set
  // and combo exists in active variations). null until that condition holds.
  const selectedVariation = useMemo<VariationRow | null>(() => {
    if (productAttributes.length === 0 || variations.length === 0) return null
    if (Object.keys(picked).length !== productAttributes.length) return null
    return variations.find((v) => {
      const map = new Map(v.variation_attribute_values.map((vav) => [vav.attribute_id, vav.attribute_value_id]))
      return productAttributes.every((a) => map.get(a.id) === picked[a.id])
    }) ?? null
  }, [productAttributes, variations, picked])

  // Reachability: a value is enabled if at least one active variation matches
  // ALL other currently-picked attributes plus this candidate. Greys out the
  // impossible combinations as the customer clicks (§B.1.X.7).
  const reachableValueIds = useMemo<Set<string>>(() => {
    if (variations.length === 0) return new Set()
    const reachable = new Set<string>()
    for (const a of productAttributes) {
      for (const v of a.values) {
        const probe = { ...picked, [a.id]: v.id }
        const matches = variations.some((vr) => {
          const map = new Map(vr.variation_attribute_values.map((vav) => [vav.attribute_id, vav.attribute_value_id]))
          return Object.entries(probe).every(([attrId, valId]) => map.get(attrId) === valId)
        })
        if (matches) reachable.add(v.id)
      }
    }
    return reachable
  }, [variations, productAttributes, picked])

  const finalPriceMinor = useMemo(() => {
    if (!product) return 0
    return product.base_price_minor + (selectedVariation?.price_delta_minor ?? 0)
  }, [product, selectedVariation])

  const canAddToCart = productAttributes.length === 0 || selectedVariation !== null

  // Wishlist toggle. Upserts the parent wishlist row (one per user) and
  // either inserts or deletes the wishlist_items row. RLS already scopes
  // both tables to the owner — no RPC needed.
  const toggleWishlist = async () => {
    if (!product) return
    setWishBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/?next=' + encodeURIComponent(`/product/${product.slug}`))
        return
      }
      // Make sure a wishlist row exists for this user.
      await supabase.from('wishlists').upsert({ user_id: user.id }, { onConflict: 'user_id' })
      const { data: wl } = await supabase.from('wishlists').select('id').eq('user_id', user.id).maybeSingle()
      if (!wl) return
      if (wishlisted) {
        await supabase.from('wishlist_items').delete()
          .eq('wishlist_id', wl.id).eq('product_id', product.id)
        setWishlisted(false)
      } else {
        await supabase.from('wishlist_items').upsert(
          { wishlist_id: wl.id, product_id: product.id },
          { onConflict: 'wishlist_id,product_id' }
        )
        setWishlisted(true)
      }
    } finally {
      setWishBusy(false)
    }
  }

  const handleAddToCart = () => {
    if (!product) return
    if (productAttributes.length > 0 && !selectedVariation) return

    const variationLabel = selectedVariation
      ? productAttributes
          .map((a) => a.values.find((v) => v.id === picked[a.id])?.label)
          .filter(Boolean)
          .join(' / ')
      : undefined

    addItem({
      id: product.id,
      name: product.name,
      price: finalPriceMinor / 100,
      quantity,
      image: hero,
      description: product.description ?? undefined,
      variationId: selectedVariation?.id ?? null,
      variationLabel,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-brown" size={40} />
      </div>
    )
  }
  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-primary-brown ff-accia text-2xl">
        Product not found
      </div>
    )
  }

  const priceLabel = formatPkr(finalPriceMinor)
  const hasRelated = related.length > 0
  const ratingAvg = product.rating_avg ?? 0
  const ratingCount = product.rating_count ?? 0

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      <Navbar />

      <main className="pt-[118px] lg:pt-[130px]">
        <section className="relative mx-auto w-[calc(100%_-_32px)] max-w-[1390px] rounded-[clamp(16px,1.375rem,22px)] bg-accent-green px-[clamp(18px,2.125rem,34px)] pb-[clamp(54px,4.875rem,78px)] pt-[clamp(20px,2.375rem,38px)]">
          <div className="absolute bottom-[-74px] left-0 h-[118px] w-full pointer-events-none sm:bottom-[-82px] sm:h-[132px]" style={{ transform: "scaleY(-1)" }}>
            <Image src="/assets/union-drip.svg" alt="" fill className="block h-full w-full object-fill" />
          </div>

          <div className="relative grid gap-[clamp(24px,3.625rem,58px)] lg:grid-cols-[minmax(360px,540px)_minmax(320px,430px)] lg:items-start lg:justify-center">
            <div className="relative aspect-square overflow-hidden rounded-[clamp(14px,1.125rem,18px)] border border-primary-brown/15 bg-[#ece9e2] shadow-sm">
              <Image src={hero} alt={product.name} fill className="object-cover" priority />
            </div>

            <div className="w-full pt-[clamp(2px,0.625rem,10px)]">
              <h1 className="ff-accia text-[clamp(34px,3rem,48px)] text-primary-brown leading-[1.02]">{product.name}</h1>

              {product.product_categories?.[0]?.categories?.name ? (
                <p className="ff-accia-light mt-2 text-[clamp(15px,1.0625rem,17px)] text-primary-brown/80">
                  {product.product_categories[0].categories.name}
                </p>
              ) : null}

              {ratingCount > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={14}
                        className={n <= Math.round(ratingAvg) ? 'text-amber-400 fill-amber-400' : 'text-primary-brown/15'}
                      />
                    ))}
                  </div>
                  <span className="ff-apfel text-xs text-primary-brown/70">
                    {ratingAvg.toFixed(1)} · {ratingCount} review{ratingCount === 1 ? '' : 's'}
                  </span>
                </div>
              )}

              <div className="mt-5 flex items-center gap-3">
                <p className="ff-colville text-[clamp(23px,1.75rem,28px)] text-primary-brown">{priceLabel}</p>
                <button
                  type="button"
                  onClick={toggleWishlist}
                  disabled={wishBusy}
                  aria-pressed={wishlisted}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  className={`h-10 w-10 rounded-full border flex items-center justify-center transition-all disabled:opacity-50 ${
                    wishlisted
                      ? 'bg-primary-brown/10 border-primary-brown text-primary-brown'
                      : 'bg-white border-primary-brown/30 text-primary-brown/60 hover:border-primary-brown'
                  }`}
                >
                  <Heart size={16} className={wishlisted ? 'fill-primary-brown' : ''} />
                </button>
              </div>

              {product.description ? (
                <p className="ff-accia-light mt-3 max-w-[42rem] text-[clamp(16px,1.125rem,18px)] leading-[1.45] text-black/80 capitalize">{product.description}</p>
              ) : null}

              {/* Variation picker (renders only when the product has attributes) */}
              {productAttributes.length > 0 && (
                <div className="mt-6 space-y-4">
                  {productAttributes.map((attr) => (
                    <div key={attr.id}>
                      <p className="ff-accia text-[clamp(16px,1.125rem,18px)] text-black">{attr.label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {attr.values.map((val) => {
                          const isPicked = picked[attr.id] === val.id
                          const isReachable = reachableValueIds.has(val.id)
                          return (
                            <button
                              key={val.id}
                              type="button"
                              disabled={!isReachable}
                              onClick={() => setPicked((prev) => ({ ...prev, [attr.id]: val.id }))}
                              className={`rounded-full px-4 py-1.5 ff-apfel text-sm border transition-all ${
                                isPicked
                                  ? 'bg-primary-brown text-white border-primary-brown'
                                  : isReachable
                                    ? 'bg-white text-primary-brown border-primary-brown/30 hover:border-primary-brown'
                                    : 'bg-white/40 text-primary-brown/30 border-primary-brown/10 line-through cursor-not-allowed'
                              }`}
                              aria-label={`${attr.label}: ${val.label}${!isReachable ? ' (unavailable with current selection)' : ''}`}
                            >
                              {val.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <label className="ff-accia mt-6 block text-[clamp(18px,1.3125rem,21px)] text-black" htmlFor="product-instructions">
                Special Instructions
              </label>
              <textarea
                id="product-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Please enter instructions about this item"
                className="ff-accia-light mt-3 h-[132px] w-full resize-none rounded-[10px] border border-primary-brown/30 bg-white px-4 py-3 text-[clamp(15px,1rem,16px)] text-black/70 outline-none transition-all placeholder:text-black/35 focus:border-primary-brown"
              />

              <p className="ff-accia mt-6 text-[clamp(18px,1.3125rem,21px)] text-black">Quantity:</p>
              <div className="mt-3 flex h-[46px] w-[clamp(140px,10.625rem,170px)] items-center justify-between rounded-[10px] border border-primary-brown bg-white px-4">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="text-primary-brown transition-opacity hover:opacity-60" aria-label="Decrease">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="ff-accia text-[24px] leading-none text-primary-brown">{quantity}</span>
                <button onClick={() => setQuantity((q) => q + 1)} className="text-primary-brown transition-opacity hover:opacity-60" aria-label="Increase">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!canAddToCart}
                className="mt-5 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary-brown px-4 transition-all hover:bg-primary-brown/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="ff-accia text-[clamp(18px,1.3125rem,21px)] tracking-[0.02em] text-white">
                  {canAddToCart
                    ? `ADD TO CART - ${formatPkr(finalPriceMinor * quantity)}`
                    : `Pick ${productAttributes.find((a) => !picked[a.id])?.label ?? 'options'}`}
                </span>
              </button>

              <button
                onClick={() => setIsGift((g) => !g)}
                className={`mt-4 flex w-full items-center gap-4 rounded-[10px] border px-4 py-3 text-left transition-all ${
                  isGift ? "border-primary-brown bg-primary-brown/10" : "border-primary-brown/20 bg-white/60"
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${isGift ? "bg-primary-brown text-white" : "bg-accent-green text-primary-brown"}`}>
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <p className="ff-accia text-[clamp(16px,1.125rem,18px)] text-black">Is this a gift?</p>
                  <p className="ff-accia-light mt-1 text-[clamp(13px,0.9375rem,15px)] leading-[1.25] text-black/60">If checked, all prices will be removed from the paying slip</p>
                </div>
              </button>
            </div>
          </div>
        </section>

        {reviews.length > 0 && (
          <section className="mx-auto mt-[clamp(70px,6vw,110px)] w-[calc(100%_-_32px)] max-w-[1180px]">
            <div className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
              <h2 className="ff-accia text-[clamp(28px,2.4rem,40px)] leading-none text-primary-brown">
                Customer reviews
              </h2>
              {ratingCount > 0 && (
                <p className="ff-apfel text-sm text-primary-brown/70">
                  Average {ratingAvg.toFixed(1)} of 5 across {ratingCount} review{ratingCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {reviews.map((r) => (
                <article key={r.id} className="rounded-2xl border border-primary-brown/15 bg-white p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} size={14}
                          className={n <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-primary-brown/15'} />
                      ))}
                    </div>
                    {r.verified_purchase && (
                      <span className="ff-apfel text-[10px] uppercase tracking-widest bg-accent-green/50 text-primary-brown px-2 py-0.5 rounded">
                        Verified purchase
                      </span>
                    )}
                  </div>
                  {r.title && <p className="ff-accia text-primary-brown mt-3">{r.title}</p>}
                  {r.body && <p className="ff-accia-light text-sm text-black/70 mt-1 leading-relaxed whitespace-pre-wrap">{r.body}</p>}
                  <p className="ff-apfel text-[11px] text-black/30 mt-3">{new Date(r.created_at).toLocaleDateString()}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        {hasRelated ? (
          <section className="mx-auto mt-[clamp(105px,8.875rem,142px)] w-[calc(100%_-_32px)] max-w-[1390px]">
            <h2 className="ff-accia text-center text-[clamp(36px,3.25rem,52px)] leading-none text-primary-brown">
              You May Also Like
            </h2>
            <div className="mt-[clamp(28px,2.625rem,42px)] grid gap-5 md:grid-cols-3">
              {related.slice(0, 3).map((item) => {
                const rHero = (item.product_images?.find((i) => i.is_featured) ?? item.product_images?.[0])?.storage_path ?? "/assets/product.svg"
                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/product/${item.slug}`)}
                    className="cursor-pointer overflow-hidden rounded-[14px] border border-primary-brown bg-white transition-all hover:shadow-lg"
                  >
                    <div className="relative aspect-square w-full bg-[#ece9e2]">
                      <Image src={rHero} alt={item.name} fill className="object-cover" />
                    </div>
                    <div className="px-5 py-5 text-center">
                      <h3 className="ff-accia text-[clamp(23px,1.875rem,30px)] leading-[1.05] text-primary-brown">{item.name}</h3>
                      <p className="ff-colville mt-2 text-[clamp(18px,1.375rem,22px)] text-primary-brown">{formatPkr(item.base_price_minor)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        <div className="mt-[clamp(56px,6rem,96px)] pb-6">
          <Footer variant="flow" />
        </div>
      </main>
    </div>
  )
}
