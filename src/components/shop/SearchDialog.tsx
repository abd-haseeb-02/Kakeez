"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, X, Loader2, CornerDownLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { formatPkr } from "@/lib/money"

const DEBOUNCE_MS = 300
const MIN_QUERY = 2
const RESULT_LIMIT = 8

type ProductImageRow = {
  storage_path: string
  position: number
  is_featured: boolean
}

type SearchRow = {
  id: string
  slug: string | null
  name: string
  short_description: string | null
  base_price_minor: number | null
  is_best_seller: boolean
  product_images?: ProductImageRow[]
}

type Result = {
  id: string
  href: string
  name: string
  blurb: string | null
  price: number | null
  image: string
  isBestSeller: boolean
}

// PostgREST parses `or=(...)` as a comma-separated list, and ilike treats `%`
// and `_` as wildcards. A customer typing "cake, 2kg (small)" would otherwise
// either break the filter or silently match everything, so those characters
// are collapsed to spaces before the query is built.
function sanitize(raw: string): string {
  return raw
    .replace(/[%_,()\\*"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function heroImage(row: SearchRow): string {
  const images = row.product_images ?? []
  const featured = images.find((image) => image.is_featured) ?? images[0]
  return featured?.storage_path ?? "/assets/product.svg"
}

// Mounted only while open (see Navbar), so closing unmounts and every piece of
// state resets on its own — no teardown effect needed.
export default function SearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  // Monotonic request id. Debouncing alone doesn't stop an early slow query
  // from resolving after a later fast one and overwriting fresher results, so
  // every response checks that it is still the most recent before rendering.
  const requestId = useRef(0)

  const router = useRouter()

  const term = sanitize(query)
  const tooShort = term.length < MIN_QUERY

  useEffect(() => {
    if (tooShort) return

    const timer = window.setTimeout(async () => {
      const id = ++requestId.current

      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, short_description, base_price_minor, is_best_seller, product_images(storage_path, position, is_featured)")
        .or(`name.ilike.%${term}%,short_description.ilike.%${term}%`)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("is_best_seller", { ascending: false })
        .limit(RESULT_LIMIT)

      // A stale response — the customer has typed again since this fired.
      if (id !== requestId.current) return

      const rows = (error ? [] : ((data as SearchRow[] | null) ?? [])).map<Result>((row) => ({
        id: row.id,
        href: `/product/${row.slug ?? row.id}`,
        name: row.name,
        blurb: row.short_description,
        price: row.base_price_minor,
        image: heroImage(row),
        isBestSeller: row.is_best_seller,
      }))

      setResults(rows)
      setActiveIndex(0)
      setSearching(false)
      setHasSearched(true)
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [term, tooShort])

  // The spinner is driven from the change handler rather than the effect: it
  // has to appear the instant someone types, not after the debounce elapses.
  const onQueryChange = (value: string) => {
    setQuery(value)
    setSearching(sanitize(value).length >= MIN_QUERY)
  }

  // Keyboard-only path. Mouse clicks go through the <Link> rows below, which
  // let Next own the navigation -- closing first would unmount this component
  // mid-transition and the push would never land.
  const open = useCallback(
    (href: string) => {
      router.push(href)
      onClose()
    },
    [onClose, router]
  )

  // Escape closes from anywhere; arrows walk the list without leaving the input.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      onClose()
      return
    }
    if (tooShort || !results.length) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % results.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + results.length) % results.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const target = results[activeIndex]
      if (target) open(target.href)
    }
  }

  // While the query is too short the previous query's results are stale, so the
  // prompt is shown instead of clearing state behind the scenes.
  const visibleResults = tooShort ? [] : results

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[clamp(70px,10vh,130px)]" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search products"
        className="relative w-full max-w-[620px] overflow-hidden rounded-[16px] border border-white/70 bg-[#fffdf7] shadow-[0_24px_80px_rgba(51,34,16,0.32)] animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex items-center gap-3 border-b border-primary-brown/15 px-4 sm:px-5">
          <Search className="h-5 w-5 shrink-0 text-primary-brown/50" strokeWidth={2} />
          <input
            // Mounts only when the dialog opens, so this focuses on open.
            autoFocus
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search cakes, cupcakes, brownies…"
            aria-label="Search products"
            className="h-[58px] w-full bg-transparent ff-apfel text-[16px] text-primary-brown outline-none placeholder:text-primary-brown/40"
          />
          {searching && !tooShort && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-brown/50" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-brown/60 transition-colors hover:bg-primary-brown/10 hover:text-primary-brown"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(60vh,440px)] overflow-y-auto">
          {tooShort ? (
            <p className="px-5 py-8 text-center ff-apfel text-[14px] text-primary-brown/50">
              Type at least {MIN_QUERY} characters to search.
            </p>
          ) : hasSearched && !searching && !visibleResults.length ? (
            <div className="px-5 py-8 text-center">
              <p className="ff-accia text-[20px] text-primary-brown">Nothing matched &ldquo;{term}&rdquo;</p>
              <p className="mt-1.5 ff-apfel text-[14px] text-primary-brown/55">
                Try a different word, or browse the full menu.
              </p>
            </div>
          ) : !visibleResults.length ? (
            <p className="px-5 py-8 text-center ff-apfel text-[14px] text-primary-brown/50">Searching…</p>
          ) : (
            <ul className="py-2">
              {visibleResults.map((result, index) => (
                <li key={result.id}>
                  <Link
                    href={result.href}
                    onClick={onClose}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors sm:px-5 ${
                      index === activeIndex ? "bg-primary-brown/10" : "hover:bg-primary-brown/5"
                    }`}
                  >
                    <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border border-primary-brown/15 bg-[#ece9e2]">
                      <Image src={result.image} alt="" fill sizes="48px" className="object-cover" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate ff-accia text-[17px] leading-tight text-primary-brown">{result.name}</span>
                        {result.isBestSeller && (
                          <span className="shrink-0 rounded-full bg-accent-green px-2 py-0.5 ff-colville text-[11px] uppercase tracking-[0.06em] text-primary-brown">
                            Best seller
                          </span>
                        )}
                      </span>
                      {result.blurb && (
                        <span className="mt-0.5 block truncate ff-apfel text-[13px] text-primary-brown/55">{result.blurb}</span>
                      )}
                    </span>

                    {result.price !== null && (
                      <span className="shrink-0 ff-colville text-[15px] text-primary-brown">
                        {formatPkr(result.price, { trimDecimals: true })}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!!visibleResults.length && (
          <div className="flex items-center justify-between border-t border-primary-brown/15 px-5 py-2.5 ff-apfel text-[12px] text-primary-brown/45">
            <span>
              {visibleResults.length} result{visibleResults.length === 1 ? "" : "s"}
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <CornerDownLeft className="h-3 w-3" /> to open · ↑↓ to browse · esc to close
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
