import type { MetadataRoute } from 'next'

// Public canonical origin. NEXT_PUBLIC_SITE_URL is honored when deployed
// behind a real domain; falls back to the Vercel preview URL in CI and to
// localhost so dev previews don't index against the wrong host either.
function origin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Every authenticated route + auth flows stay out of search indexes.
      // Matches the proxy.ts gating in src/proxy.ts.
      { userAgent: '*', allow: '/', disallow: ['/admin', '/account', '/checkout', '/forgot-password', '/reset-password'] },
    ],
    sitemap: `${origin()}/sitemap.xml`,
    host: origin(),
  }
}
