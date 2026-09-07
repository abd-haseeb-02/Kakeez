import BrandLoader from "@/components/shop/BrandLoader"

// Shown during server navigation for any route without a closer loading.tsx.
// The storefront's own pages render their data on the server now, so this is
// the transition state rather than something visitors sit behind on first load.
export default function Loading() {
  return <BrandLoader />
}
