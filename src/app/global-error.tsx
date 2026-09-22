"use client"

// Last resort: catches errors thrown by the root layout itself, which
// src/app/error.tsx cannot — at that point React has already unmounted the
// layout, so this file has to supply its own <html> and <body>.
//
// Styles are inline for the same reason: if the failure was in the root layout,
// the stylesheet and font variables it sets up may never have been applied, so
// a Tailwind class here could render as unstyled text on white.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#fffdf7' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            padding: 24,
            textAlign: 'center',
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: '#262729',
          }}
        >
          <div style={{ fontSize: 26, letterSpacing: 2, fontWeight: 700, color: '#936939' }}>KAKEEZ</div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 400, color: '#936939' }}>Something went wrong</h1>
          <p style={{ margin: 0, maxWidth: 420, lineHeight: 1.6, color: 'rgba(38,39,41,0.65)' }}>
            The site hit an unexpected error. Reloading usually clears it — if not, call us on{' '}
            <a href="tel:+923174304211" style={{ color: '#936939' }}>0317 4304211</a> and we&rsquo;ll take your order directly.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 6,
              border: 0,
              borderRadius: 10,
              background: '#936939',
              color: '#fff',
              padding: '12px 28px',
              fontSize: 17,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(38,39,41,0.35)' }}>Reference: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  )
}
