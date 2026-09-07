import SimplePage from "@/components/shop/SimplePage"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "The Full Menu | KAKEEZ Bakeshop",
  description: "Explore handcrafted cakes, cookies, brownies and cupcakes from Kakeez Bakeshop in Lahore.",
  alternates: { canonical: "/menu" },
}

export default function MenuPage() {
  return (
    <SimplePage
      subtitle="Our Menu"
      title="The Full Menu"
      body="Explore our handcrafted cakes, cookies, brownies and cupcakes. Our complete menu is being plated — for now, our best sellers are on the home page."
    />
  )
}
