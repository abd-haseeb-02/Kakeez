import type { Metadata } from "next"
import SimplePage from "@/components/shop/SimplePage"
import { CONTACT, addressOneLine } from "@/lib/contact"

export const metadata: Metadata = {
  title: "Contact Us | KAKEEZ Bakeshop",
  description: "Contact Kakeez Bakeshop — call 0317 4304211, email Hello@kakeez.com, or visit us at 414 D Block, Baig Road, Phase 1, Johar Town, Lahore.",
  alternates: { canonical: "/contact" },
}

export default function ContactPage() {
  return (
    <SimplePage
      subtitle="Get in Touch"
      title="Contact Us"
      body={`Call us at ${CONTACT.phone}, email ${CONTACT.email}, or visit us at ${addressOneLine}. We'd love to bake for your next celebration.`}
    />
  )
}
