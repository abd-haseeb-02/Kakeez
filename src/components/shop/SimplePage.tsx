"use client"

import Link from "next/link"
import Navbar from "./Navbar"
import Footer from "./Footer"

export default function SimplePage({ title, subtitle, body }: { title: string; subtitle?: string; body?: string }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-white">
      <Navbar />

      <div className="mx-auto flex w-[min(860px,calc(100%_-_32px))] flex-col items-center justify-center gap-[clamp(18px,1.5vw,28px)] px-4 pb-[clamp(72px,8vw,140px)] pt-[clamp(122px,8.8vw,150px)] text-center">
        {subtitle && <p className="ff-accia text-[clamp(14px,1vw,17px)] uppercase tracking-[0.2em] text-primary-brown">- {subtitle}</p>}
        <h1 className="ff-accia text-[clamp(44px,4vw,72px)] leading-[1.05] text-primary-brown">{title}</h1>
        <p className="max-w-[680px] ff-accia-light text-[clamp(17px,1.3vw,24px)] text-black/60">
          {body || "This page is freshly out of the oven soon. In the meantime, browse our best sellers and treat yourself."}
        </p>
        <Link href="/" className="mt-[clamp(8px,1vw,18px)] rounded-[10px] bg-primary-brown px-[clamp(28px,3vw,52px)] py-[clamp(12px,1vw,18px)] ff-accia text-[clamp(17px,1.3vw,23px)] text-white transition-all hover:bg-primary-brown/90">
          Back to Shop
        </Link>
      </div>

      <div className="pb-6">
        <Footer variant="flow" />
      </div>
    </div>
  )
}
