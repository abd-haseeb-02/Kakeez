import SimplePage from "@/components/shop/SimplePage"
import { CONTACT, addressOneLine } from "@/lib/contact"

export default function ContactPage() {
  return (
    <SimplePage
      subtitle="Get in Touch"
      title="Contact Kakeez"
      body={`Call us at ${CONTACT.phone}, email ${CONTACT.email}, or visit us at ${addressOneLine}. We'd love to bake for your next celebration.`}
    />
  )
}
