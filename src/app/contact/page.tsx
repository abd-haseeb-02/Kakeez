import type { Metadata } from "next"
import SimplePage from "@/components/shop/SimplePage"
import { CONTACT, addressOneLine } from "@/lib/contact"

export const metadata: Metadata = {
  title: "Contact | KAKEEZ Bakeshop",
  description: "Call, email or visit Kakeez Bakeshop in Johar Town, Lahore.",
  alternates: { canonical: "/contact" },
}

export default function ContactPage() {
  return (
    <SimplePage
      subtitle="Get in Touch"
      title="Contact Kakeez"
      body={`Call us at ${CONTACT.phone}, email ${CONTACT.email}, or visit us at ${addressOneLine}. We'd love to bake for your next celebration.`}
    />
  )
}
