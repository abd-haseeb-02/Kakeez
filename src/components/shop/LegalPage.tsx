import Link from "next/link"
import Navbar from "./Navbar"
import Footer from "./Footer"

// Shared shell for the policy pages (/terms, /privacy, /cookies). Server
// component: these are static documents, so there is nothing to hydrate.

export type LegalSection = {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export default function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-[clamp(92px,8vw,126px)]">
        <article className="mx-auto w-[min(820px,calc(100%_-_32px))] pb-[clamp(56px,7vw,110px)]">
          <p className="ff-colville text-sm uppercase tracking-[0.14em] text-primary-brown/70">Kakeez Bakeshop</p>
          <h1 className="ff-accia mt-3 text-[clamp(38px,5vw,68px)] leading-[1.04] text-primary-brown">{title}</h1>
          <p className="ff-apfel mt-3 text-sm text-black/45">Last updated {updated}</p>

          <p className="ff-accia-light mt-7 text-[clamp(17px,1.3vw,21px)] leading-[1.55] text-black/70">{intro}</p>

          <div className="mt-10 space-y-9">
            {sections.map((section) => (
              <section key={section.heading}>
                <h2 className="ff-accia text-[clamp(24px,2.2vw,34px)] leading-tight text-primary-brown">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((text) => (
                  <p key={text} className="ff-accia-light mt-3 text-[clamp(16px,1.15vw,18px)] leading-[1.6] text-black/70">
                    {text}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-3 list-disc space-y-2 pl-5">
                    {section.bullets.map((item) => (
                      <li key={item} className="ff-accia-light text-[clamp(16px,1.15vw,18px)] leading-[1.6] text-black/70">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap gap-3 border-t border-primary-brown/15 pt-8">
            <Link href="/terms" className="ff-colville text-[15px] text-primary-brown underline-offset-4 hover:underline">Terms &amp; Conditions</Link>
            <span className="text-primary-brown/30">·</span>
            <Link href="/privacy" className="ff-colville text-[15px] text-primary-brown underline-offset-4 hover:underline">Privacy Policy</Link>
            <span className="text-primary-brown/30">·</span>
            <Link href="/cookies" className="ff-colville text-[15px] text-primary-brown underline-offset-4 hover:underline">Cookies</Link>
          </div>
        </article>

        <div className="pb-6">
          <Footer variant="flow" />
        </div>
      </main>
    </div>
  )
}
