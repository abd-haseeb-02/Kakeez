import type { Metadata } from "next"
import LegalPage from "@/components/shop/LegalPage"
import { CONTACT, addressOneLine } from "@/lib/contact"

export const metadata: Metadata = {
  title: "Terms & Conditions | KAKEEZ Bakeshop",
  description:
    "The terms that apply when you order cakes, cupcakes, cookies and brownies from Kakeez Bakeshop in Lahore, including ordering, delivery, cancellation and refunds.",
  alternates: { canonical: "/terms" },
}

const UPDATED = "8 September 2026"

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated={UPDATED}
      intro="These terms apply when you place an order with Kakeez Bakeshop through this website. Please read them before ordering; placing an order means you accept them."
      sections={[
        {
          heading: "About us",
          paragraphs: [
            `Kakeez Bakeshop is a bakery operating from ${addressOneLine}. You can contact us at ${CONTACT.email} or ${CONTACT.phone}.`,
          ],
        },
        {
          heading: "Placing an order",
          paragraphs: [
            "Adding items to your cart is not an order. When you place an order you are making an offer to buy, and a contract is formed only when we confirm the order. We may decline an order if an item is unavailable, if the delivery address falls outside the area we serve, or if we cannot verify your contact details.",
            "Prices shown on the product page are what you pay. All totals, discounts, delivery charges and any tax are recalculated by us when the order is placed, so the amount you are charged is always the amount our system computes, not the amount stored in your browser.",
          ],
        },
        {
          heading: "Lead time and delivery slots",
          paragraphs: [
            "Cakes are baked to order. Most items need a lead time before they can be delivered, and custom work needs longer. The delivery date and time window you choose at checkout is a target, not a guaranteed hour: traffic, weather and kitchen load can move it. We will contact you if your slot cannot be met.",
          ],
        },
        {
          heading: "Delivery",
          paragraphs: [
            "We deliver within our published service area. A delivery charge is shown at checkout before you confirm.",
            "Someone must be available at the address to receive the order. If nobody is reachable on the number provided, the rider may return the order to the bakery. Because our products are perishable, a failed delivery caused by an incorrect address or an unreachable recipient is not refundable.",
          ],
        },
        {
          heading: "Payment",
          paragraphs: [
            "Orders are cash on delivery. Please have the exact amount ready for the rider. We do not take card or online payment through this site, and we will never ask you for card details by phone or email.",
          ],
        },
        {
          heading: "Cancellations and changes",
          paragraphs: [
            "You can ask to cancel or change an order by contacting us as soon as possible. We can usually accommodate changes while the order is still unconfirmed or not yet in preparation. Once baking has started we may not be able to cancel, because the ingredients and work are already committed. Custom cake orders have their own cancellation window, which is stated when the order is placed.",
          ],
        },
        {
          heading: "Quality, refunds and complaints",
          paragraphs: [
            "Food is perishable, so please check your order on delivery. If something is wrong with what you received, tell us within 24 hours of delivery and send a photo if you can. Where a complaint is justified we will replace the item or refund it, at our discretion.",
            "We cannot refund an order simply because a preference changed after delivery, or where a product matches what was ordered and described.",
          ],
        },
        {
          heading: "Allergens and food safety",
          paragraphs: [
            "Our kitchen handles wheat, dairy, eggs and nuts. We cannot guarantee that any product is free from traces of these. If you have an allergy, contact us before ordering so we can tell you whether we can safely make what you want. Store products as advised and consume them within the time we tell you.",
          ],
        },
        {
          heading: "Custom and photo-based orders",
          paragraphs: [
            "Handmade products vary. Colours, decoration and finish are matched as closely as we reasonably can to any reference image, but an exact reproduction is not guaranteed. If you supply artwork or an image, you confirm you have the right to use it.",
          ],
        },
        {
          heading: "Your account",
          paragraphs: [
            "You are responsible for keeping your account password confidential and for activity under your account. Tell us promptly if you think someone else is using it. We may suspend an account that is used for fraudulent or abusive ordering.",
          ],
        },
        {
          heading: "Reviews",
          paragraphs: [
            "Reviews can be left only for products you have actually received. We may decline to publish a review that is abusive, off-topic, or not about the product.",
          ],
        },
        {
          heading: "Our content",
          paragraphs: [
            "The photographs, text, logo and design on this site belong to Kakeez. Please do not reuse them commercially without our permission.",
          ],
        },
        {
          heading: "Liability",
          paragraphs: [
            "Nothing in these terms limits liability that cannot be limited by law. Beyond that, our liability for an order is limited to the amount you paid for it. We are not liable for indirect losses such as loss of profit or disappointment at an event.",
          ],
        },
        {
          heading: "Governing law",
          paragraphs: [
            "These terms are governed by the laws of Pakistan, and disputes fall to the courts at Lahore.",
          ],
        },
        {
          heading: "Contact",
          paragraphs: [
            `For anything to do with an order or these terms, contact ${CONTACT.email} or ${CONTACT.phone}.`,
          ],
        },
      ]}
    />
  )
}
