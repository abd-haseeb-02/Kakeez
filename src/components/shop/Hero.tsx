"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

// Scalloped silhouette the hero photo is clipped to, and the green edge that
// traces it. This is the original Figma curve with its scallop zone scaled to
// 55% of its depth: same lobe rhythm, same alternating deep/shallow tabs, but
// 175px instead of 318px, so it trims the photo instead of covering a third of
// it. Everything at or above y=627 (the cusp line) is untouched.
const HERO_PATH = "M1668 627H1667.04C1667.67 631.286 1668 635.659 1668 640.099C1668 695.007 1618.08 739.52 1556.5 739.52C1521.32 739.52 1489.95 724.995 1469.51 702.303C1449.68 739.053 1408.58 764.298 1361.09 764.298C1311.32 764.298 1268.56 736.559 1249.95 696.908C1232.05 708.096 1209.67 714.742 1185.4 714.742C1149.35 714.742 1117.49 700.09 1098.24 677.673C1077.8 700.28 1046.49 714.742 1011.39 714.742C976.209 714.742 944.837 700.217 924.401 677.525C904.565 714.275 863.465 739.52 815.979 739.52C766.205 739.52 723.447 711.782 704.839 672.131C686.933 683.318 664.557 689.964 640.282 689.964C618.643 689.964 598.513 684.683 581.712 675.612C565.679 712.982 525.085 739.52 477.537 739.52C442.36 739.52 410.987 724.995 390.552 702.303C370.715 739.053 329.615 764.298 282.13 764.298C232.355 764.298 189.597 736.559 170.989 696.908C153.083 708.096 130.707 714.742 106.433 714.742C47.652 714.742 0 675.777 0 627.71C0 627.473 0.004 627.236 0.006 627H0V0H1668V627Z"

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

  return (
    <div className="relative z-10 mx-auto mb-[clamp(22px,3.5vw,56px)] h-[clamp(280px,74vw,350px)] w-[calc(100%_-_24px)] overflow-visible lg:h-[clamp(300px,48vw,900px)] lg:w-[calc(100%_-_40px)]">
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
      <div className="absolute bottom-[clamp(12px,1.55vw,24px)] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[clamp(6px,0.5vw,9px)]">
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
