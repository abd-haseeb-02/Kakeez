// Landing point for password-recovery links, and nothing else.
//
// Why recovery doesn't share /auth/confirm: the destination is the one thing a
// reset link cannot afford to lose, and Supabase's stock recovery template
// loses it. That template links to `{{ .ConfirmationURL }}`, which round-trips
// through GoTrue and redirects back to whatever `redirectTo` the app passed —
// carrying a PKCE `code` and nothing else. No `type`, no `next`. Pointed at
// /auth/confirm, that lands the customer on the homepage: signed in, password
// unchanged, no route to the form that would change it. Which is exactly how
// "reset password is broken" presents.
//
// Giving recovery its own path puts the destination in the URL itself, where no
// template can drop it. That holds for every combination we can be in:
//
//   stock template    → /auth/recover?code=…                    → /reset-password
//   branded template  → /auth/recover?token_hash=…&type=recovery → /reset-password
//   dashboard button  → /auth/recover#access_token=…            → /reset-password
//
// so the flow keeps working whether or not supabase/templates/ has been pushed,
// which matters because pushing it needs SMTP credentials that arrive later.

import { type NextRequest } from 'next/server'
import { redeemAuthLink } from '@/lib/auth/confirm'

export async function GET(request: NextRequest) {
  return redeemAuthLink(request, { defaultNext: '/reset-password', pinned: true })
}
