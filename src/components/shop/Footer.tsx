"use client"

import Image from "next/image"

type FooterProps = {
  topOffset?: number | string
  variant?: "absolute" | "flow"
}

export default function Footer({ topOffset = 0, variant = "absolute" }: FooterProps) {
  // original index.html had the footer at top-[425.1024vw].
  // By passing topOffset, we dynamically place it below all products.

  if (variant === "flow") {
    return (
      <footer className="relative z-20 mx-auto w-[min(96vw,1390px)] overflow-hidden border border-white bg-[#e1eab4] px-[clamp(22px,4.4vw,72px)] py-[clamp(24px,2.8vw,42px)] text-[#936939]">
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
      </footer>
    )
  }
  
  return (
    <>
      {/* Footer Content Box */}
      <div className="absolute left-1/2 -translate-x-1/2 w-[96.5278vw] h-[20.4861vw] bg-[#e1eab4] border-[0.1157vw] border-white border-solid overflow-hidden z-20" style={{ top: typeof topOffset === "number" ? `${topOffset}vw` : topOffset }}>
        <div className="absolute left-[6.3657vw] top-[2.3727vw] ff-accia-bold text-[2.0255vw] text-[#936939] whitespace-nowrap">Stay in the Loop</div>
        <div className="absolute left-[6.3657vw] top-[9.3171vw] w-[20.7176vw] h-[2.8935vw] border border-[#936939] border-solid opacity-40 rounded-[0.6944vw]" style={{ borderWidth:'0.0579vw' }}></div>
        <div className="absolute left-[7.3495vw] top-[10.0694vw] ff-accia text-[1.0417vw] text-[#936939] capitalize opacity-40 whitespace-nowrap" style={{ lineHeight:'1.4468vw' }}>Your e-mail</div>
        <div className="absolute left-[25.5208vw] top-[10.3588vw] w-[0.8102vw] h-[0.8102vw] opacity-40">
          <Image src="/assets/email-arrow.svg" alt="" width={14} height={14} className="block w-full h-full" />
        </div>
        <div className="absolute left-[14.5833vw] top-[5.6713vw] -translate-x-1/2 ff-colville-light text-[1.0417vw] text-[#936939] text-center whitespace-nowrap">We will not spam you, we promise.</div>

        <div className="absolute left-[53.3565vw] top-[2.8356vw] w-[9.7801vw] ff-colville text-[1.6204vw] text-[#936939] tracking-[-0.0324vw]" style={{ lineHeight:'2.3727vw' }}>Inquiries</div>
        <div className="absolute left-[53.3565vw] top-[5.3241vw] ff-colville text-[0.9259vw] text-[#936939] capitalize whitespace-nowrap">
          <p style={{ lineHeight:'2.2569vw' }}>Contact us</p><p style={{ lineHeight:'2.2569vw' }}>Careers</p><p style={{ lineHeight:'2.2569vw' }}>Gift Cards</p>
        </div>

        <div className="absolute left-[65.3356vw] top-[2.8356vw] w-[9.7801vw] ff-colville text-[1.6204vw] text-[#936939] tracking-[-0.0324vw]" style={{ lineHeight:'2.3727vw' }}>About Us</div>
        <div className="absolute left-[65.3356vw] top-[5.3241vw] ff-colville text-[0.9259vw] text-[#936939] capitalize whitespace-nowrap">
          <p style={{ lineHeight:'2.2569vw' }}>Our Story</p><p style={{ lineHeight:'2.2569vw' }}>Menu</p><p style={{ lineHeight:'2.2569vw' }}>Order now</p>
        </div>

        <div className="absolute left-[80.4398vw] top-[2.8356vw] ff-colville text-[1.6204vw] text-[#936939] tracking-[-0.0324vw] whitespace-nowrap" style={{ lineHeight:'2.3727vw' }}>vISIT US</div>
        <div className="absolute left-[81.8287vw] top-[5.9028vw] w-[11.1111vw] ff-colville-light text-[1.0417vw] text-[#936939]">9998 Hayes Isle, Mantefurt 03581</div>
        <div className="absolute left-[84.6933vw] top-[9.8958vw] -translate-x-1/2 ff-colville-light text-[1.0417vw] text-[#936939] text-center whitespace-nowrap">505-418-0415</div>

        <div className="absolute left-[6.3657vw] top-[15.9144vw] w-[79.8043vw] h-px">
          <Image src="/assets/line102.svg" alt="" width={1379} height={1} className="block w-full h-full" />
        </div>
        <div className="absolute left-[6.3657vw] top-[17.1672vw] ff-colville text-[0.9259vw] text-[#936939] capitalize whitespace-nowrap" style={{ lineHeight:'1.8095vw' }}>© 2022-24 kAKEEZ All rights reserved</div>
        <div className="absolute left-[65.1985vw] top-[17.1672vw] ff-colville text-[0.9259vw] text-[#936939] capitalize whitespace-pre" style={{ lineHeight:'1.8095vw' }}>Terms & Conditions     |     Cookies     |     Privacy Policy</div>
      </div>
    </>
  )
}
