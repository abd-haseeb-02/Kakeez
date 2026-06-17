// Server Supabase client — cookie-aware, runs in Server Components,
// Server Actions, Route Handlers, and the proxy file (Next 16's renamed
// middleware).
//
// Uses the same anon key as the browser client, but threads the user's
// session through HTTP cookies so RLS sees `authenticated` instead of
// `anon` for signed-in requests.
//
// Caveat: in pure Server Components (which can READ cookies but not WRITE
// them — see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md),
// the @supabase/ssr cookie `setAll` handler will throw. The try/catch
// swallow is the documented escape hatch: rendering proceeds with the
// session as-read; refresh/rotation happens on the next Server Function /
// Route Handler / proxy pass that does have write access.

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

type CookiePayload = { name: string; value: string; options: CookieOptions }

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookiePayload[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Server Components can't set cookies. The session will be
            // refreshed by the next Server Action / Route Handler / proxy.
          }
        },
      },
    }
  )
}
