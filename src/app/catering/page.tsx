import SimplePage from "@/components/shop/SimplePage"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Catering | KAKEEZ Bakeshop",
  description: "Catering, dessert tables and custom event orders from Kakeez Bakeshop.",
  alternates: { canonical: "/catering" },
}

export default function CateringPage() {
  return (
    <SimplePage
      subtitle="Events & Catering"
      title="Kakeez Catering"
      body="Coming soon. We are preparing catering options for celebrations, dessert tables, and custom event orders."
    />
  )
}
