// Admin (service-role) Supabase client — bypasses RLS. Server-only.
//
// DO NOT IMPORT FROM A "use client" FILE. Importing here in a Client
// Component would either fail at build (SUPABASE_SERVICE_ROLE_KEY is
// undefined in the browser) or — far worse — accidentally ship the
// service-role key in the JS bundle. Static enforcement via the
// 'server-only' import below: any client-component path that imports this
// module fails the build.
//
// Use only for:
//   - SECURITY DEFINER RPCs invoked from server actions where RLS is
//     intentionally bypassed (e.g. atomic order creation that needs to
//     write to orders + order_items + payments + inventory_movements in
//     one shot — see ECOMMERCE_CMS_PLAN.md §G.X.1).
//   - Seed scripts and one-off admin tooling.
//   - Edge Function-side privileged work that can't be expressed as RPC.
//
// Never use this client to do something an RLS-scoped query could do
// safely. The service-role key is a root-level credential.

import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. The admin client cannot be created. ' +
        'Add it to .env.local (see .env.example). NEVER expose it as a NEXT_PUBLIC_* variable.'
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      // No session/refresh — this client is stateless, used per-request.
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
