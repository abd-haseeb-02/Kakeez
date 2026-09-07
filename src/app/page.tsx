import Image from "next/image"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import Hero from "@/components/shop/Hero"
import BestSellers, { type HomeCategory, type HomeProduct } from "@/components/shop/BestSellers"
import { createClient } from "@/lib/supabase/server"

// Server component on purpose. This page used to be "use client" and fetch its
// catalogue from the browser on mount, which meant two things: every visitor
// watched a full-screen spinner replace the page while a Supabase round-trip
// completed, and crawlers -- which see the first response, not the eventual
// render -- got a document with no products, no headings and no text at all.
// Fetching here ships finished HTML instead.

// Merchandising order for the storefront. Anything not listed sorts to the end.
const CATEGORY_ORDER = ["Simple Cakes", "Customized Cake", "Cookies", "Cup Cakes"]

type CategoryRow = { id: string; name: string; slug: string | null }

type ProductRow = {
  id: string
  slug: string | null
  name: string
  description: string | null
  base_price_minor: number | null
  product_categories?: { category_id: string }[]
  product_images?: { storage_path: string; position: number; is_featured: boolean }[]
}

function heroImage(product: ProductRow): string | null {
  const images = product.product_images ?? []
  return (images.find((image) => image.is_featured) ?? images[0])?.storage_path ?? null
}

async function fetchHomeCategories(): Promise<HomeCategory[]> {
  const supabase = await createClient()

  // One query for products rather than one per category. The old client code
  // issued a separate request inside a for-loop, so the spinner stayed up for
  // as many sequential round-trips as there were categories.
  const [categoriesRes, productsRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("name"),
    supabase
      .from("products")
      .select("id, slug, name, description, base_price_minor, product_categories!inner(category_id), product_images(storage_path, position, is_featured)")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ])

  const categories = (categoriesRes.data as CategoryRow[] | null) ?? []
  const products = (productsRes.data as ProductRow[] | null) ?? []

  const byCategory = new Map<string, HomeProduct[]>()
  for (const product of products) {
    const mapped: HomeProduct = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: (product.base_price_minor ?? 0) / 100,
      image_url: heroImage(product),
    }
    // A product can sit in several categories; it should appear under each.
    for (const link of product.product_categories ?? []) {
      const bucket = byCategory.get(link.category_id)
      if (bucket) bucket.push(mapped)
      else byCategory.set(link.category_id, [mapped])
    }
  }

  return categories
    .slice()
    .sort((a, b) => {
      const indexA = CATEGORY_ORDER.indexOf(a.name)
      const indexB = CATEGORY_ORDER.indexOf(b.name)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      products: byCategory.get(category.id) ?? [],
    }))
}

export default async function Home() {
  const categories = await fetchHomeCategories()

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-[clamp(76px,8vw,118px)]">
        <Hero />

        <section className="mx-auto grid w-[min(1190px,calc(100%_-_32px))] items-center gap-[clamp(28px,4vw,64px)] py-[clamp(56px,7vw,118px)] lg:grid-cols-[minmax(220px,340px)_1fr_minmax(220px,340px)]">
          <div className="relative hidden aspect-[0.76] overflow-hidden rounded-[14px] border border-primary-brown/30 bg-[#ece9e2] lg:block">
            <Image src="/assets/welcome-1.webp" alt="A table of Kakeez celebration cakes" fill sizes="340px" className="object-cover" />
          </div>

          <div className="mx-auto max-w-[620px] text-center">
            <p className="ff-accia text-sm uppercase tracking-[0.08em] text-primary-brown">Welcome to</p>
            <h1 className="ff-accia mt-2 text-[clamp(38px,4.4vw,72px)] leading-none">
              <span className="text-primary-brown">KAKEEZ</span> <span className="text-[#262729]">Bakeshop</span>
            </h1>
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
              <Image src="/assets/welcome-2.webp" alt="Decorated cupcakes and desserts from Kakeez" fill sizes="340px" className="object-cover" />
            </div>
          </div>
        </section>

        <BestSellers categories={categories} />

        <div id="contact" className="scroll-mt-[120px] pb-6">
          <Footer variant="flow" />
        </div>
      </main>
    </div>
  )
}
