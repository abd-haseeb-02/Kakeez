import Link from 'next/link'

// Where /auth/confirm sends anyone whose emailed link didn't redeem — expired,
// already used, or opened after the token's one-hour window. Kept deliberately
// plain: the person is locked out mid-flow, so the page's whole job is to name
// what happened and hand them the one button that unblocks them.

const RECOVERY_TYPES = new Set(['recovery'])

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

  const reason = first(params.reason)
  const type = first(params.type)
  const isRecovery = !!type && RECOVERY_TYPES.has(type)

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-3xl border border-primary-brown/15 bg-white p-8 shadow-sm">
          <h1 className="ff-accia text-[clamp(28px,2.2vw,36px)] text-primary-brown">
            {isRecovery ? 'Reset link expired' : 'Link no longer valid'}
          </h1>
          <p className="ff-accia-light text-sm text-black/60 mt-2">
            {isRecovery
              ? 'Password reset links last one hour and work only once. Request a fresh one and we\u2019ll send it straight over.'
              : 'Confirmation links last one hour and work only once. If you already confirmed, just sign in \u2014 otherwise sign up again to get a new link.'}
          </p>

          {reason && (
            <p className="ff-apfel text-xs text-black/40 mt-4 break-words">{reason}</p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={isRecovery ? '/forgot-password' : '/'}
              className="inline-flex items-center justify-center bg-primary-brown text-white px-5 py-3 rounded-lg ff-accia hover:bg-primary-brown/90 transition-all"
            >
              {isRecovery ? 'Request a new link' : 'Back to Kakeez'}
            </Link>
            {isRecovery && (
              <Link href="/" className="ff-apfel text-sm text-primary-brown/70 text-center hover:text-primary-brown">
                Back to Kakeez
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
