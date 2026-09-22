"use client"

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCw, Home, AlertTriangle } from 'lucide-react'
import { CONTACT } from '@/lib/contact'

// Route-level error boundary. Without it, any thrown render error anywhere in
// the app fell through to Next's built-in error screen: unbranded, and — in
// production, where the message is stripped — a bare "Application error: a
// client-side exception has occurred" with no way out but the back button.
//
// Deliberately plain and dependency-free. Navbar pulls in the cart store and
// Supabase, and a boundary that can itself throw is worse than no boundary.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Next strips the message in production builds but keeps `digest`, which is
    // what ties this render to a line in the server logs.
    console.error('[kakeez] render error', { message: error.message, digest: error.digest })
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent-green/50">
        <AlertTriangle className="h-9 w-9 text-primary-brown" />
      </div>

      <h1 className="ff-accia mt-6 text-[clamp(32px,3vw,48px)] leading-tight text-primary-brown">
        Something went wrong
      </h1>
      <p className="ff-accia-light mt-3 max-w-md text-[clamp(16px,1.2vw,19px)] leading-relaxed text-black/60">
        That&rsquo;s on us, not you. Try again &mdash; and if it keeps happening, call us on
        {' '}
        <a href={CONTACT.phoneHref} className="text-primary-brown underline underline-offset-2">{CONTACT.phone}</a>
        {' '}and we&rsquo;ll take your order directly.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary-brown px-7 py-3 ff-accia text-[17px] text-white transition-all hover:bg-primary-brown/90"
        >
          <RotateCw className="h-4 w-4" /> Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-primary-brown px-7 py-3 ff-accia text-[17px] text-primary-brown transition-all hover:bg-primary-brown/5"
        >
          <Home className="h-4 w-4" /> Back to Kakeez
        </Link>
      </div>

      {error.digest && (
        <p className="ff-apfel mt-8 text-[12px] text-black/35">
          Reference: {error.digest}
        </p>
      )}
    </div>
  )
}
