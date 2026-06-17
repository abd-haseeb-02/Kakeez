// Next 16 Proxy file — renamed from middleware.ts. Runs before requests
// matching `config.matcher` complete. Per node_modules/next/dist/docs/01-app/
// 01-getting-started/16-proxy.md it is intentionally lightweight: do
// optimistic auth checks and redirects, not full authorization (RLS is the
// real backstop on data).
//
// Three gated areas at launch:
//   /admin/*    — signed-in only. Full role-based admin check stays in the
//                 client layout for now (proxy can't read profiles without
//                 a round-trip we want to keep off the hot path).
//                 /admin/login is excluded — it's the entry point.
//   /account/*  — signed-in only. Redirects unauthed users home.
//   /checkout   — signed-in only. Redirects unauthed users home.
//
// Important detail from the @supabase/ssr Next.js guide: getUser() MUST be
// called inside the proxy so the session cookie gets refreshed in flight.
// Without it the client side ends up holding a stale token. The user value
// itself drives the redirect decision.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookiePayload = { name: string; value: string; options: CookieOptions }

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookiePayload[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Force a session refresh / read. The result also drives the gating below.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // /admin/login is the only public admin path. Everything else under /admin
  // and all of /account + /checkout require a session.
  const isAdminGated   = pathname.startsWith('/admin') && pathname !== '/admin/login'
  const isAccountGated = pathname.startsWith('/account')
  const isCheckoutGated = pathname === '/checkout' || pathname.startsWith('/checkout/')

  if ((isAdminGated || isAccountGated || isCheckoutGated) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = isAdminGated ? '/admin/login' : '/'
    // Preserve where they were headed so we can land them back after login.
    if (isAdminGated || isAccountGated) {
      url.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Match every request EXCEPT static assets + Next internals + the public
  // image bucket. Without an exclude clause the auth.getUser() round-trip
  // would fire on every CSS/JS chunk request.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets/|images/).*)',
  ],
}
