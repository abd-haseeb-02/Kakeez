"use client"

import Image from "next/image"

export default function Hero() {
  const HERO_PATH = "M1668 627H1667.04C1667.67 634.793 1668 642.743 1668 650.816C1668 750.65 1618.08 831.582 1556.5 831.582C1521.32 831.582 1489.95 805.172 1469.51 763.915C1449.68 830.732 1408.58 876.633 1361.09 876.633C1311.32 876.633 1268.56 826.199 1249.95 754.106C1232.05 774.447 1209.67 786.531 1185.4 786.531C1149.35 786.531 1117.49 759.891 1098.24 719.133C1077.8 760.236 1046.49 786.531 1011.39 786.531C976.209 786.531 944.837 760.121 924.401 718.863C904.565 785.681 863.465 831.582 815.979 831.582C766.205 831.582 723.447 781.149 704.839 709.057C686.933 729.397 664.557 741.48 640.282 741.48C618.643 741.48 598.513 731.879 581.712 715.385C565.679 783.331 525.085 831.582 477.537 831.582C442.36 831.582 410.987 805.172 390.552 763.915C370.715 830.732 329.615 876.633 282.13 876.633C232.355 876.633 189.597 826.199 170.989 754.106C153.083 774.447 130.707 786.531 106.433 786.531C47.6518 786.531 4.16107e-06 715.685 0 628.291C0 627.86 0.00354853 627.43 0.00585938 627H0V0H1668V627Z"

  return (
    <>
      <div className="absolute left-[1.7361vw] top-[6.5vw] w-[96.5278vw] h-[50.7311vw] z-10">
        <svg className="block w-full h-full" viewBox="0 0 1668 876.633" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs><clipPath id="heroClip" clipPathUnits="userSpaceOnUse"><path d={HERO_PATH}/></clipPath></defs>
          <image href="/assets/hero.png" x="0" y="0" width="1668" height="876.633" preserveAspectRatio="xMidYMid slice" clipPath="url(#heroClip)"/>
        </svg>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 top-[24.8vw] ff-accia-light text-[2.0099vw] text-[#936939] text-center leading-[0.84] whitespace-nowrap z-20">Bite Ino The Bliss</div>
      <p className="absolute left-1/2 -translate-x-1/2 top-[27.18vw] ff-accia-medium text-[6.9444vw] text-[#936939] text-center leading-[0.84] whitespace-nowrap z-20" style={{ textShadow:'0.2894vw 0.6944vw 0.9144vw rgba(0,0,0,0.25)' }}>Paradise<br/>Awaits</p>
      <div className="absolute left-[93.7500vw] top-[27.18vw] w-[2.8935vw] h-[5.7870vw] z-20">
        <Image src="/assets/arrow-right.svg" alt="next" width={50} height={100} className="block w-full h-full" />
      </div>
      <div className="absolute left-[3.4144vw] top-[27.18vw] w-[2.8935vw] h-[5.7870vw] flex items-center justify-center z-20">
        <div className="w-[2.8935vw] h-[5.7870vw]" style={{ transform:'rotate(180deg) scaleY(-1)' }}>
          <Image src="/assets/arrow-left.svg" alt="prev" width={50} height={100} className="block w-full h-full" />
        </div>
      </div>
    </>
  )
}
