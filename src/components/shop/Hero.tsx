"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

// Scalloped silhouette the hero photo is clipped to, and the green edge that
// traces it. This is the original Figma curve with its scallop zone scaled to
// 55% of its depth, anchored to the BOTTOM of the scallop rather than the top:
// same lobe rhythm and alternating tabs, 137px deep instead of 250px, and the
// lowest lobe still lands at y=876.6 so no dead white opens up beneath it.
// Scaling from the cusp line instead left ~160px of empty page under the hero.
const HERO_PATH = "M1668 739.335H1667.04C1667.67 743.621 1668 747.994 1668 752.434C1668 807.342 1618.08 851.855 1556.5 851.855C1521.32 851.855 1489.95 837.329 1469.51 814.638C1449.68 851.387 1408.58 876.633 1361.09 876.633C1311.32 876.633 1268.56 848.894 1249.95 809.243C1232.05 820.431 1209.67 827.077 1185.4 827.077C1149.35 827.077 1117.49 812.425 1098.24 790.008C1077.8 812.615 1046.49 827.077 1011.39 827.077C976.209 827.077 944.837 812.551 924.401 789.86C904.565 826.609 863.465 851.855 815.979 851.855C766.205 851.855 723.447 824.117 704.839 784.466C686.933 795.653 664.557 802.299 640.282 802.299C618.643 802.299 598.513 797.018 581.712 787.947C565.679 825.317 525.085 851.855 477.537 851.855C442.36 851.855 410.987 837.329 390.552 814.638C370.715 851.387 329.615 876.633 282.13 876.633C232.355 876.633 189.597 848.894 170.989 809.243C153.083 820.431 130.707 827.077 106.433 827.077C47.652 827.077 0 788.112 0 740.045C0 739.808 0.004 739.571 0.006 739.335H0V0H1668V739.335Z"

// Pre-compressed WebP rather than the original PNGs. These are drawn with raw
// SVG <image href> elements inside the clipped hero shape, which never touches
// next/image -- so whatever is referenced here ships to the browser untouched.
// The three PNGs they replaced were 16.3 MB, 2.1 MB and 1.7 MB; every visitor
// downloaded all three, because all three slides are in the DOM at once.
// Re-export from supabase/scripts if the art is ever changed, and keep the
// output under a few hundred KB.
const SLIDES = [
  {
    id: "hero-1",
    image: "/hero%20banner%203.webp",
    eyebrow: "Bite Into The Bliss",
    title: ["Paradise", "Awaits"],
    showText: false,
  },
  {
    id: "hero-2",
    image: "/hero%20banner%202.webp",
    eyebrow: "Bite Into The Bliss",
    title: ["Paradise", "Awaits"],
    showText: false,
  },
  {
    id: "hero-3",
    image: "/assets/hero.webp",
    eyebrow: "Bite Into The Bliss",
    title: ["Paradise", "Awaits"],
  },
]

