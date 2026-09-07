import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile in the user's home dir otherwise confuses inference).
  turbopack: {
    root: __dirname,
  },
  images: {
    // AVIF first, WebP as the fallback. Next only ships one of these to a given
    // browser based on Accept, and AVIF is typically 20-30% smaller than WebP
    // at the same visual quality -- worth it for a catalogue of photographs.
    formats: ["image/avif", "image/webp"],
    // Allow product images served from Supabase Storage to be used with next/image.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // Every stable Vercel alias serves the exact same site as www.kakeez.com, on
  // its own hostname, with no canonical tag to tie them together — so search
  // engines see several complete copies of the shop and split its ranking
  // between them. Sending the aliases to the real domain with a 308 leaves one
  // indexable copy and passes any accumulated signal to it.
  //
  // Per-deployment URLs (kakeez-<hash>-….vercel.app) are deliberately not
  // matched: those are how you preview a build before promoting it, and Vercel
  // already serves them with `X-Robots-Tag: noindex`.
  async redirects() {
    const aliases = [
      "kakeez-one.vercel.app",
      "kakeez-abdul-haseebs-projects-ff568a70.vercel.app",
      "kakeez-git-master-abdul-haseebs-projects-ff568a70.vercel.app",
    ]

    return aliases.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://www.kakeez.com/:path*",
      permanent: true,
    }))
  },
};

export default nextConfig;
