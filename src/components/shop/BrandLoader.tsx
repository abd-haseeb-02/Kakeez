import Image from "next/image"

// The Kakeez seal with a brand-brown arc sweeping around it.
//
// Two stacked SVG rings rather than one: the faint full circle is the track, so
// the moving arc reads as travelling along a path instead of floating in space.
// r=46 gives a circumference of ~289, so a 72-unit dash is a clean quarter turn.

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const ARC = CIRCUMFERENCE * 0.25

export default function BrandLoader({
  label = "Just a moment",
  fullScreen = true,
}: {
  label?: string
  fullScreen?: boolean
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-center justify-center gap-5 bg-white ${
        fullScreen ? "min-h-screen" : "py-[clamp(56px,10vw,120px)]"
      }`}
    >
      <div className="relative h-[clamp(92px,9vw,116px)] w-[clamp(92px,9vw,116px)]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="#936939"
            strokeOpacity="0.2"
            strokeWidth="3"
          />
        </svg>

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full animate-spin motion-reduce:animate-none"
          style={{ animationDuration: "1.15s" }}
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="#936939"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${CIRCUMFERENCE - ARC}`}
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <span className="absolute h-[70%] w-[70%] rounded-full bg-[#fbf7ee]" aria-hidden="true" />
          <Image
            src="/assets/LOGO.png"
            alt=""
            width={72}
            height={72}
            priority
            className="h-[62%] w-[62%] animate-pulse object-contain motion-reduce:animate-none"
            style={{ animationDuration: "2.3s" }}
          />
        </div>
      </div>

      <p className="ff-colville text-[clamp(13px,1vw,15px)] uppercase tracking-[0.22em] text-primary-brown/55">
        {label}
      </p>
      <span className="sr-only">Loading</span>
    </div>
  )
}
