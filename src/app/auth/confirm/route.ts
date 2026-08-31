// Landing point for every link Supabase Auth emails out — signup confirmation,
// password recovery, magic link, email change, invite.
//
// The templates in supabase/templates/*.html deliberately do NOT use
// `{{ .ConfirmationURL }}`. That variable round-trips through Supabase's own
// domain and, because the browser client runs PKCE, it only completes on the
// same device that started the flow — sign up on a laptop, open the mail on a
// phone, and the code verifier isn't there. Instead the templates hand us
// `{{ .TokenHash }}` and we redeem it server-side with verifyOtp, which works
// from any device and writes the session straight into cookies here (a Route
// Handler can set cookies; a Server Component can't — see
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md).
//
// The `code` branch is kept as a fallback so links generated the old way — or
// from the Supabase dashboard's "send magic link" button — still resolve.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Mirrors @supabase/auth-js's EmailOtpType. Redeclared rather than imported:
// supabase-js doesn't re-export it, and we need the runtime array anyway to
// validate the `type` that arrives from the query string.
const OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const
type OtpType = (typeof OTP_TYPES)[number]

const isOtpType = (value: string | null): value is OtpType =>
  !!value && (OTP_TYPES as readonly string[]).includes(value)

// Only ever redirect to a path on this site. An open redirect here would let
// anyone turn a kakeez.com auth link into a link to their own page.
function safeNext(raw: string | null): string {
  if (!raw) return '/'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/'
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const next = safeNext(searchParams.get('next'))
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')

  // Supabase reports its own failures (expired link, already used) by
  // redirecting here with error params rather than a token.
  const providerError = searchParams.get('error_description') || searchParams.get('error')

  const failure = (reason: string) => {
    const url = new URL('/auth/error', origin)
    url.searchParams.set('reason', reason)
    if (type) url.searchParams.set('type', type)
    return NextResponse.redirect(url)
  }

  if (providerError) return failure(providerError)

  const supabase = await createClient()

  if (tokenHash && isOtpType(type)) {
    let { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    // `email` and `signup` both address a signup confirmation depending on how
    // the token was minted; retry once across that pair before giving up so a
    // template/GoTrue mismatch can't strand a new customer.
    if (error && (type === 'email' || type === 'signup')) {
      const alternate: OtpType = type === 'email' ? 'signup' : 'email'
      const retry = await supabase.auth.verifyOtp({ type: alternate, token_hash: tokenHash })
      error = retry.error
    }

    if (error) return failure(error.message)
    return NextResponse.redirect(new URL(next, origin))
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return failure(error.message)
    return NextResponse.redirect(new URL(next, origin))
  }

  return failure('This link is missing its confirmation token.')
}
