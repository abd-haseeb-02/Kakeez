import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ProductDetailClient, { type ProductRow } from "./ProductDetailClient"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PRODUCT_SELECT =
  "id, slug, name, description, base_price_minor, is_perishable, rating_avg, rating_count, product_categories(category_id, categories(name, slug)), product_images(storage_path, position, is_featured)"

// Previously this only checked that the product existed and handed the client
// component a slug, which then re-ran the same query in the browser -- so the
// server paid for a round-trip, threw the result away, and the visitor watched
// a spinner while it happened again. Fetching the row here means the page is
// rendered complete on the server and the client starts with content.
async function fetchProduct(slugOrId: string) {
  const supabase = await createClient()

  const bySlug = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slugOrId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()

  if (bySlug.data) return bySlug.data
  if (!UUID_RE.test(slugOrId)) return null

  const byId = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", slugOrId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()

  return byId.data
}

// PostgREST returns the parent of a many-to-one embed as an object, but the
// generated types widen it to an array, so the inferred row never structurally
// matches ProductRow. The client component has always cast at this same
// boundary; the cast is centralised here now that the fetch lives server-side.
function asProductRow(row: unknown): ProductRow {
  return row as ProductRow
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await fetchProduct(slug)

  if (!product) {
    notFound()
  }

  return <ProductDetailClient slug={slug} initialProduct={asProductRow(product)} />
}
