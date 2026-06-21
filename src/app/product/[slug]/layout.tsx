import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

// Server-side metadata + JSON-LD for the product detail route. The page
// itself stays a Client Component (it needs the variation picker + cart
// interactivity), but Next 16 lets us colocate a Server Component layout
// that owns metadata. Cost: the product is read twice — once here for the
// meta + structured-data injection, once in the page for render. At
// Supabase + Postgres scale this is well below the threshold worth
// architecting around.
//
// What this closes from AUDIT.md:
//   * E.1 SEO is mostly static — title/description per product now.
//   * No product structured data — JSON-LD Product schema below.
//   * No canonical URLs — the canonical lives in the Metadata.alternates.

interface ProductMeta {
  id: string
  slug: string
  name: string
  description: string | null
  base_price_minor: number
  rating_avg: number | null
  rating_count: number | null
  product_images?: { storage_path: string; position: number; is_featured: boolean }[]
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function origin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

async function fetchProductMeta(slug: string): Promise<ProductMeta | null> {
  const supabase = await createClient()
  const query = "id, slug, name, description, base_price_minor, rating_avg, rating_count, product_images(storage_path, position, is_featured)"
  const { data } = await supabase
    .from('products')
    .select(query)
    .eq('slug', slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle<ProductMeta>()
  if (data || !UUID_RE.test(slug)) return data

  const { data: idData } = await supabase
    .from('products')
    .select(query)
    .eq('id', slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle<ProductMeta>()
  return idData
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const p = await fetchProductMeta(slug)
  if (!p) {
    return {
      title: 'Product not found · Kakeez',
      robots: { index: false, follow: false },
    }
  }
  const heroImg = p.product_images?.find((i) => i.is_featured) ?? p.product_images?.[0]
  const ogImg = heroImg?.storage_path
  const url = `${origin()}/product/${p.slug}`
  // Short description: prefer the product description, fall back to a
  // brand-flavored sentence so search snippets don't go blank.
  const desc = (p.description?.trim() || `${p.name} — handcrafted by Kakeez, every bite matters.`)
    .slice(0, 200)

  return {
    title: `${p.name} · Kakeez`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title: p.name,
      description: desc,
      url,
      type: 'website',
      images: ogImg ? [{ url: ogImg, alt: p.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: p.name,
      description: desc,
      images: ogImg ? [ogImg] : undefined,
    },
  }
}

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const p = await fetchProductMeta(slug)
  if (!p) return <>{children}</>

  const heroImg = p.product_images?.find((i) => i.is_featured) ?? p.product_images?.[0]
  const url = `${origin()}/product/${p.slug}`
  // Product JSON-LD per schema.org. Includes aggregateRating only when at
  // least one published review exists (Google's structured-data check
  // warns on aggregateRating with ratingCount = 0).
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: p.name,
    image: heroImg?.storage_path ?? undefined,
    description: p.description ?? undefined,
    url,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'PKR',
      price: (p.base_price_minor / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
    ...(p.rating_count && p.rating_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: p.rating_avg ?? 0,
            reviewCount: p.rating_count,
          },
        }
      : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        // dangerouslySetInnerHTML keeps the JSON literal intact; React would
        // otherwise wrap it in escaped quotes that break crawler parsers.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
