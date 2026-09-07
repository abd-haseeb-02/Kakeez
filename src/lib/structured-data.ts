import { CONTACT, addressOneLine } from "@/lib/contact"
import { getSiteUrl } from "@/lib/site-url"

// Schema.org description of the business itself, emitted on every page.
//
// Individual products already carry Product markup, but a Product with no brand
// is just an anonymous cake -- there is nothing connecting it to the word
// "Kakeez". This is the entity that search engines attach the brand name to,
// and the one that Products point at via `brand`, so a search combining a
// product and the brand has something to match on.

export const BUSINESS_ID = "#business"

export function businessId(): string {
  return `${getSiteUrl()}/${BUSINESS_ID}`
}

export function businessSchema() {
  const site = getSiteUrl()

  return {
    "@context": "https://schema.org",
    // Bakery is a subtype of LocalBusiness, so this carries the storefront
    // details (address, phone, hours) as well as the brand identity.
    "@type": "Bakery",
    "@id": businessId(),
    name: "KAKEEZ Bakeshop",
    alternateName: "Kakeez",
    slogan: "Every Bite Matters",
    description:
      "Kakeez Bakeshop makes fresh, custom celebration cakes, cupcakes, cookies and brownies in Johar Town, Lahore.",
    url: site,
    logo: `${site}/assets/LOGO.png`,
    image: `${site}/og-home.jpg`,
    telephone: CONTACT.phoneHref.replace("tel:", ""),
    email: CONTACT.email,
    // Broad band rather than a specific figure -- schema.org expects an
    // indicator, not a price list.
    priceRange: "$$",
    currenciesAccepted: "PKR",
    address: {
      "@type": "PostalAddress",
      streetAddress: CONTACT.addressLines[0],
      addressLocality: CONTACT.city,
      addressRegion: "Punjab",
      addressCountry: "PK",
    },
    areaServed: { "@type": "City", name: CONTACT.city },
    foundingDate: "2023-04",
    founder: { "@type": "Person", name: "Mian Zain" },
    // Taken from the handle the storefront links to. Correct or drop this if
    // the profile ever moves -- a sameAs pointing nowhere is worse than none.
    sameAs: ["https://www.instagram.com/kakeezbakers"],
  }
}

// Convenience for anything that needs the one-line address in copy.
export const businessAddress = addressOneLine
