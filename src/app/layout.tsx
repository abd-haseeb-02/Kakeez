import type { Metadata } from "next";
import { Cormorant_Garamond, Playfair_Display, Space_Grotesk } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "KAKEEZ Bakeshop | Every Bite Matters",
  description: "At Kakeez, we believe every celebration deserves a centerpiece as delicious as it is beautiful. Artisanal cakes, brownies, and cookies.",
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
