import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (a stray lockfile in the user's home dir otherwise confuses inference).
  turbopack: {
    root: __dirname,
  },
  images: {
    // Allow product images served from Supabase Storage to be used with next/image.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
