"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Gift, Loader2, Minus, Plus } from "lucide-react"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/store/useCart"

type Product = {
  id: string
  name: string
  price: number | string
  description?: string | null
  image_url?: string | null
  category_id?: string | null
  categories?: {
    name?: string | null
  } | null
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [instructions, setInstructions] = useState("")
  const [isGift, setIsGift] = useState(false)
  const addItem = useCart((state) => state.addItem)
  const router = useRouter()

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)

      // New schema: project the joined shape back to the legacy Product type
      // so the rest of this page stays unchanged. Phase 2 redesigns the page
      // around the variations picker, at which point this shim goes away.
      const { data: row } = await supabase
        .from("products")
        .select("*, product_categories(category_id, categories(name)), product_images(storage_path, position, is_featured)")
        .eq("id", id)
        .eq("status", "published")
        .single<any>()

      if (row) {
        const hero = row.product_images?.find((i: any) => i.is_featured) ?? row.product_images?.[0]
        const firstCat = row.product_categories?.[0]
        const mapped: Product = {
          id: row.id,
          name: row.name,
          price: (row.base_price_minor ?? 0) / 100,
          description: row.description,
          image_url: hero?.storage_path ?? null,
          category_id: firstCat?.category_id ?? null,
          categories: firstCat?.categories ? { name: firstCat.categories.name } : null,
        }
        setProduct(mapped)

        if (mapped.category_id) {
          const { data: rel } = await supabase
            .from("products")
            .select("*, product_categories!inner(category_id), product_images(storage_path, position, is_featured)")
            .eq("product_categories.category_id", mapped.category_id)
            .eq("status", "published")
            .neq("id", row.id)
            .limit(3)

          setRelated(
            (rel ?? []).map((r: any): Product => {
              const rHero = r.product_images?.find((i: any) => i.is_featured) ?? r.product_images?.[0]
              return {
                id: r.id,
                name: r.name,
                price: (r.base_price_minor ?? 0) / 100,
                description: r.description,
                image_url: rHero?.storage_path ?? null,
                category_id: mapped.category_id,
                categories: mapped.categories,
              }
            })
          )
        } else {
          setRelated([])
        }
      } else {
        setProduct(null)
        setRelated([])
      }

      setLoading(false)
    }

    fetchProduct()
  }, [id])

  const handleAddToCart = () => {
    if (!product) return

    addItem({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity,
      image: product.image_url || "/assets/product.svg",
      description: product.description ?? undefined,
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

  const productImage = product.image_url || "/assets/product.svg"
  const price = Number(product.price)
  const priceLabel = `RS.${price.toLocaleString()}`
  const hasRelatedProducts = related.length > 0

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      <Navbar />

      <main className="pt-[clamp(122px,8.8vw,150px)]">
        <section className="relative mx-auto w-[min(1180px,calc(100vw-40px))] rounded-[clamp(16px,1.2vw,22px)] bg-accent-green px-[clamp(18px,2.2vw,34px)] pb-[clamp(54px,5vw,78px)] pt-[clamp(20px,2.4vw,38px)]">
          <div className="absolute bottom-[-74px] left-0 h-[118px] w-full pointer-events-none sm:bottom-[-82px] sm:h-[132px]" style={{ transform: "scaleY(-1)" }}>
            <Image src="/assets/union-drip.svg" alt="" fill className="block h-full w-full object-fill" />
          </div>

          <div className="relative grid gap-[clamp(24px,3.6vw,58px)] lg:grid-cols-[minmax(360px,540px)_minmax(320px,430px)] lg:items-start lg:justify-center">
            <div className="relative aspect-square overflow-hidden rounded-[clamp(14px,1vw,18px)] border border-primary-brown/15 bg-[#ece9e2] shadow-sm">
              <Image src={productImage} alt={product.name} fill className="object-cover" priority />
            </div>

            <div className="w-full pt-[clamp(2px,0.7vw,10px)]">
              <h1 className="ff-accia text-[clamp(34px,3vw,48px)] text-primary-brown leading-[1.02]">{product.name}</h1>

              {product.categories?.name ? (
                <p className="ff-accia-light mt-2 text-[clamp(15px,1.05vw,17px)] text-primary-brown/80">{product.categories.name}</p>
              ) : null}

              <p className="ff-colville mt-5 text-[clamp(23px,1.55vw,28px)] text-primary-brown">{priceLabel}</p>

              {product.description ? (
                <p className="ff-accia-light mt-3 max-w-[42rem] text-[clamp(16px,1.05vw,18px)] leading-[1.45] text-black/80 capitalize">{product.description}</p>
              ) : null}

              <label className="ff-accia mt-6 block text-[clamp(18px,1.25vw,21px)] text-black" htmlFor="product-instructions">
                Special Instructions
              </label>
              <textarea
                id="product-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Please enter instructions about this item"
                className="ff-accia-light mt-3 h-[132px] w-full resize-none rounded-[10px] border border-primary-brown/30 bg-white px-4 py-3 text-[clamp(15px,0.95vw,16px)] text-black/70 outline-none transition-all placeholder:text-black/35 focus:border-primary-brown"
              />

              <p className="ff-accia mt-6 text-[clamp(18px,1.25vw,21px)] text-black">Quantity:</p>
              <div className="mt-3 flex h-[46px] w-[clamp(140px,10vw,170px)] items-center justify-between rounded-[10px] border border-primary-brown bg-white px-4">
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
                className="mt-5 flex h-[52px] w-full items-center justify-center rounded-[10px] bg-primary-brown px-4 transition-all hover:bg-primary-brown/90"
              >
                <span className="ff-accia text-[clamp(18px,1.2vw,21px)] tracking-[0.02em] text-white">
                  ADD TO CART - RS.{(price * quantity).toLocaleString()}
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
                  <p className="ff-accia text-[clamp(16px,1vw,18px)] text-black">Is this a gift?</p>
                  <p className="ff-accia-light mt-1 text-[clamp(13px,0.85vw,15px)] leading-[1.25] text-black/60">If checked, all prices will be removed from the paying slip</p>
                </div>
              </button>
            </div>
          </div>
        </section>

        {hasRelatedProducts ? (
          <section className="mx-auto mt-[clamp(105px,9vw,142px)] w-[min(1180px,calc(100vw-40px))]">
            <h2 className="ff-accia text-center text-[clamp(36px,3.2vw,52px)] leading-none text-primary-brown">
              You May Also Like
            </h2>
            <div className="mt-[clamp(28px,3vw,42px)] grid gap-5 md:grid-cols-3">
            {related.slice(0, 3).map((item) => (
              <div
                key={item.id}
                onClick={() => router.push(`/product/${item.id}`)}
                className="cursor-pointer overflow-hidden rounded-[14px] border border-primary-brown bg-white transition-all hover:shadow-lg"
              >
                <div className="relative aspect-square w-full bg-[#ece9e2]">
                  <Image src={item.image_url || "/assets/product.svg"} alt={item.name} fill className="object-cover" />
                </div>
                <div className="px-5 py-5 text-center">
                  <h3 className="ff-accia text-[clamp(23px,1.7vw,30px)] leading-[1.05] text-primary-brown">{item.name}</h3>
                  <p className="ff-colville mt-2 text-[clamp(18px,1.2vw,22px)] text-primary-brown">Rs.{Number(item.price).toLocaleString()}</p>
                </div>
              </div>
            ))}
            </div>
          </section>
        ) : null}

        <div className="mt-[clamp(56px,6vw,96px)] pb-6">
          <Footer variant="flow" />
        </div>
      </main>
    </div>
  )
}
