import type { Metadata } from "next";
import { Cormorant_Garamond, Playfair_Display, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";

const accia = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-accia",
  display: "swap",
});

const colville = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-colville",
  display: "swap",
});

const apfel = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-apfel",
  display: "swap",
});

const SITE_NAME = "KAKEEZ Bakeshop";
const DESCRIPTION =
  "At Kakeez, we believe every celebration deserves a centerpiece as delicious as it is beautiful. Artisanal cakes, brownies, and cookies.";

export const metadata: Metadata = {
  // Anchors every relative URL below — and, more importantly, makes the
  // canonical tags absolute. Without it no page declared which hostname it
  // really lived on, so the site was served identically from the custom domain
  // and the Vercel aliases with nothing telling a crawler which one counts.
  metadataBase: new URL(getSiteUrl()),

  // Inherited by any route that doesn't set its own `alternates` — correct for
  // "/" only, so every other indexable route overrides it. Check this when
  // adding a public page: an inherited "/" canonical tells Google the new page
  // is a duplicate of the homepage and quietly drops it from the index.
  alternates: { canonical: "/" },

  title: SITE_NAME + " | Every Bite Matters",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME + " | Every Bite Matters",
    description: DESCRIPTION,
    url: "/",
    locale: "en_PK",
    // Resolved against metadataBase, so shares carry an absolute URL.
    images: [{ url: "/og-home.jpg", width: 1200, height: 630, alt: "Kakeez Bakeshop — artistry in every slice" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME + " | Every Bite Matters",
    description: DESCRIPTION,
    images: ["/og-home.jpg"],
  },

  // Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to the token from Search Console's
  // "HTML tag" method and redeploy; leaving it unset emits nothing.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,

  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${accia.variable} ${colville.variable} ${apfel.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
