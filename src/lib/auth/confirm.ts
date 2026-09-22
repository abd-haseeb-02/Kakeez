// Shared redemption logic for every link Supabase Auth mails out — signup
// confirmation, password recovery, magic link, email change, invite.
//
// Two route handlers sit on top of this: /auth/confirm (general) and
// /auth/recover (password reset). They differ only in where a successful
// redemption lands, which is the whole reason this file exists — see
// `landing` below.
//
// A link can arrive in one of two shapes, and we have to handle both because
// which one we get depends on whether the branded templates in
// supabase/templates/ have been pushed yet:
//
//   ?token_hash=…&type=…  The branded templates. Redeemed here with verifyOtp,
//                         which works from ANY device: the token is self-
//                         contained, so signing up on a laptop and opening the
//                         mail on a phone still completes.
//
//   ?code=…               Supabase's stock templates ({{ .ConfirmationURL }}),
//                         and the dashboard's own "send link" buttons. The link
//                         round-trips through GoTrue, which redirects back here
//                         with a PKCE auth code. Because the browser client runs
//                         PKCE, completing it needs the code-verifier cookie
//                         that @supabase/ssr wrote when the flow started — so
//                         this shape only completes on the same browser.
//
// Both write the session straight into cookies: a Route Handler can set cookies
// and Next merges them onto whatever Response we return, including a redirect
// (node_modules/next/dist/server/route-modules/app-route/module.js applies
// `appendMutableCookies` to the handler's response). A Server Component can't —
// see node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md.

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
function safeNext(raw: string | null, fallback: string): string {
  if (!raw) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback
  return raw
}

// GoTrue's message for "PKCE code arrived without the verifier cookie" is
// accurate but unreadable, and it's the one failure a customer can actually
// provoke by accident (open the reset mail on their phone when they requested
// it on their laptop). Say what happened in words they can act on.
function humanize(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('code verifier') || m.includes('code challenge')) {
    return 'This link has to be opened in the same browser that asked for it.'
  }
  if (m.includes('expired') || m.includes('invalid')) {
    return 'This link has expired or has already been used.'
  }
  return message
}

export type LandingOptions = {
  // Where to send the person once the token is redeemed. `/auth/confirm` passes
  // '/' and lets the link's own `next` override it; `/auth/recover` passes
  // '/reset-password' and pins it, because a recovery link that drops its
  // destination leaves the customer signed in on the homepage with no way to
  // reach the "set a new password" form — which is precisely what Supabase's
  // stock template does, since it carries no `next` at all.
  defaultNext: string
  pinned?: boolean
}

export async function redeemAuthLink(
  request: NextRequest,
  { defaultNext, pinned = false }: LandingOptions
): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const code = searchParams.get('code')

  const next = pinned ? defaultNext : safeNext(searchParams.get('next'), defaultNext)

  // Supabase reports its own failures (expired link, already used) by
  // redirecting here with error params rather than a token.
  const providerError = searchParams.get('error_description') || searchParams.get('error')

  const failure = (reason: string) => {
    // Keep the provider's own wording in the server log. The page shows the
    // humanized version, and without this the exact reason a link died is lost
    // — which is the first thing worth knowing when someone reports that
    // theirs didn't work.
    console.warn('[kakeez auth] link redemption failed', {
      path: request.nextUrl.pathname,
      type: type ?? null,
      shape: tokenHash ? 'token_hash' : code ? 'code' : 'none',
      reason,
    })

    const url = new URL('/auth/error', origin)
    url.searchParams.set('reason', humanize(reason))
    // /auth/error tailors its copy and its one button by type. A recovery link
    // that arrived without a `type` (the stock template again) still needs to
    // send people back to /forgot-password rather than the homepage, so a
    // pinned route asserts its own type.
    const effectiveType = type || (pinned && defaultNext === '/reset-password' ? 'recovery' : null)
    if (effectiveType) url.searchParams.set('type', effectiveType)
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

  // Nothing usable in the query string. One case is still recoverable: GoTrue's
  // implicit flow returns the session in the URL *fragment*, which never
  // reaches the server. Forward to the destination and let the browser client
  // (detectSessionInUrl) pick it up — the fragment survives a redirect, so it
  // arrives intact. Only worth doing where the destination knows what to do
  // with a session it didn't expect, which today means /reset-password.
  if (pinned) return NextResponse.redirect(new URL(next, origin))

  return failure('This link is missing its confirmation token.')
}
