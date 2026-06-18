import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

function origin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

// Dynamic sitemap: static marketing pages + every published product + every
// category. Reads via the server Supabase client so RLS sees `anon` and
// drafts/archived rows are excluded by the existing public read policies.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = origin()
  const now = new Date()

  const supabase = await createClient()

  const [productsRes, categoriesRes] = await Promise.all([
    supabase
      .from('products')
      .select('slug, updated_at, status, deleted_at')
      .eq('status', 'published')
      .is('deleted_at', null),
    supabase.from('categories').select('slug, updated_at, status').eq('status', 'published'),
  ])

  const products: MetadataRoute.Sitemap = (productsRes.data ?? []).map((p: { slug: string; updated_at: string | null }) => ({
    url: `${base}/product/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Categories don't yet have a /category/[slug] route — sitemap entries
  // queued so when Phase 6 part 3 wires them up, search engines pick them
  // up immediately. Comment out the line below to drop them until then.
  const _categoriesForFutureRoute: MetadataRoute.Sitemap = (categoriesRes.data ?? []).map((c: { slug: string; updated_at: string | null }) => ({
    url: `${base}/category/${c.slug}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))
  // intentionally unused for now — kept for documentation. Hide from tsc.
  void _categoriesForFutureRoute

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`,         lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/menu`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/catering`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
  ]

  return [...staticPages, ...products]
}
