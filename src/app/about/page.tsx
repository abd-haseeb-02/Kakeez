import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Mail, Phone, MapPin } from "lucide-react"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import { CONTACT } from "@/lib/contact"

export const metadata: Metadata = {
  title: "Our Story | KAKEEZ Bakeshop",
  description:
    "Founded in April 2023 by Mian Zain, KAKEEZ began with a simple belief — every special moment deserves something made with care.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "article",
    title: "Our Story | KAKEEZ Bakeshop",
    description:
      "Founded in April 2023 by Mian Zain, KAKEEZ began with a simple belief — every special moment deserves something made with care.",
    url: "/about",
    images: [{ url: "/og-about.jpg", width: 1200, height: 630, alt: "More Than a Cake. A Part of Your Celebration." }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-about.jpg"],
  },
}

// Three ways of looking at the same cake. Kept as data so the cards stay
// uniform and the copy is editable without touching layout.
const PERSPECTIVES = [
  {
    label: "Birthday",
    line: "A birthday cake isn't just a cake — it's a surprise waiting to happen.",
  },
  {
    label: "Wedding",
    line: "A wedding cake isn't just dessert — it's part of a memory that lasts forever.",
  },
  {
    label: "Customized",
    line: "A customized cake isn't just a design — it's a way of turning someone's idea into something they can actually celebrate with.",
  },
]

const PILLARS = [
  {
    heading: "Our Mission",
    body: "To make every celebration sweeter by creating desserts that people love to see, love to share, and most importantly, love to eat.",
  },
  {
    heading: "Our Vision",
    body: "To grow KAKEEZ into a trusted bakery brand known for quality, creativity and unforgettable celebrations.",
  },
  {
    heading: "Our Promise",
    body: "Freshly Baked. Thoughtfully Crafted. Made for Your Moments.",
  },
]

