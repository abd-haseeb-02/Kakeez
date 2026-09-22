import Link from 'next/link'
import { Search, Home, CakeSlice } from 'lucide-react'
import Navbar from '@/components/shop/Navbar'
import Footer from '@/components/shop/Footer'

// Shown for every 404: a mistyped URL, a delisted product, a category that was
// renamed. `notFound()` is called from src/app/product/[slug]/page.tsx and
// src/app/category/[slug]/page.tsx, and until this file existed all of them
// fell through to Next's built-in page — black background, white Helvetica, no
// navigation, no way back. Product URLs live in the sitemap and in Google's
// index long after a cake stops being sold, so this is a page real customers
// reach, and it should look like the shop rather than like an outage.

export const metadata = {
  title: 'Page not found · Kakeez',
  robots: { index: false, follow: true },
}

const CATEGORIES = [
  { slug: 'simple-cakes', label: 'Simple Cakes' },
  { slug: 'customized-cake', label: 'Customized Cakes' },
  { slug: 'cup-cakes', label: 'Cupcakes' },
  { slug: 'cookies', label: 'Cookies' },
]

export default function NotFound() {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white">
      <Navbar />

      <main className="mx-auto w-[min(720px,calc(100%-32px))] pt-[140px] pb-20 text-center lg:pt-[170px]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent-green/50">
          <CakeSlice className="h-10 w-10 text-primary-brown" />
        </div>

        <p className="ff-apfel mt-6 text-[13px] uppercase tracking-[0.3em] text-primary-brown/60">Error 404</p>
        <h1 className="ff-accia mt-2 text-[clamp(38px,4vw,60px)] leading-[1.05] text-primary-brown">
          We couldn&rsquo;t find that page
        </h1>
        <p className="ff-accia-light mx-auto mt-4 max-w-md text-[clamp(16px,1.2vw,19px)] leading-relaxed text-black/60">
          The link may be out of date, or the treat you were after is no longer on the menu.
          Everything we&rsquo;re baking today is a tap away.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary-brown px-7 py-3 ff-accia text-[17px] text-white transition-all hover:bg-primary-brown/90"
          >
            <Home className="h-4 w-4" /> Back to Kakeez
          </Link>
          <Link
            href="/#menu"
            className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-primary-brown px-7 py-3 ff-accia text-[17px] text-primary-brown transition-all hover:bg-primary-brown/5"
          >
            <Search className="h-4 w-4" /> Browse the menu
          </Link>
        </div>

        <div className="mt-12 border-t border-primary-brown/15 pt-8">
          <p className="ff-apfel text-[13px] uppercase tracking-[0.2em] text-primary-brown/50">Or jump straight to</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="rounded-full border border-primary-brown/30 px-4 py-1.5 ff-apfel text-sm text-primary-brown transition-colors hover:border-primary-brown hover:bg-primary-brown/5"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <div className="pb-6">
        <Footer variant="flow" />
      </div>
    </div>
  )
}
