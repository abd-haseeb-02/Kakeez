"use client"

import Image from "next/image"

type FooterProps = {
  topOffset?: number | string
  variant?: "absolute" | "flow"
}

export default function Footer(_props: FooterProps) {
  void _props

  return (
    <footer className="relative z-20 mx-auto w-[calc(100%_-_24px)] overflow-hidden border border-white bg-[#e1eab4] py-[clamp(24px,2.8vw,42px)] text-[#936939] lg:w-[calc(100%_-_40px)]">
      <div className="mx-auto w-[min(1390px,calc(100%_-_32px))]">
        <div className="grid gap-[clamp(24px,4vw,64px)] md:grid-cols-[1.35fr_0.65fr_0.65fr_0.8fr]">
          <div>
            <h2 className="ff-accia-bold text-[clamp(24px,2vw,30px)] leading-none">Stay in the Loop</h2>
            <p className="ff-colville-light mt-[clamp(12px,1.6vw,22px)] text-[clamp(14px,1vw,16px)]">We will not spam you, we promise.</p>
            <div className="mt-[clamp(20px,2vw,28px)] flex h-[44px] max-w-[310px] items-center justify-between rounded-[10px] border border-[#936939]/40 bg-white/10 px-4">
              <span className="ff-accia text-[15px] capitalize opacity-55">Your e-mail</span>
              <Image src="/assets/email-arrow.svg" alt="" width={14} height={14} />
            </div>
          </div>

          <div>
            <h3 className="ff-colville text-[clamp(19px,1.35vw,23px)] leading-tight">Inquiries</h3>
            <div className="ff-colville mt-3 space-y-2 text-[clamp(14px,0.95vw,16px)] capitalize">
              <p>Contact us</p>
              <p>Careers</p>
              <p>Gift Cards</p>
            </div>
          </div>

          <div>
            <h3 className="ff-colville text-[clamp(19px,1.35vw,23px)] leading-tight">About Us</h3>
            <div className="ff-colville mt-3 space-y-2 text-[clamp(14px,0.95vw,16px)] capitalize">
              <p>Our Story</p>
              <p>Menu</p>
              <p>Order now</p>
            </div>
          </div>

          <div>
            <h3 className="ff-colville text-[clamp(19px,1.35vw,23px)] leading-tight">Visit Us</h3>
            <p className="ff-colville-light mt-3 max-w-[190px] text-[clamp(14px,0.95vw,16px)] leading-snug">9998 Hayes Isle, Mantefurt 03581</p>
            <p className="ff-colville-light mt-3 text-[clamp(14px,0.95vw,16px)]">505-418-0415</p>
          </div>
        </div>

        <div className="mt-[clamp(24px,3vw,46px)] border-t border-[#936939]/20 pt-4 ff-colville text-[clamp(13px,0.9vw,15px)] capitalize">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>(c) 2022-24 Kakeez All rights reserved</p>
            <p>Terms & Conditions | Cookies | Privacy Policy</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
