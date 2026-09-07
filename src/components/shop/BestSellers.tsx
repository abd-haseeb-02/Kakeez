"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { useCart } from "@/store/useCart"
import cakesIcon from "../../../cakes.png"
import cookiesIcon from "../../../cookies.png"
import cupcakesIcon from "../../../cupcakes.png"
import customizedCakesIcon from "../../../customized cakes.png"

// The interactive half of the homepage. Products arrive already fetched from
// the server component, so this renders complete on the first pass -- the page
// no longer blanks itself behind a spinner waiting on a browser-side query.
// Only the bits that genuinely need state live here: the category pills, the
// per-category "view more" counter, and add-to-cart.

const CATEGORY_ICONS = {
  "simple cakes": cakesIcon,
  "customized cake": customizedCakesIcon,
  "customized cakes": customizedCakesIcon,
  cookies: cookiesIcon,
  "cup cakes": cupcakesIcon,
  cupcakes: cupcakesIcon,
}

const PAGE_SIZE = 6

export type HomeProduct = {
  id: string
  slug: string | null
  name: string
  description: string | null
  price: number
  image_url: string | null
}

export type HomeCategory = {
  id: string
  name: string
  slug: string | null
  products: HomeProduct[]
}

function getCategoryIcon(name: string) {
  return CATEGORY_ICONS[name.trim().toLowerCase() as keyof typeof CATEGORY_ICONS]
}

export default function BestSellers({ categories }: { categories: HomeCategory[] }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(categories[0]?.id ?? null)
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({})
  const addItem = useCart((state) => state.addItem)

  return (
    <section className="relative mx-auto w-[calc(100%_-_24px)] bg-accent-green pb-[clamp(56px,10vw,72px)] pt-[clamp(56px,10vw,72px)] lg:w-[calc(100%_-_40px)] lg:pb-[clamp(88px,7rem,112px)] lg:pt-[clamp(168px,13rem,208px)]">
      <div className="pointer-events-none absolute left-1/2 top-[-2px] z-0 hidden h-[clamp(128px,12rem,192px)] w-full -translate-x-1/2 lg:block">
        <Image src="/assets/vector13.svg" alt="" fill className="block h-full w-full object-fill" />
      </div>
      <div className="pointer-events-none absolute bottom-[-118px] left-0 z-0 hidden h-[clamp(126px,11rem,176px)] w-full lg:block">
        <Image src="/assets/vector14.svg" alt="" fill className="block h-full w-full object-fill" />
      </div>

      <div className="relative z-10 mx-auto w-[min(1390px,calc(100%_-_32px))]">
        <h2 className="ff-accia text-center text-[clamp(38px,4.6vw,72px)] leading-none text-primary-brown">Shop Best Sellers</h2>

        <div className="mt-7 flex snap-x gap-3 overflow-x-auto pb-3">
          {categories.map((category) => {
            const categoryIcon = getCategoryIcon(category.name)
            const isActive = activeCategory === category.id

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveCategory(category.id)
                  document.getElementById(`mobile-category-${category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
                className={`flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2.5 transition-all ${
                  isActive ? "border-primary-brown bg-white shadow-sm" : "border-primary-brown/10 bg-white/45"
                }`}
              >
                {categoryIcon && (
                  <span className="relative block h-7 w-7 shrink-0">
                    <Image src={categoryIcon} alt="" fill sizes="28px" className="object-contain" />
                  </span>
                )}
                <span className="ff-colville text-[15px] uppercase text-primary-brown">{category.name}</span>
              </button>
            )
          })}
        </div>

        <div id="menu" className="mt-[clamp(36px,4vw,64px)] scroll-mt-[120px] space-y-[clamp(48px,6vw,92px)]">
          {categories.map((category) => {
            const visibleCount = visibleCounts[category.id] ?? PAGE_SIZE
            const products = category.products.slice(0, visibleCount)
            const hasMore = category.products.length > visibleCount

            return (
              <section key={category.id} id={`mobile-category-${category.id}`} className="scroll-mt-24">
                <h3 className="ff-accia text-center text-[clamp(34px,4vw,62px)] uppercase leading-none text-primary-brown">
                  {category.name}
                </h3>
                {category.slug && (
                  <div className="mt-3 flex justify-center">
                    <Link
                      href={`/category/${category.slug}`}
                      className="ff-apfel text-sm uppercase tracking-[0.12em] text-primary-brown/70 underline-offset-4 transition-colors hover:text-primary-brown hover:underline"
                    >
                      View all {category.name}
                    </Link>
                  </div>
                )}
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {products.map((product, index) => (
                    <article
                      key={product.id}
                      className="overflow-hidden rounded-[14px] border border-primary-brown bg-white transition-all hover:shadow-lg"
                    >
                      <Link href={`/product/${product.slug ?? product.id}`} className="block">
                        <div className="relative aspect-square bg-[#ece9e2]">
                          <Image
                            src={product.image_url || "/assets/product.svg"}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            // The first row of the first category is the closest
                            // thing this page has to an above-the-fold grid image.
                            loading={index < 3 ? "eager" : "lazy"}
                            className="object-cover"
                          />
                        </div>
                      </Link>
                      <div className="px-4 py-5 text-center">
                        <Link href={`/product/${product.slug ?? product.id}`} className="block">
                          <h4 className="ff-accia text-[clamp(25px,2.3vw,34px)] leading-[1.04] text-primary-brown">{product.name}</h4>
                          <p className="ff-colville mt-2 text-[clamp(18px,1.5vw,24px)] text-primary-brown">Rs. {Number(product.price).toLocaleString()}</p>
                        </Link>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <Link
                            href={`/product/${product.slug ?? product.id}`}
                            className="flex h-11 items-center justify-center rounded-[10px] border border-primary-brown ff-accia text-[15px] uppercase text-primary-brown transition-colors hover:bg-primary-brown/5"
                          >
                            Buy Now
                          </Link>
                          <button
                            type="button"
                            onClick={() => addItem({ id: product.id, name: product.name, price: product.price, quantity: 1, image: product.image_url || "/assets/product.svg", description: product.description ?? undefined })}
                            className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary-brown px-3 ff-accia text-[15px] uppercase text-white transition-colors hover:bg-primary-brown/90"
                          >
                            <ShoppingCart className="h-4 w-4" /> Add
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-7 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCounts((prev) => ({ ...prev, [category.id]: (prev[category.id] ?? PAGE_SIZE) + PAGE_SIZE }))}
                      className="rounded-[8px] border border-primary-brown bg-white px-6 py-3 ff-accia text-[16px] uppercase tracking-[0.02em] text-primary-brown transition-opacity hover:opacity-75"
                    >
                      View More {category.name}
                    </button>
                  </div>
                )}
                {!hasMore && category.slug && products.length > 0 && (
                  <div className="mt-7 flex justify-center">
                    <Link
                      href={`/category/${category.slug}`}
                      className="rounded-[8px] border border-primary-brown bg-white px-6 py-3 ff-accia text-[16px] uppercase tracking-[0.02em] text-primary-brown transition-opacity hover:opacity-75"
                    >
                      Open {category.name}
                    </Link>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>
    </section>
  )
}
