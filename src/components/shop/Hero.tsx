"use client"

import Image from "next/image"
import type { CSSProperties } from "react"
import { useEffect, useState } from "react"

const HERO_PATH = "M1668 627H1667.04C1667.67 634.793 1668 642.743 1668 650.816C1668 750.65 1618.08 831.582 1556.5 831.582C1521.32 831.582 1489.95 805.172 1469.51 763.915C1449.68 830.732 1408.58 876.633 1361.09 876.633C1311.32 876.633 1268.56 826.199 1249.95 754.106C1232.05 774.447 1209.67 786.531 1185.4 786.531C1149.35 786.531 1117.49 759.891 1098.24 719.133C1077.8 760.236 1046.49 786.531 1011.39 786.531C976.209 786.531 944.837 760.121 924.401 718.863C904.565 785.681 863.465 831.582 815.979 831.582C766.205 831.582 723.447 781.149 704.839 709.057C686.933 729.397 664.557 741.48 640.282 741.48C618.643 741.48 598.513 731.879 581.712 715.385C565.679 783.331 525.085 831.582 477.537 831.582C442.36 831.582 410.987 805.172 390.552 763.915C370.715 830.732 329.615 876.633 282.13 876.633C232.355 876.633 189.597 826.199 170.989 754.106C153.083 774.447 130.707 786.531 106.433 786.531C47.6518 786.531 4.16107e-06 715.685 0 628.291C0 627.86 0.00354853 627.43 0.00585938 627H0V0H1668V627Z"

const SLIDES = [
  {
    id: "hero-1",
    image: "/assets/hero.png",
    eyebrow: "Bite Ino The Bliss",
    title: ["Paradise", "Awaits"],
  },
  {
    id: "hero-2",
    image: "/assets/hero.png",
    eyebrow: "Bite Ino The Bliss",
    title: ["Paradise", "Awaits"],
  },
  {
    id: "hero-3",
    image: "/assets/hero.png",
    eyebrow: "Bite Ino The Bliss",
    title: ["Paradise", "Awaits"],
  },
]

const HERO_NAV_HEIGHT = "clamp(84px, 6.9vw, 118px)"

export default function Hero() {
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % SLIDES.length)
    }, 6000)

    return () => window.clearInterval(timer)
  }, [])

  const goToPrevious = () => {
    setActiveSlide((current) => (current - 1 + SLIDES.length) % SLIDES.length)
  }

  const goToNext = () => {
    setActiveSlide((current) => (current + 1) % SLIDES.length)
  }

  return (
    <div
      className="absolute left-[1.7361vw] top-[6.5vw] z-10 h-[50.7311vw] w-[96.5278vw] md:top-[var(--hero-nav-height)] md:h-[calc(100vh-var(--hero-nav-height))]"
      style={{ "--hero-nav-height": HERO_NAV_HEIGHT } as CSSProperties}
    >
        <svg className="block w-full h-full" viewBox="0 0 1668 876.633" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs><clipPath id="heroClip" clipPathUnits="userSpaceOnUse"><path d={HERO_PATH}/></clipPath></defs>
          <g clipPath="url(#heroClip)">
            <g
              className="transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(${-activeSlide * 1668}px)` }}
            >
              {SLIDES.map((item, index) => {
                const offset = index * 1668

                return (
                  <g key={item.id}>
                    <image
                      href={item.image}
                      x={offset}
                      y="0"
                      width="1668"
                      height="876.633"
                      preserveAspectRatio="xMidYMid slice"
                    />
                    <text
                      x={offset + 834}
                      y="360"
                      textAnchor="middle"
                      fill="#936939"
                      fontFamily="var(--accia)"
                      fontSize="35"
                      fontWeight="300"
                    >
                      {item.eyebrow}
                    </text>
                    <text
                      x={offset + 834}
                      y="440"
                      textAnchor="middle"
                      fill="#936939"
                      fontFamily="var(--accia)"
                      fontSize="116"
                      fontWeight="500"
                      style={{ filter: "drop-shadow(5px 12px 14px rgba(0,0,0,0.25))" }}
                    >
                      {item.title.map((line, lineIndex) => (
                        <tspan key={line} x={offset + 834} dy={lineIndex === 0 ? 0 : 100}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </g>
                )
              })}
            </g>
          </g>
        </svg>

      <button type="button" onClick={goToNext} aria-label="Next hero slide" className="absolute right-[1.7vw] top-1/2 z-20 h-[clamp(46px,5.787vw,84px)] w-[clamp(23px,2.8935vw,42px)] -translate-y-1/2 hover:opacity-80 transition-opacity">
        <Image src="/assets/arrow-right.svg" alt="next" width={50} height={100} className="block w-full h-full" />
      </button>
      <button type="button" onClick={goToPrevious} aria-label="Previous hero slide" className="absolute left-[1.7vw] top-1/2 z-20 flex h-[clamp(46px,5.787vw,84px)] w-[clamp(23px,2.8935vw,42px)] -translate-y-1/2 items-center justify-center hover:opacity-80 transition-opacity">
        <div className="h-full w-full" style={{ transform:'rotate(180deg) scaleY(-1)' }}>
          <Image src="/assets/arrow-left.svg" alt="prev" width={50} height={100} className="block w-full h-full" />
        </div>
      </button>

      <div className="absolute bottom-[clamp(18px,2.2vw,34px)] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[0.75vw]">
        {SLIDES.map((item, index) => (
          <button
            key={`${item.id}-dot`}
            type="button"
            onClick={() => setActiveSlide(index)}
            aria-label={`Go to hero slide ${index + 1}`}
            aria-current={index === activeSlide}
            className={`h-[0.78vw] min-h-[10px] w-[0.78vw] min-w-[10px] rounded-full border border-[#936939] shadow-sm transition-all ${
              index === activeSlide ? "bg-[#936939] scale-125" : "bg-white/90"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
