"use client"

import Image from "next/image"
import Link from "next/link"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import Hero from "@/components/shop/Hero"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2, ShoppingCart } from "lucide-react"
import { useCart } from "@/store/useCart"
import cakesIcon from "../../cakes.png"
import cookiesIcon from "../../cookies.png"
import cupcakesIcon from "../../cupcakes.png"
import customizedCakesIcon from "../../customized cakes.png"

const CATEGORY_ICONS = {
  "simple cakes": cakesIcon,
  "customized cake": customizedCakesIcon,
  "customized cakes": customizedCakesIcon,
  cookies: cookiesIcon,
  "cup cakes": cupcakesIcon,
  cupcakes: cupcakesIcon,
}

function getCategoryIcon(name: string) {
  return CATEGORY_ICONS[name.trim().toLowerCase() as keyof typeof CATEGORY_ICONS]
}

export default function Home() {
  const [categories, setCategories] = useState<any[]>([])
  const [productsByCategory, setProductsByCategory] = useState<Record<string, any[]>>({})
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const addItem = useCart((state) => state.addItem)

  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories
      const { data: catData } = await supabase.from('categories').select('*').order('name')
      if (catData) {
        // Enforce specific category order
        const desiredOrder = ["Simple Cakes", "Customized Cake", "Cookies", "Cup Cakes"]
        const orderedCategories = catData.sort((a, b) => {
          const indexA = desiredOrder.indexOf(a.name)
          const indexB = desiredOrder.indexOf(b.name)
          // If a category isn't in the list, put it at the end
          if (indexA === -1) return 1
          if (indexB === -1) return -1
          return indexA - indexB
        })

        setCategories(orderedCategories)
        if (orderedCategories.length > 0) setActiveCategory(orderedCategories[0].id)
        
        // Fetch products for each category and set initial pagination.
        // New schema: category link is M:M via product_categories; the legacy
        // image_url + price columns are gone (base_price_minor in paisa now,
        // image in product_images). We project back to the legacy shape so
        // ProductCard stays unchanged this phase — Phase 2 revamps the cards.
        const productsMap: Record<string, any[]> = {}
        const initialCounts: Record<string, number> = {}
        for (const cat of orderedCategories) {
          const { data: prodData } = await supabase
            .from('products')
            .select('*, product_categories!inner(category_id), product_images(storage_path, position, is_featured)')
            .eq('product_categories.category_id', cat.id)
            .eq('status', 'published')
            .order('created_at', { ascending: false })

          if (prodData) {
            productsMap[cat.id] = prodData.map((p: any) => {
              const hero = p.product_images?.find((i: any) => i.is_featured) ?? p.product_images?.[0]
              return {
                ...p,
                image_url: hero?.storage_path ?? null,
                price: (p.base_price_minor ?? 0) / 100,
              }
            })
          }
          initialCounts[cat.id] = 6 // Show 6 products initially per category
        }
        setProductsByCategory(productsMap)
        setVisibleCounts(initialCounts)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-primary-brown" size={40} /></div>
  }

  const categoryLayouts = categories.map((category) => {
    const allProducts = productsByCategory[category.id] || []
    const visibleCount = visibleCounts[category.id] || 6

    return {
      category,
      products: allProducts.slice(0, visibleCount),
      hasMore: allProducts.length > visibleCount,
    }
  })

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-[clamp(76px,8vw,118px)]">
        <Hero />

        <section className="mx-auto grid w-[min(1190px,calc(100%_-_32px))] items-center gap-[clamp(28px,4vw,64px)] py-[clamp(56px,7vw,118px)] lg:grid-cols-[minmax(220px,340px)_1fr_minmax(220px,340px)]">
          <div className="relative aspect-[0.76] overflow-hidden rounded-[14px] border border-primary-brown/30 bg-[#ece9e2]">
            <Image src="/assets/welcome-1.png" alt="" fill className="object-cover" />
          </div>

          <div className="mx-auto max-w-[620px] text-center">
            <p className="ff-accia text-sm uppercase tracking-[0.08em] text-primary-brown">Welcome to</p>
            <h2 className="ff-accia mt-2 text-[clamp(38px,4.4vw,72px)] leading-none">
              <span className="text-primary-brown">KAKEEZ</span> <span className="text-[#262729]">Bakeshop</span>
            </h2>
            <div className="ff-accia mt-5 space-y-3 text-[clamp(16px,1.2vw,20px)] leading-[1.45] text-[#262729]">
              <p>At Kakeez, we believe every celebration deserves a centerpiece as delicious as it is beautiful.</p>
              <p>We specialize in custom, artisanal baking - from grand wedding cakes to rich, fudgy brownies. We pour our passion into every recipe to craft unforgettable memories.</p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[340px]">
            <div className="absolute -left-[clamp(26px,4vw,62px)] -top-[clamp(24px,3vw,48px)] z-10 h-[clamp(82px,8vw,138px)] w-[clamp(82px,8vw,138px)]">
              <Image src="/assets/badge-circle.png" alt="" fill sizes="138px" className="object-contain" />
            </div>
            <div className="relative aspect-[0.76] overflow-hidden rounded-[14px] border border-primary-brown/30 bg-[#ece9e2]">
              <Image src="/assets/welcome-2.png" alt="" fill className="object-cover" />
            </div>
          </div>
        </section>

        <section className="relative mx-auto w-[calc(100%_-_32px)] max-w-[1390px] bg-accent-green pb-[clamp(88px,7rem,112px)] pt-[clamp(168px,13rem,208px)]">
          <div className="pointer-events-none absolute left-1/2 top-[-2px] z-0 h-[clamp(128px,12rem,192px)] w-[min(1800px,132%)] -translate-x-1/2">
            <Image src="/assets/vector13.svg" alt="" fill className="block h-full w-full object-fill" />
          </div>
          <div className="pointer-events-none absolute bottom-[-118px] left-0 z-0 h-[clamp(126px,11rem,176px)] w-full">
            <Image src="/assets/vector14.svg" alt="" fill className="block h-full w-full object-fill" />
          </div>

          <div className="relative z-10 mx-auto w-[calc(100%_-_32px)]">
            <h2 className="ff-accia text-center text-[clamp(38px,4.6vw,72px)] leading-none text-primary-brown">Shop Best Sellers</h2>

            <div className="mt-7 flex snap-x gap-3 overflow-x-auto pb-3">
              {categoryLayouts.map((layout) => {
                const categoryIcon = getCategoryIcon(layout.category.name)
                const isActive = activeCategory === layout.category.id

                return (
                  <button
                    key={layout.category.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(layout.category.id)
                      document.getElementById(`mobile-category-${layout.category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }}
                    className={`flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2.5 transition-all ${
                      isActive ? "border-primary-brown bg-white shadow-sm" : "border-primary-brown/10 bg-white/45"
                    }`}
                  >
                    {categoryIcon && (
                      <span className="relative block h-7 w-7 shrink-0">
                        <Image src={categoryIcon} alt="" fill sizes="28px" className="object-contain" />
                      </span>
                    )}
                    <span className="ff-colville text-[15px] uppercase text-primary-brown">{layout.category.name}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-[clamp(36px,4vw,64px)] space-y-[clamp(48px,6vw,92px)]">
              {categoryLayouts.map((layout) => {
                return (
                  <section key={layout.category.id} id={`mobile-category-${layout.category.id}`} className="scroll-mt-24">
                    <h3 className="ff-accia text-center text-[clamp(34px,4vw,62px)] uppercase leading-none text-primary-brown">
                      {layout.category.name}
                    </h3>
                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {layout.products.map((product) => (
                        <article
                          key={product.id}
                          className="overflow-hidden rounded-[14px] border border-primary-brown bg-white transition-all hover:shadow-lg"
                        >
                          <Link href={`/product/${product.slug ?? product.id}`} className="block">
                            <div className="relative aspect-square bg-[#ece9e2]">
                              <Image src={product.image_url || "/assets/product.svg"} alt={product.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" />
                            </div>
                          </Link>
                          <div className="px-4 py-5 text-center">
                            <Link href={`/product/${product.slug ?? product.id}`} className="block">
                              <h4 className="ff-accia text-[clamp(25px,2.3vw,34px)] leading-[1.04] text-primary-brown">{product.name}</h4>
                              <p className="ff-colville mt-2 text-[clamp(18px,1.5vw,24px)] text-primary-brown">Rs. {Number(product.price).toLocaleString()}</p>
                            </Link>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <Link
                                href={`/product/${product.slug ?? product.id}`}
                                className="flex h-11 items-center justify-center rounded-[10px] border border-primary-brown ff-accia text-[15px] uppercase text-primary-brown transition-colors hover:bg-primary-brown/5"
                              >
                                Buy Now
                              </Link>
                              <button
                                type="button"
                                onClick={() => addItem({ id: product.id, name: product.name, price: product.price, quantity: 1, image: product.image_url || "/assets/product.svg", description: product.description })}
                                className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary-brown px-3 ff-accia text-[15px] uppercase text-white transition-colors hover:bg-primary-brown/90"
                              >
                                <ShoppingCart className="h-4 w-4" /> Add
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    {layout.hasMore && (
                      <div className="mt-7 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setVisibleCounts((prev) => ({ ...prev, [layout.category.id]: prev[layout.category.id] + 6 }))}
                          className="rounded-[8px] border border-primary-brown bg-white px-6 py-3 ff-accia text-[16px] uppercase tracking-[0.02em] text-primary-brown transition-opacity hover:opacity-75"
                        >
                          View More {layout.category.name}
                        </button>
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-[min(1390px,calc(100%_-_32px))] py-[clamp(56px,7vw,110px)] text-center">
          <h2 className="ff-accia text-[clamp(38px,4vw,64px)] leading-none text-[#262729]">Follow @kakeezbakers</h2>
          <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="aspect-[0.84] rounded-[12px] border border-primary-brown/10 bg-[#ece9e2]" />
            ))}
          </div>
        </section>

        <div className="pb-6">
          <Footer variant="flow" />
        </div>
      </main>
    </div>
  )
}
