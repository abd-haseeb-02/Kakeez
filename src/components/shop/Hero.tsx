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

// Text-free WebP art. The two baked-in banners were re-exported from the
// Figma source images (images/image-import-17 and 16+31 composited) so the
// headline could move out of the bitmap and onto its own layer.
// Pre-compressed WebP rather than the original PNGs. These are drawn with raw
// SVG <image href> elements inside the clipped hero shape, which never touches
// next/image -- so whatever is referenced here ships to the browser untouched.
// The three PNGs they replaced were 16.3 MB, 2.1 MB and 1.7 MB; every visitor
// downloaded all three, because all three slides are in the DOM at once.
// Re-export from supabase/scripts if the art is ever changed, and keep the
// output under a few hundred KB.
// Every position below is lifted from the Figma frame and expressed as a
// percentage of its 1668x1007 artboard, so the copy sits exactly where it was
// composed rather than being generically centred. Font sizes carry the design
// value as the vw term (e.g. 120px / 1668 = 7.19vw) with a floor and a ceiling.
type Item = {
  text: string[]
  x: number
  y: number
  w: number
  font: string
  size: [number, number, number]
  color: string
  align: "left" | "center" | "right"
  lh: number
  weight?: number
  wrap?: boolean
}
type Badge = { label: string; x: number; y: number; w: number; disc: string; color: string }

const SLIDES: {
  id: string
  image: string
  items: Item[]
  badge: Badge | null
  sparkles: { x: number; y: number; s: number }[]
}[] = [
  {
    id: "hero-1",
    image: "/assets/hero.webp",
    badge: null,
    sparkles: [],
    items: [
      { text: ["Bite Into The Bliss"], x: 30.0, y: 34.9, w: 40.0, font: "var(--accia)", size: [13, 2.08, 35], color: "#936939", align: "center", lh: 0.84 },
      { text: ["Paradise", "Awaits"], x: 35.3, y: 39.0, w: 28.1, font: "var(--accia)", size: [34, 7.19, 120], color: "#936939", align: "center", lh: 0.84, weight: 500 },
    ],
  },
  {
    id: "hero-2",
    image: "/hero-slide-2.webp",
    badge: { label: "Taste the Magic", x: 35.1, y: 44.0, w: 14.2, disc: "#e6b29373", color: "#ff8800" },
    sparkles: [
      { x: 9.8, y: 18.3, s: 6.1 },
      { x: 23.1, y: 39.8, s: 6.1 },
      { x: 31.1, y: 51.9, s: 6.1 },
    ],
    items: [
      { text: ["Because Every", "Bite Matters"], x: 6.4, y: 25.5, w: 47.1, font: "var(--font-arizonia)", size: [40, 8.97, 150], color: "#8b5211", align: "center", lh: 0.92 },
    ],
  },
  {
    id: "hero-3",
    image: "/hero-slide-3.webp",
    badge: { label: "Explore Our Sweets", x: 62.0, y: 16.9, w: 15.4, disc: "#9369394d", color: "#ffffff" },
    sparkles: [],
    items: [
      { text: ["Artistry in", "Every Slice"], x: 25.9, y: 27.4, w: 48.2, font: "var(--font-aladin)", size: [40, 9.17, 153], color: "#ffffff", align: "center", lh: 0.96 },
      { text: ["From decadent fudgy brownies to delicate everyday desserts."], x: 32.6, y: 56.5, w: 36.3, font: "var(--font-edu)", size: [13, 2.42, 40], color: "#ffffff", align: "center", lh: 1.2, wrap: true },
    ],
  },
]

const clampPx = ([min, vw, max]: [number, number, number]) => `clamp(${min}px, ${vw}vw, ${max}px)`

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
                  </g>
                )
              })}
            </g>
          </g>
        </svg>

      {/* Copy layer — HTML above the artwork, NOT <text> inside the SVG.
          The SVG scales with preserveAspectRatio="slice", so anything drawn
          inside it is scaled by the same factor as the photo: the headline was
          being blown up along with the image. Out here the type is sized in
          CSS, while the positions stay proportional to the artboard so the copy
          still reads as part of the composition. */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {SLIDES.map((item, index) => (
          <div
            key={`${item.id}-copy`}
            aria-hidden={index !== activeSlide}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              index === activeSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            {item.sparkles.map((sp, i) => (
              <span
                key={`sp-${i}`}
                className="absolute block rounded-full"
                style={{
                  left: `${sp.x}%`,
                  top: `${sp.y}%`,
                  width: `${sp.s}%`,
                  aspectRatio: "1",
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,240,200,0.45) 35%, rgba(255,255,255,0) 70%)",
                }}
              />
            ))}

            {item.badge && (
              <div
                className="absolute flex items-center justify-center rounded-full text-center"
                style={{
                  left: `${item.badge.x}%`,
                  top: `${item.badge.y}%`,
                  width: `${item.badge.w}%`,
                  aspectRatio: "1",
                  background: item.badge.disc,
                  backdropFilter: "blur(2px)",
                }}
              >
                <span
                  className="px-[8%] leading-[1.05]"
                  style={{
                    fontFamily: "var(--font-allura)",
                    fontSize: clampPx([15, 3.1, 52]),
                    color: item.badge.color,
                  }}
                >
                  {item.badge.label}
                </span>
              </div>
            )}

            {item.items.map((it, i) => {
              const Tag = index === 0 && i === 1 ? "h1" : i === 0 && index !== 0 ? "h1" : "p"
              return (
                <Tag
                  key={`${item.id}-t${i}`}
                  className="absolute m-0"
                  style={{
                    left: `${it.x}%`,
                    top: `${it.y}%`,
                    width: `${it.w}%`,
                    fontFamily: it.font,
                    fontSize: clampPx(it.size),
                    fontWeight: it.weight ?? 400,
                    lineHeight: it.lh,
                    color: it.color,
                    textAlign: it.align,
                    textShadow:
                      it.color === "#ffffff"
                        ? "0 4px 22px rgba(0,0,0,0.45)"
                        : "0 6px 16px rgba(0,0,0,0.18)",
                  }}
                >
                  {it.text.map((line) => (
                    <span key={line} className={it.wrap ? "block" : "block whitespace-nowrap"}>
                      {line}
                    </span>
                  ))}
                </Tag>
              )
            })}
          </div>
        ))}
      </div>

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
