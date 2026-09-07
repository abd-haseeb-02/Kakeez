import type { Metadata } from "next"
import LegalPage from "@/components/shop/LegalPage"
import { CONTACT, addressOneLine } from "@/lib/contact"

export const metadata: Metadata = {
  title: "Privacy Policy | KAKEEZ Bakeshop",
  description:
    "How Kakeez Bakeshop collects, uses, stores and protects your personal information when you order cakes and desserts in Lahore.",
  alternates: { canonical: "/privacy" },
}

const UPDATED = "8 September 2026"

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated={UPDATED}
      intro="This policy explains what personal information Kakeez Bakeshop collects when you browse our site or place an order, why we collect it, how long we keep it, and the choices you have. We only ask for what we genuinely need to bake and deliver your order."
      sections={[
        {
          heading: "Who we are",
          paragraphs: [
            `Kakeez Bakeshop ("Kakeez", "we", "us") is a bakery based at ${addressOneLine}. We are the data controller for the information described in this policy. You can reach us at ${CONTACT.email} or ${CONTACT.phone}.`,
          ],
        },
        {
          heading: "Information we collect",
          paragraphs: ["We collect the following, and nothing more than we need:"],
          bullets: [
            "Account details: your name, email address and password. Passwords are hashed by our authentication provider and are never visible to us.",
            "Order details: delivery address, recipient name, contact phone number, delivery date and time slot, gift flag, and any instructions or message you add to an item.",
            "Order history: the items you bought, the prices at the time of purchase, and the status of each order.",
            "Reviews: the rating and any title or text you submit for a product you have bought.",
            "Technical data: your IP address and basic device information, collected automatically by our hosting provider for security and to keep the site running.",
          ],
        },
        {
          heading: "Why we use it",
          bullets: [
            "To take, bake, and deliver your order, and to contact you about it.",
            "To let you sign in, see your order history, and manage saved addresses.",
            "To send transactional email such as order confirmations and status updates. These are service messages, not marketing.",
            "To prevent fraud and abuse of cash-on-delivery ordering.",
            "To meet our legal and accounting obligations.",
          ],
        },
        {
          heading: "Payment information",
          paragraphs: [
            "Kakeez currently accepts cash on delivery only. We do not collect or store card numbers, bank details, or any other payment credentials on this website.",
          ],
        },
        {
          heading: "Marketing",
          paragraphs: [
            "We only send marketing email if you have opted in, and every marketing message includes a way to unsubscribe. Unsubscribing does not stop transactional messages about an order you have placed.",
          ],
        },
        {
          heading: "Who we share it with",
          paragraphs: [
            "We do not sell your personal information. We share it only with the service providers who make the shop work, and only so far as they need it:",
          ],
          bullets: [
            "Our hosting and database providers, which store the site and your order data.",
            "Our email provider, which delivers order confirmations and account emails.",
            "Delivery staff or riders, who receive the delivery address and contact number for your order.",
            "Authorities or advisers, where we are required to disclose information by law.",
          ],
        },
        {
          heading: "Where your data is stored",
          paragraphs: [
            "Our database and file storage are hosted on infrastructure located outside Pakistan. Where your information is transferred abroad, we rely on the contractual protections offered by those providers to keep it secure.",
          ],
        },
        {
          heading: "How long we keep it",
          paragraphs: [
            "Order records are kept for as long as we need them for accounting and dispute resolution. Account information is kept while your account is open. If you close your account we remove or anonymise the personal details we no longer need, while keeping the minimum record of past transactions that the law requires.",
          ],
        },
        {
          heading: "Your choices",
          bullets: [
            "You can see and update your name, phone number and saved addresses from your account at any time.",
            "You can ask for a copy of the personal information we hold about you.",
            "You can ask us to correct anything inaccurate, or to delete information we no longer need.",
            "You can object to marketing at any time.",
          ],
          paragraphs: [
            `To make any of these requests, email ${CONTACT.email} from the address on your account and we will respond within a reasonable time.`,
          ],
        },
        {
          heading: "Children",
          paragraphs: [
            "This shop is intended for adults. We do not knowingly create accounts for children. If you believe a child has given us personal information, contact us and we will remove it.",
          ],
        },
        {
          heading: "Security",
          paragraphs: [
            "The site is served over HTTPS and access to customer records is restricted so that each customer can only read their own orders and addresses. No system is perfectly secure, but we take reasonable technical and organisational measures to protect your information.",
          ],
        },
        {
          heading: "Changes to this policy",
          paragraphs: [
            "If we change this policy we will update the date at the top of this page. Significant changes affecting how we use your information will be highlighted on the site.",
          ],
        },
        {
          heading: "Contact",
          paragraphs: [
            `Questions or complaints about privacy can be sent to ${CONTACT.email}, or by post to ${addressOneLine}.`,
          ],
        },
      ]}
    />
  )
}
