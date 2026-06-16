"use client"

import Link from "next/link"
import Navbar from "./Navbar"
import Footer from "./Footer"

export default function SimplePage({ title, subtitle, body }: { title: string; subtitle?: string; body?: string }) {
  return (
    <div className="relative bg-white w-full overflow-hidden" style={{ minHeight: "60vw" }}>
      <Navbar />

      <div className="flex flex-col items-center justify-center text-center px-[8vw] pt-[clamp(122px,8.8vw,150px)] pb-[10vw] gap-[1.5vw]">
        {subtitle && <p className="ff-accia text-[1vw] text-primary-brown uppercase tracking-[0.2em]">— {subtitle}</p>}
        <h1 className="ff-accia text-[4vw] text-primary-brown leading-[1.05]">{title}</h1>
        <p className="ff-accia-light text-[1.3vw] text-black/60 max-w-[45vw]">
          {body || "This page is freshly out of the oven soon. In the meantime, browse our best sellers and treat yourself."}
        </p>
        <Link href="/" className="mt-[1vw] bg-primary-brown text-white px-[3vw] py-[1vw] rounded-[0.8vw] ff-accia text-[1.3vw] hover:bg-primary-brown/90 transition-all">
          Back to Shop
        </Link>
      </div>

      <div className="relative w-full h-[20.5vw] mt-[6vw]">
        <Footer topOffset={0} />
      </div>
    </div>
  )
}
