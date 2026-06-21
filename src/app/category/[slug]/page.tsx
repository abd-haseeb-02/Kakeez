import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import { formatPkr } from "@/lib/money"
import { createClient } from "@/lib/supabase/server"

type CategoryRow = {
  id: string
  name: string
  slug: string
  description: string | null
  image_storage_path: string | null
}

type ProductImageRow = {
  storage_path: string
  position: number
  is_featured: boolean
}

type ProductRow = {
  id: string
  slug: string
  name: string
  description: string | null
  short_description: string | null
  base_price_minor: number
  rating_avg: number | null
  rating_count: number | null
  product_images?: ProductImageRow[]
}

type CategoryPageData = {
  category: CategoryRow
  products: ProductRow[]
}

function origin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

async function fetchCategoryPage(slug: string): Promise<CategoryPageData | null> {
  const supabase = await createClient()
  const { data: category } = await supabase
    .from("categories")
    .select("id, name, slug, description, image_storage_path")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle<CategoryRow>()

  if (!category) return null

  const { data: products } = await supabase
    .from("products")
    .select("id, slug, name, description, short_description, base_price_minor, rating_avg, rating_count, product_categories!inner(category_id), product_images(storage_path, position, is_featured)")
    .eq("product_categories.category_id", category.id)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("is_best_seller", { ascending: false })
    .order("created_at", { ascending: false })

  return {
    category,
    products: (products as ProductRow[] | null) ?? [],
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const data = await fetchCategoryPage(slug)

  if (!data) {
    return {
      title: "Category not found · Kakeez",
      robots: { index: false, follow: false },
    }
  }

  const { category } = data
  const url = `${origin()}/category/${category.slug}`
  const description = (
    category.description?.trim() ||
    `Shop ${category.name} from Kakeez Bakeshop. Freshly baked, made for celebrations, and ready for every sweet craving.`
  ).slice(0, 200)

  return {
    title: `${category.name} · Kakeez Bakeshop`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${category.name} · Kakeez Bakeshop`,
      description,
      url,
      type: "website",
      images: category.image_storage_path ? [{ url: category.image_storage_path, alt: category.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.name} · Kakeez Bakeshop`,
      description,
      images: category.image_storage_path ? [category.image_storage_path] : undefined,
    },
  }
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await fetchCategoryPage(slug)

  if (!data) notFound()

  const { category, products } = data
  const heroImage = category.image_storage_path || productHero(products[0]) || "/assets/welcome-1.png"

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-[clamp(92px,8vw,126px)]">
        <section className="mx-auto grid w-[min(1390px,calc(100%_-_32px))] gap-8 rounded-[18px] bg-accent-green p-5 md:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] md:p-8 lg:gap-12 lg:p-10">
          <div className="relative min-h-[280px] overflow-hidden rounded-[14px] border border-primary-brown/15 bg-[#ece9e2] md:min-h-[420px]">
            <Image src={heroImage} alt={category.name} fill priority sizes="(max-width: 768px) 100vw, 45vw" className="object-cover" />
          </div>

          <div className="flex flex-col justify-center py-4">
            <p className="ff-colville text-sm uppercase tracking-[0.12em] text-primary-brown/70">Kakeez category</p>
            <h1 className="ff-accia mt-3 text-[clamp(44px,6vw,86px)] leading-none text-primary-brown">{category.name}</h1>
            <p className="ff-accia-light mt-5 max-w-[620px] text-[clamp(17px,1.4vw,22px)] leading-[1.45] text-black/70">
              {category.description || `Explore our ${category.name.toLowerCase()} collection, baked fresh for gifting, gatherings, and everyday cravings.`}
            </p>
            <p className="ff-apfel mt-5 text-sm uppercase tracking-[0.14em] text-primary-brown/70">
              {products.length} item{products.length === 1 ? "" : "s"}
            </p>
          </div>
        </section>

        <section className="mx-auto mt-[clamp(42px,5vw,78px)] w-[min(1390px,calc(100%_-_32px))]">
          {products.length === 0 ? (
            <div className="rounded-[14px] border border-primary-brown/15 bg-accent-green/25 p-10 text-center">
              <h2 className="ff-accia text-[clamp(28px,3vw,42px)] text-primary-brown">Nothing here yet</h2>
              <p className="ff-accia-light mx-auto mt-3 max-w-[520px] text-black/60">
                This category is published, but its products are still being prepared.
              </p>
              <Link href="/" className="mt-6 inline-flex rounded-[10px] bg-primary-brown px-6 py-3 ff-accia text-white transition-opacity hover:opacity-90">
                Back to home
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const hero = productHero(product)
                const description = product.short_description || product.description

                return (
                  <article key={product.id} className="overflow-hidden rounded-[14px] border border-primary-brown bg-white transition-all hover:shadow-lg">
                    <Link href={`/product/${product.slug}`} className="block">
                      <div className="relative aspect-square bg-[#ece9e2]">
                        <Image
                          src={hero}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    </Link>
                    <div className="px-4 py-5 text-center">
                      <Link href={`/product/${product.slug}`} className="block">
                        <h2 className="ff-accia text-[clamp(25px,2.3vw,34px)] leading-[1.04] text-primary-brown">{product.name}</h2>
                        <p className="ff-colville mt-2 text-[clamp(18px,1.5vw,24px)] text-primary-brown">{formatPkr(product.base_price_minor)}</p>
                      </Link>
                      {description && (
                        <p className="ff-accia-light mx-auto mt-3 line-clamp-2 max-w-[28ch] text-sm capitalize leading-snug text-black/60">
                          {description}
                        </p>
                      )}
                      {product.rating_count && product.rating_count > 0 ? (
                        <p className="ff-apfel mt-3 text-xs text-primary-brown/60">
                          {Number(product.rating_avg ?? 0).toFixed(1)} / 5 · {product.rating_count} review{product.rating_count === 1 ? "" : "s"}
                        </p>
                      ) : null}
                      <Link
                        href={`/product/${product.slug}`}
                        className="mt-4 flex h-11 items-center justify-center rounded-[10px] bg-primary-brown px-3 ff-accia text-[15px] uppercase text-white transition-colors hover:bg-primary-brown/90"
                      >
                        View product
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <div className="mt-[clamp(56px,6vw,96px)] pb-6">
          <Footer variant="flow" />
        </div>
      </main>
    </div>
  )
}

function productHero(product?: ProductRow): string {
  if (!product) return "/assets/product.svg"
  return (product.product_images?.find((image) => image.is_featured) ?? product.product_images?.[0])?.storage_path ?? "/assets/product.svg"
}
