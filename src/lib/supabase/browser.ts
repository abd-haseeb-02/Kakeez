// Browser Supabase client — for use in "use client" components only.
//
// Reads the public anon (publishable) key. Safe to ship to the browser.
// Subject to RLS — every query a Client Component issues runs as either
// `anon` (signed-out) or `authenticated` (signed-in) and only sees the rows
// our RLS policies allow.
//
// For server-side reads/writes that need the caller's session, use
// ../supabase/server.ts. For privileged operations, use ../supabase/admin.ts
// (server-only, never imported from a "use client" file).

import { createBrowserClient } from '@supabase/ssr'

let cached: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  // The browser client is safe to memoize — one instance per page load shares
  // the auth state across components and avoids redundant cookie parsing.
  if (cached) return cached
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return cached
}
