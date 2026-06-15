"use client"

import Image from "next/image"

export default function Footer({ topOffset }: { topOffset: number }) {
  // original index.html had the footer at top-[425.1024vw].
  // By passing topOffset, we dynamically place it below all products.
  
  return (
    <>
      {/* Footer Content Box */}
      <div className="absolute left-1/2 -translate-x-1/2 w-[96.5278vw] h-[20.4861vw] bg-[#e1eab4] border-[0.1157vw] border-white border-solid overflow-hidden z-20" style={{ top: `${topOffset}vw` }}>
        <div className="absolute left-[6.3657vw] top-[2.3727vw] ff-accia-bold text-[2.0255vw] text-[#936939] whitespace-nowrap">Stay in the Loop</div>
        <div className="absolute left-[6.3657vw] top-[9.3171vw] w-[20.7176vw] h-[2.8935vw] border border-[#936939] border-solid opacity-40 rounded-[0.6944vw]" style={{ borderWidth:'0.0579vw' }}></div>
        <div className="absolute left-[7.3495vw] top-[10.0694vw] ff-accia text-[1.0417vw] text-[#936939] capitalize opacity-40 whitespace-nowrap" style={{ lineHeight:'1.4468vw' }}>Your e-mail</div>
        <div className="absolute left-[25.5208vw] top-[10.3588vw] w-[0.8102vw] h-[0.8102vw] opacity-40">
          <Image src="/assets/email-arrow.svg" alt="" width={14} height={14} className="block w-full h-full" />
        </div>
        <div className="absolute left-[14.5833vw] top-[5.6713vw] -translate-x-1/2 ff-colville-light text-[1.0417vw] text-[#936939] text-center whitespace-nowrap">We won't spam you, we promise.</div>

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
