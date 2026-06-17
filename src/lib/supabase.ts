// Back-compat shim. Existing call sites import `{ supabase } from "@/lib/supabase"`
// — keep that working while we migrate them, one route at a time, to the
// explicit three-client pattern in ./supabase/{browser,server,admin}.ts.
//
// New code should NOT import from here. Use:
//   - createClient() from "@/lib/supabase/browser" inside "use client" files
//   - createClient() from "@/lib/supabase/server" in Server Components, Server
//     Actions, Route Handlers, and proxy.ts
//   - createAdminClient() from "@/lib/supabase/admin" only for privileged
//     server-only operations
//
// The default export below is identical to the browser client (anon key,
// subject to RLS) so existing storefront/admin Client Components behave the
// same as before until each one is migrated.

import { createClient } from './supabase/browser'

export const supabase = createClient()