const WE_BAKE = ["Signature Cakes", "Cupcakes", "Cookies", "Brownies", "Customized Creations"]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-[clamp(76px,8vw,118px)]">
        {/* ── Opening statement ─────────────────────────────────────────── */}
        <section className="mx-auto w-[min(980px,calc(100%_-_32px))] pb-[clamp(40px,5vw,72px)] pt-[clamp(40px,5vw,88px)] text-center">
          <p className="ff-accia text-sm uppercase tracking-[0.08em] text-primary-brown">- Our Story -</p>
          <h1 className="ff-accia mt-3 text-[clamp(36px,4.6vw,72px)] leading-[1.04]">
            <span className="text-primary-brown">More Than a Cake.</span>{" "}
            <span className="text-[#262729]">A Part of Your Celebration.</span>
          </h1>
          <p className="mx-auto mt-[clamp(18px,2vw,30px)] max-w-[720px] ff-accia-light text-[clamp(17px,1.3vw,23px)] leading-[1.5] text-black/60">
            Founded in April 2023 by Mian Zain, KAKEEZ began with a simple belief — every special moment
            deserves something made with care.
          </p>
        </section>

        {/* ── The story, alongside our work ─────────────────────────────── */}
        <section className="mx-auto grid w-[min(1190px,calc(100%_-_32px))] items-center gap-[clamp(28px,4vw,72px)] pb-[clamp(56px,7vw,110px)] lg:grid-cols-[1fr_minmax(280px,420px)]">
          <div className="order-2 lg:order-1">
            <h2 className="ff-accia text-[clamp(30px,3.2vw,52px)] leading-[1.08] text-primary-brown">
              A small dream, baked daily
            </h2>
            <div className="ff-accia mt-[clamp(16px,1.8vw,26px)] space-y-4 text-[clamp(16px,1.2vw,20px)] leading-[1.5] text-[#262729]">
              <p>
                What started as a small dream has grown into a bakery brand focused on creating fresh,
                delicious and beautifully crafted desserts for life&apos;s most meaningful moments.
              </p>
              <p>
                That&apos;s why we put equal importance on taste, freshness, creativity and presentation.
              </p>
              <p>
                From our signature cakes and cupcakes to cookies, brownies and customized creations, every
                product is made to bring something special to your table.
              </p>
            </div>

            <div className="mt-[clamp(22px,2.4vw,34px)] flex flex-wrap gap-2.5">
              {WE_BAKE.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-primary-brown/25 bg-accent-green/40 px-4 py-2 ff-colville text-[clamp(14px,0.95vw,16px)] uppercase text-primary-brown"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative order-1 mx-auto w-full max-w-[420px] lg:order-2">
            <div className="pointer-events-none absolute -left-[clamp(20px,3vw,52px)] -top-[clamp(20px,2.6vw,44px)] z-10 h-[clamp(74px,7vw,126px)] w-[clamp(74px,7vw,126px)]">
              <Image src="/assets/badge-circle.png" alt="" fill sizes="126px" className="object-contain" />
            </div>
            <div className="relative aspect-[0.76] overflow-hidden rounded-[14px] border border-primary-brown/30 bg-[#ece9e2]">
              <Image
                src="/assets/welcome-1.webp"
                alt="A table of Kakeez celebration cakes"
                fill
                sizes="(max-width: 1024px) 100vw, 420px"
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* ── How we look at a cake ─────────────────────────────────────── */}
        <section className="mx-auto w-[min(1190px,calc(100%_-_32px))] pb-[clamp(56px,7vw,110px)]">
          <div className="mx-auto max-w-[760px] text-center">
            <h2 className="ff-accia text-[clamp(30px,3.6vw,58px)] leading-[1.08]">
              <span className="text-[#262729]">At KAKEEZ, we see</span>{" "}
              <span className="text-primary-brown">every cake differently.</span>
            </h2>
          </div>

          <div className="mt-[clamp(28px,3.4vw,52px)] grid gap-4 md:grid-cols-3">
            {PERSPECTIVES.map((item) => (
              <div
                key={item.label}
                className="flex flex-col rounded-[14px] border border-primary-brown/20 bg-[#fffdf7] p-[clamp(22px,2.2vw,34px)]"
              >
                <span className="ff-colville-medium text-[clamp(14px,0.95vw,16px)] uppercase tracking-[0.12em] text-primary-brown/70">
                  {item.label}
                </span>
                <p className="mt-3 ff-accia text-[clamp(17px,1.25vw,21px)] leading-[1.45] text-[#262729]">
                  {item.line}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Mission / Vision / Promise, on the house green band ───────── */}
        <section className="relative mx-auto w-[calc(100%_-_24px)] bg-accent-green pb-[clamp(56px,10vw,72px)] pt-[clamp(56px,10vw,72px)] lg:w-[calc(100%_-_40px)] lg:pb-[clamp(88px,7rem,112px)] lg:pt-[clamp(168px,13rem,208px)]">
          <div className="pointer-events-none absolute left-1/2 top-[-2px] z-0 hidden h-[clamp(128px,12rem,192px)] w-full -translate-x-1/2 lg:block">
            <Image src="/assets/vector13.svg" alt="" fill className="block h-full w-full object-fill" />
          </div>
          <div className="pointer-events-none absolute bottom-[-118px] left-0 z-0 hidden h-[clamp(126px,11rem,176px)] w-full lg:block">
            <Image src="/assets/vector14.svg" alt="" fill className="block h-full w-full object-fill" />
          </div>

          <div className="relative z-10 mx-auto w-[min(1390px,calc(100%_-_32px))]">
            <div className="grid gap-[clamp(28px,3vw,48px)] md:grid-cols-3">
              {PILLARS.map((pillar) => (
                <div key={pillar.heading} className="text-center md:text-left">
                  <h3 className="ff-accia text-[clamp(26px,2.6vw,40px)] leading-none text-primary-brown">
                    {pillar.heading}
                  </h3>
                  <p className="mt-4 ff-accia-light text-[clamp(16px,1.1vw,19px)] leading-[1.5] text-[#262729]/80">
                    {pillar.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Sign-off + contact ────────────────────────────────────────── */}
        {/* Top padding has to clear vector14, which hangs 118px below the green
            band above. Below `lg` the drips are hidden, so the lower bound is
            just ordinary section spacing. */}
        <section className="mx-auto w-[min(1190px,calc(100%_-_32px))] pb-[clamp(56px,7vw,110px)] pt-[clamp(64px,12vw,180px)] text-center">
          <p className="ff-accia-light text-[clamp(17px,1.3vw,22px)] text-black/55">Because at KAKEEZ,</p>
          <h2 className="ff-accia mt-2 text-[clamp(38px,4.6vw,72px)] leading-none text-primary-brown">
            Every Bite Matters. <span aria-hidden="true">🤍</span>
          </h2>

          <div className="mt-[clamp(24px,2.6vw,38px)] flex flex-wrap justify-center gap-3">
            <Link
              href="/#menu"
              className="rounded-[10px] bg-primary-brown px-[clamp(28px,3vw,52px)] py-[clamp(12px,1vw,18px)] ff-accia text-[clamp(17px,1.3vw,23px)] text-white transition-all hover:bg-primary-brown/90"
            >
              Explore the Menu
            </Link>
            <Link
              href="/contact"
              className="rounded-[10px] border border-primary-brown bg-white px-[clamp(28px,3vw,52px)] py-[clamp(12px,1vw,18px)] ff-accia text-[clamp(17px,1.3vw,23px)] text-primary-brown transition-opacity hover:opacity-75"
            >
              Talk to Us
            </Link>
          </div>

          {/* Target of the navbar's "Contact" link from every page. scroll-mt
              keeps the cards clear of the fixed-height navbar overhead. */}
          <div
            id="contact"
            className="mx-auto mt-[clamp(40px,4.5vw,72px)] grid max-w-[900px] scroll-mt-[clamp(100px,10vw,150px)] gap-4 sm:grid-cols-3"
          >
            <a
              href={`mailto:${CONTACT.email}`}
              className="flex flex-col items-center gap-2 rounded-[14px] border border-primary-brown/20 bg-[#fffdf7] px-5 py-[clamp(20px,2vw,30px)] transition-colors hover:border-primary-brown/50"
            >
              <Mail className="h-5 w-5 text-primary-brown" strokeWidth={1.8} />
              <span className="ff-colville text-[13px] uppercase tracking-[0.12em] text-primary-brown/60">Email</span>
              <span className="ff-accia text-[clamp(15px,1.05vw,18px)] break-all text-[#262729]">{CONTACT.email}</span>
            </a>

            <a
              href={CONTACT.phoneHref}
              className="flex flex-col items-center gap-2 rounded-[14px] border border-primary-brown/20 bg-[#fffdf7] px-5 py-[clamp(20px,2vw,30px)] transition-colors hover:border-primary-brown/50"
            >
              <Phone className="h-5 w-5 text-primary-brown" strokeWidth={1.8} />
              <span className="ff-colville text-[13px] uppercase tracking-[0.12em] text-primary-brown/60">Call</span>
              <span className="ff-accia text-[clamp(15px,1.05vw,18px)] text-[#262729]">{CONTACT.phone}</span>
            </a>

            <div className="flex flex-col items-center gap-2 rounded-[14px] border border-primary-brown/20 bg-[#fffdf7] px-5 py-[clamp(20px,2vw,30px)]">
              <MapPin className="h-5 w-5 text-primary-brown" strokeWidth={1.8} />
              <span className="ff-colville text-[13px] uppercase tracking-[0.12em] text-primary-brown/60">Visit</span>
              <span className="ff-accia text-[clamp(15px,1.05vw,18px)] leading-snug text-[#262729]">
                {CONTACT.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </div>
          </div>
        </section>

        <div className="pb-6">
          <Footer variant="flow" />
        </div>
      </main>
    </div>
  )
}
