import type { MetadataRoute } from "next"
import { createClient } from "@/lib/supabase/server"

function origin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  )
}

// Dynamic sitemap: static marketing pages, published categories, and every
// published product. The server Supabase client keeps public RLS in force.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = origin()
  const now = new Date()
  const supabase = await createClient()

  const [productsRes, categoriesRes] = await Promise.all([
    supabase
      .from("products")
      .select("slug, updated_at, status, deleted_at")
      .eq("status", "published")
      .is("deleted_at", null),
    supabase
      .from("categories")
      .select("slug, updated_at, status")
      .eq("status", "published"),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/menu`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/catering`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
  ]

  const categories: MetadataRoute.Sitemap = (categoriesRes.data ?? []).map((category: { slug: string; updated_at: string | null }) => ({
    url: `${base}/category/${category.slug}`,
    lastModified: category.updated_at ? new Date(category.updated_at) : now,
    changeFrequency: "weekly",
    priority: 0.6,
  }))

  const products: MetadataRoute.Sitemap = (productsRes.data ?? []).map((product: { slug: string; updated_at: string | null }) => ({
    url: `${base}/product/${product.slug}`,
    lastModified: product.updated_at ? new Date(product.updated_at) : now,
    changeFrequency: "weekly",
    priority: 0.8,
  }))

  return [...staticPages, ...categories, ...products]
}
