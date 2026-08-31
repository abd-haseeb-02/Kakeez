// Canonical public origin for this deployment.
//
// Every URL that leaves the app — Supabase Auth `emailRedirectTo`/`redirectTo`
// above all — has to be absolute, and it has to point at the origin the person
// actually browses. Guessing wrong is how a confirmation email ends up linking
// to http://localhost:3000.
//
// Resolution order, most explicit first:
//   1. NEXT_PUBLIC_SITE_URL  — set on Vercel Production to https://www.kakeez.com.
//   2. window.location.origin — browser fallback, so preview deploys and local
//      dev mail themselves back rather than bouncing to production.
//   3. VERCEL_URL            — server-side preview/branch deploys.
//   4. http://localhost:3000 — last resort for `next dev`.
//
// Whatever this returns must also be on the Supabase Auth redirect allow-list
// (supabase/config.toml → [auth] additional_redirect_urls); Supabase silently
// falls back to its own Site URL for any redirect target that isn't listed.

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, '')

export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL
  if (configured) return stripTrailingSlash(configured)

  if (typeof window !== 'undefined') return stripTrailingSlash(window.location.origin)

  if (process.env.VERCEL_URL) return `https://${stripTrailingSlash(process.env.VERCEL_URL)}`

  return 'http://localhost:3000'
}

// Absolute URL for a path on this site, e.g. absoluteUrl('/auth/confirm').
export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}

// The single landing point for every emailed auth link. Supabase templates
// append `?token_hash=…&type=…&next=…` to it — see supabase/templates/*.html
// and src/app/auth/confirm/route.ts.
export function authConfirmUrl(): string {
  return absoluteUrl('/auth/confirm')
}
