import type { Metadata } from "next"
import LegalPage from "@/components/shop/LegalPage"
import { CONTACT } from "@/lib/contact"

export const metadata: Metadata = {
  title: "Cookies | KAKEEZ Bakeshop",
  description:
    "What Kakeez Bakeshop stores in your browser, why it is needed to keep you signed in and your cart intact, and how to clear it.",
  alternates: { canonical: "/cookies" },
}

const UPDATED = "8 September 2026"

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookies"
      updated={UPDATED}
      intro="This page explains what Kakeez stores in your browser. We keep this deliberately small: there are no advertising cookies and no third-party tracking pixels on this site."
      sections={[
        {
          heading: "What we store",
          bullets: [
            "Sign-in cookies. Set by our authentication provider when you sign in, so the site knows it is you on the next page. Without these you cannot stay signed in or reach checkout.",
            "Your cart. Kept in your browser's local storage, not on our servers, so the items you picked survive a refresh. It stays on your device until you clear it or empty your cart.",
            "Analytics. We measure page views and basic performance to see which pages are slow or broken. This is aggregated and is not used to build a profile of you or to advertise to you.",
          ],
        },
        {
          heading: "What we do not do",
          paragraphs: [
            "We do not run advertising cookies, retargeting pixels, or social media trackers, and we do not sell browsing data to anyone.",
          ],
        },
        {
          heading: "Managing what is stored",
          paragraphs: [
            "You can clear cookies and site data at any time from your browser settings. Doing so signs you out and empties your saved cart. Blocking cookies entirely will stop sign-in and checkout from working, because those depend on the session cookie.",
          ],
        },
        {
          heading: "Contact",
          paragraphs: [
            `If you have a question about anything stored in your browser, email ${CONTACT.email}.`,
          ],
        },
      ]}
    />
  )
}
