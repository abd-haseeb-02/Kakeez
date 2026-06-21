import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ProductDetailClient from "./ProductDetailClient"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function productExists(slugOrId: string): Promise<boolean> {
  const supabase = await createClient()

  const slugRes = await supabase
    .from("products")
    .select("id")
    .eq("slug", slugOrId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()

  if (slugRes.data) return true
  if (!UUID_RE.test(slugOrId)) return false

  const idRes = await supabase
    .from("products")
    .select("id")
    .eq("id", slugOrId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle()

  return Boolean(idRes.data)
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  if (!(await productExists(slug))) {
    notFound()
  }

  return <ProductDetailClient slug={slug} />
}