export default function Hero() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % SLIDES.length)
    }, 9000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)")
    const update = () => setIsMobile(media.matches)

    update()
    media.addEventListener("change", update)

    return () => media.removeEventListener("change", update)
  }, [])

  const goToPrevious = () => {
    setActiveSlide((current) => (current - 1 + SLIDES.length) % SLIDES.length)
  }

  const goToNext = () => {
    setActiveSlide((current) => (current + 1) % SLIDES.length)
  }

  // Desktop hero fills whatever the navbar leaves of the viewport, so the nav +
  // slider occupy exactly one screen. svh rather than vh: on mobile browsers vh
  // is the *largest* viewport height, which overflows once the URL bar is shown.
  // Mobile keeps its own shorter height — the art is drawn 1668x910 and a
  // full-height phone hero would either crop it to a couple of lobes or, with
  // preserveAspectRatio="none", stretch it badly.
  return (
    <div className="relative z-10 mx-auto mb-[clamp(22px,3.5vw,56px)] h-[clamp(280px,74vw,350px)] w-[calc(100%_-_24px)] overflow-visible lg:h-[calc(100svh-var(--nav-h))] lg:min-h-[520px] lg:w-[calc(100%_-_40px)]">
        <svg className="relative z-10 block h-full w-full overflow-hidden" viewBox="0 0 1668 910" preserveAspectRatio={isMobile ? "none" : "xMidYMax slice"} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="heroClip" clipPathUnits="userSpaceOnUse"><path d={HERO_PATH}/></clipPath>
            <clipPath id="heroBottomStrokeClip" clipPathUnits="userSpaceOnUse"><rect x="0" y="590" width="1668" height="320" /></clipPath>
          </defs>
          <path d={HERO_PATH} fill="none" stroke="#E1EAB4" strokeWidth="34" strokeLinejoin="round" clipPath="url(#heroBottomStrokeClip)" />
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
                    {item.showText !== false && (
                      <>
                        <text
                          x={offset + 834}
                          y="340"
                          textAnchor="middle"
                          fill="#936939"
                          fontFamily="var(--accia)"
                          fontSize="34"
                          fontWeight="300"
                        >
                          {item.eyebrow}
                        </text>
                        <text
                          x={offset + 834}
                          y="475"
                          textAnchor="middle"
                          fill="#936939"
                          fontFamily="var(--accia)"
                          fontSize="106"
                          fontWeight="500"
                          style={{ filter: "drop-shadow(5px 12px 14px rgba(0,0,0,0.25))" }}
                        >
                          {item.title.map((line, lineIndex) => (
                            <tspan key={line} x={offset + 834} dy={lineIndex === 0 ? 0 : 92}>
                              {line}
                            </tspan>
                          ))}
                        </text>
                      </>
                    )}
                  </g>
                )
              })}
            </g>
          </g>
        </svg>

      <button type="button" onClick={goToNext} aria-label="Next hero slide" className="absolute right-[clamp(14px,1.7vw,28px)] top-1/2 z-20 h-[clamp(46px,5.787vw,84px)] w-[clamp(23px,2.8935vw,42px)] -translate-y-1/2 hover:opacity-80 transition-opacity">
        <Image src="/assets/arrow-right.svg" alt="next" width={50} height={100} className="block w-full h-full" />
      </button>
      <button type="button" onClick={goToPrevious} aria-label="Previous hero slide" className="absolute left-[clamp(14px,1.7vw,28px)] top-1/2 z-20 flex h-[clamp(46px,5.787vw,84px)] w-[clamp(23px,2.8935vw,42px)] -translate-y-1/2 items-center justify-center hover:opacity-80 transition-opacity">
        <div className="h-full w-full" style={{ transform:'rotate(180deg) scaleY(-1)' }}>
          <Image src="/assets/arrow-left.svg" alt="prev" width={50} height={100} className="block w-full h-full" />
        </div>
      </button>

      {/* Slide dots sit ABOVE the scalloped edge, not inside it. HERO_PATH's
          image area ends at y=627 of the 910 viewBox and the wave runs from
          there to y=877, so the old `bottom-[clamp(46px,4.8vw,78px)]` — 69px,
          10% of the hero at 1440 — placed them in the middle of the decoration.
          Percentages because the wave is a fixed fraction of the rendered
          height at every width: 33.5% on mobile, where preserveAspectRatio is
          "none" and the art stretches, and ~37% on desktop, where "xMidYMax
          slice" scales it off the width that also drives the hero's height. */}
      <div className="absolute bottom-[clamp(9px,0.85vw,13px)] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[clamp(6px,0.5vw,9px)]">
        {SLIDES.map((item, index) => (
          <button
            key={`${item.id}-dot`}
            type="button"
            onClick={() => setActiveSlide(index)}
            aria-label={`Go to hero slide ${index + 1}`}
            aria-current={index === activeSlide}
            className={`h-[clamp(7px,0.5vw,9px)] w-[clamp(7px,0.5vw,9px)] rounded-full border border-[#936939]/70 shadow-sm transition-all ${
              index === activeSlide ? "bg-[#936939] scale-125" : "bg-white/90"
            }`}
          />
        ))}
      </div>
    </div>
  )
}
