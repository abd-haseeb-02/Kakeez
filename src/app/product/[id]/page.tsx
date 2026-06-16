"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import Image from "next/image"
import { useCart } from "@/store/useCart"
import { Loader2, Minus, Plus, Gift, Star } from "lucide-react"
import { useRouter } from "next/navigation"

// Scalloped "cloud" clip path for the hero (exported from Figma, viewBox 0 0 1668 504.216)
const HERO_CLIP =
  "M1668 324H1666.92C1667.63 329.918 1668 335.963 1668 342.108C1668 413.777 1618.08 471.875 1556.5 471.875C1521.32 471.875 1489.95 452.915 1469.51 423.297C1449.68 471.264 1408.58 504.216 1361.09 504.216C1311.32 504.216 1268.56 468.011 1249.95 416.258C1232.05 430.86 1209.67 439.534 1185.4 439.534C1149.35 439.534 1117.49 420.41 1098.24 391.15C1077.8 420.657 1046.49 439.534 1011.39 439.534C976.209 439.534 944.837 420.574 924.401 390.956C904.565 438.923 863.465 471.875 815.979 471.875C766.205 471.875 723.446 435.67 704.839 383.916C686.933 398.518 664.557 407.193 640.282 407.193C618.643 407.193 598.512 400.3 581.712 388.46C565.679 437.237 525.084 471.875 477.536 471.875C442.358 471.875 410.986 452.915 390.551 423.297C370.714 471.264 329.615 504.216 282.129 504.216C232.354 504.216 189.596 468.011 170.988 416.258C153.082 430.86 130.707 439.534 106.433 439.534C47.6518 439.534 0 388.675 0 325.938C2.98862e-07 325.29 0.0074782 324.645 0.0175781 324H0V0H1668V324Z"

const HERO_CATEGORIES = ["CUSTOMISED CAKES", "COOKIES", "BROWNIES", "BREADS", "KAKEEZ CATERING"]

const SAMPLE_REVIEWS = [
  { date: "03-Apr-2026", title: "Amazing And Reliable Brand", body: "It was so good", name: "moiz" },
  { date: "03-Apr-2026", title: "Really Good", body: "Loved it", name: "Abdul" },
  { date: "03-Apr-2026", title: "Swadish", body: "These are perfectttt💯💯 I'm a huge fan of the texture...it's the perfect blend of that cooked and uncooked cookie dough texture 😋", name: "Abdul" },
  { date: "03-Apr-2026", title: "Highly Recommend", body: "Soft, fresh and absolutely delicious. Will order again!", name: "Hina" },
]

function StarRow({ size = "1vw" }: { size?: string }) {
  return (
    <div className="flex items-center gap-[0.2vw]">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className="text-primary-brown fill-primary-brown" style={{ width: size, height: size }} />
      ))}
    </div>
  )
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [product, setProduct] = useState<any>(null)
  const [related, setRelated] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [instructions, setInstructions] = useState("")
  const [isGift, setIsGift] = useState(false)
  const addItem = useCart((state) => state.addItem)
  const router = useRouter()

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true)

      // Mock IDs fallback (legacy placeholder cards)
      if (id.length < 10) {
        setProduct({
          id,
          name: "Classic creamy cake",
          price: 1950,
          description:
            "Half decadent chocolate cookie dough and half vanilla cookie dough mixed with chunks of finest belgian milk chocolate.",
          image_url: "/assets/product.svg",
        })
        setLoading(false)
        return
      }

      const { data } = await supabase.from("products").select("*").eq("id", id).single()
      if (data) {
        setProduct(data)
        // related products (same category, excluding this one)
        const { data: rel } = await supabase
          .from("products")
          .select("*")
          .eq("category_id", data.category_id)
          .neq("id", data.id)
          .limit(3)
        if (rel) setRelated(rel)
      }
      setLoading(false)
    }
    fetchProduct()
  }, [id])

  const handleAddToCart = () => {
    if (!product) return
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image_url || "/assets/product.svg",
      description: product.description,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-brown" size={40} />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-primary-brown ff-accia text-2xl">
        Product not found
      </div>
    )
  }

  const heroImg = product.image_url || "/assets/product.svg"
  const priceLabel = `RS.${Number(product.price).toLocaleString()}`

  return (
    <div className="relative bg-white w-full overflow-hidden" style={{ height: "267.4vw" }}>
      <Navbar />

      {/* ===================== HERO ===================== */}
      <div className="absolute left-[1.74vw] top-[10.07vw] w-[96.53vw] h-[29.18vw]">
        <svg viewBox="0 0 1668 504.216" preserveAspectRatio="none" className="block w-full h-full">
          <defs>
            <clipPath id="heroProductClip" clipPathUnits="userSpaceOnUse">
              <path d={HERO_CLIP} />
            </clipPath>
          </defs>
          <g clipPath="url(#heroProductClip)">
            <image href={heroImg} x="0" y="0" width="1668" height="504.216" preserveAspectRatio="xMidYMid slice" />
            <rect x="0" y="0" width="1668" height="504.216" fill="#262729" opacity="0.45" />
          </g>
        </svg>

        {/* Hero title */}
        <h1 className="absolute left-1/2 -translate-x-1/2 top-[7.6vw] ff-accia text-[3.6vw] text-white text-center whitespace-nowrap drop-shadow-[0_0.2vw_0.5vw_rgba(0,0,0,0.35)]">
          {product.name}
        </h1>

        {/* Category bar */}
        <div className="absolute left-1/2 -translate-x-1/2 top-[14.2vw] flex items-center gap-[2.2vw]">
          <span className="bg-accent-green rounded-[1.5vw] px-[1.5vw] py-[0.55vw] ff-colville text-[1.27vw] text-primary-brown underline tracking-[-0.025vw] whitespace-nowrap">
            CAKES
          </span>
          {HERO_CATEGORIES.map((c) => (
            <span key={c} className="ff-colville text-[1.27vw] text-white underline tracking-[-0.025vw] whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity">
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* ===================== PRODUCT DETAIL ===================== */}
      <div className="absolute left-[8.04vw] top-[44.33vw] w-[83.9vw] h-[92.88vw] bg-accent-green rounded-[1.4vw]">
        {/* Dripping bottom edge */}
        <div className="absolute left-0 bottom-[-9vw] w-full h-[14.4vw] pointer-events-none" style={{ transform: "scaleY(-1)" }}>
          <Image src="/assets/union-drip.svg" alt="" fill className="block w-full h-full object-fill" />
        </div>

        {/* Main image */}
        <div className="absolute left-[2.14vw] top-[3.18vw] w-[39.35vw] h-[41.9vw] rounded-[1.2vw] overflow-hidden bg-[#ece9e2] border border-primary-brown/15">
          <Image src={heroImg} alt={product.name} fill className="object-cover" />
        </div>
        {/* Thumbnails */}
        <div className="absolute left-[12.44vw] top-[47.6vw] w-[8.8vw] h-[8.9vw] rounded-[0.8vw] overflow-hidden bg-[#ece9e2] border border-primary-brown/30">
          <Image src={heroImg} alt="" fill className="object-cover" />
        </div>
        <div className="absolute left-[22.4vw] top-[47.6vw] w-[8.8vw] h-[8.9vw] rounded-[0.8vw] overflow-hidden bg-[#ece9e2] border border-primary-brown/30">
          <Image src={heroImg} alt="" fill className="object-cover" />
        </div>

        {/* Right column */}
        <div className="absolute left-[43.93vw] top-[5.15vw] w-[30.2vw]">
          {/* Title + rating */}
          <div className="flex items-start justify-between gap-[1vw]">
            <h2 className="ff-accia text-[2.6vw] text-primary-brown leading-[1.05] flex-1">{product.name}</h2>
            <div className="flex items-center gap-[0.4vw] pt-[0.6vw] whitespace-nowrap">
              <Star className="text-primary-brown fill-primary-brown w-[1.2vw] h-[1.2vw]" />
              <span className="ff-accia-light text-[1.05vw] text-primary-brown">4.3 (150 Reviews)</span>
            </div>
          </div>

          {/* Price */}
          <p className="ff-colville text-[1.7vw] text-primary-brown mt-[1.4vw]">{priceLabel}</p>

          {/* Description */}
          <p className="ff-accia-light text-[1.16vw] text-black/80 leading-[1.3] mt-[0.8vw] capitalize">
            {product.description ||
              "Half decadent chocolate cookie dough and half vanilla cookie dough mixed with chunks of finest belgian milk chocolate."}
          </p>

          {/* Special instructions */}
          <p className="ff-accia text-[1.39vw] text-black mt-[1.4vw]">Special Instructions</p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Please enter instructions about this item"
            className="w-full h-[8.5vw] mt-[0.6vw] bg-white border border-primary-brown/30 rounded-[0.7vw] px-[1vw] py-[0.8vw] outline-none focus:border-primary-brown transition-all ff-accia-light text-[1.04vw] text-black/70 resize-none"
          />

          {/* Quantity */}
          <p className="ff-accia text-[1.39vw] text-black mt-[1.4vw]">Quantity:</p>
          <div className="flex items-center justify-between w-[13.1vw] h-[3.1vw] mt-[0.6vw] border border-primary-brown rounded-[0.6vw] px-[1vw] bg-white">
            <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="text-primary-brown hover:opacity-60 transition-opacity" aria-label="Decrease">
              <Minus className="w-[1.16vw] h-[1.16vw]" />
            </button>
            <span className="ff-accia text-[1.7vw] text-primary-brown leading-none">{quantity}</span>
            <button onClick={() => setQuantity((q) => q + 1)} className="text-primary-brown hover:opacity-60 transition-opacity" aria-label="Increase">
              <Plus className="w-[1.16vw] h-[1.16vw]" />
            </button>
          </div>

          {/* Add to cart */}
          <button
            onClick={handleAddToCart}
            className="w-full h-[3.9vw] mt-[1.2vw] bg-primary-brown rounded-[0.7vw] flex items-center justify-center hover:bg-primary-brown/90 transition-all"
          >
            <span className="ff-accia text-[1.5vw] text-white tracking-[0.02vw]">
              ADD TO CART - RS.{(Number(product.price) * quantity).toLocaleString()}
            </span>
          </button>

          {/* Is this a gift */}
          <button
            onClick={() => setIsGift((g) => !g)}
            className={`w-full mt-[1vw] rounded-[0.7vw] px-[1vw] py-[0.9vw] flex items-center gap-[1vw] text-left transition-all border ${
              isGift ? "bg-primary-brown/10 border-primary-brown" : "bg-white/60 border-primary-brown/20"
            }`}
          >
            <div className={`w-[2.6vw] h-[2.6vw] min-w-[34px] min-h-[34px] rounded-[0.6vw] flex items-center justify-center ${isGift ? "bg-primary-brown text-white" : "bg-accent-green text-primary-brown"}`}>
              <Gift className="w-[1.4vw] h-[1.4vw]" />
            </div>
            <div>
              <p className="ff-accia text-[1.16vw] text-black">Is this a gift?</p>
              <p className="ff-accia-light text-[0.9vw] text-black/60 leading-[1.2]">If checked, all prices will be removed from the paying slip</p>
            </div>
          </button>

          {/* Flavor copy */}
          <p className="ff-accia-medium text-[1.5vw] text-primary-brown mt-[2vw] leading-[1.15]">
            Signature Cookie Assortment - A Gourmet Collection of Our Best-Selling Flavors!
          </p>
          <p className="ff-accia-light text-[1.04vw] text-black/75 mt-[0.8vw] leading-[1.3]">
            Indulge in our premium cookie variety box, featuring all four of our original, handcrafted flavors in one exquisite collection:
          </p>
          <p className="ff-accia text-[1.6vw] text-primary-brown mt-[1.2vw]">Enjoy Perfect Flavors</p>
          <ul className="ff-accia-light text-[1.04vw] text-black/75 mt-[0.6vw] leading-[1.4] space-y-[0.5vw] list-disc pl-[1.2vw]">
            <li><span className="ff-accia text-black">Lotus Lava:</span> A rich Lotus-filled cookie featuring a caramel-based dough with white chocolate chunks.</li>
            <li><span className="ff-accia text-black">Brownie:</span> Fudgy, chocolatey perfection for true dessert lovers.</li>
            <li><span className="ff-accia text-black">Walnut:</span> Crunchy, nutty goodness with buttery undertones.</li>
            <li><span className="ff-accia text-black">Classic:</span> Timeless buttery sweetness that never disappoints.</li>
          </ul>
        </div>
      </div>

      {/* ===================== YOU MAY ALSO LIKE ===================== */}
      <h2 className="absolute left-1/2 -translate-x-1/2 top-[148.15vw] ff-accia text-[3.6vw] text-primary-brown text-center whitespace-nowrap">
        You May Also Like
      </h2>
      <div className="absolute left-[8.04vw] top-[154.92vw] w-[83.9vw] flex justify-between gap-[2vw]">
        {(related.length > 0
          ? related
          : [product, product, product]
        ).slice(0, 3).map((p, idx) => (
          <div
            key={p.id + "-" + idx}
            onClick={() => p.id && p.id !== product.id && router.push(`/product/${p.id}`)}
            className="w-[26.4vw] bg-white rounded-[0.9vw] border border-primary-brown overflow-hidden cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="w-full h-[27vw] bg-[#ece9e2] relative">
              <Image src={p.image_url || "/assets/product.svg"} alt={p.name} fill className="object-cover" />
            </div>
            <div className="px-[1.5vw] py-[1.4vw] text-center">
              <h3 className="ff-accia text-[2vw] text-primary-brown leading-[1.05]">{p.name}</h3>
              <p className="ff-colville text-[1.5vw] text-primary-brown mt-[0.5vw]">Rs.{Number(p.price).toLocaleString()}</p>
              <div className="flex items-center justify-center gap-[0.6vw] mt-[0.8vw]">
                <StarRow size="1vw" />
                <span className="ff-accia-light text-[1vw] text-primary-brown lowercase">43 reviews</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ===================== HAPPY CUSTOMERS ===================== */}
      <h2 className="absolute left-1/2 -translate-x-1/2 top-[205.96vw] ff-accia text-[3.6vw] text-primary-brown text-center whitespace-nowrap">
        Happy Customers
      </h2>
      <div className="absolute left-[8.04vw] top-[212.73vw] w-[83.9vw] flex gap-[1.2vw] overflow-x-auto pb-[1vw]">
        {SAMPLE_REVIEWS.map((r, idx) => (
          <div key={idx} className="shrink-0 w-[27.2vw] h-[21.5vw] bg-[#f3f3f3] rounded-[0.7vw] p-[1.5vw] flex flex-col">
            <div className="flex items-start justify-between">
              <StarRow size="1.1vw" />
              <span className="ff-accia-light text-[1.04vw] text-primary-brown lowercase">{r.date}</span>
            </div>
            <h3 className="ff-accia text-[1.27vw] text-black mt-[1.4vw]">{r.title}</h3>
            <p className="ff-accia text-[1.04vw] text-primary-brown mt-[1vw] leading-[1.3] flex-1 overflow-hidden">{r.body}</p>
            <div className="w-full h-px bg-primary-brown/20 mt-[0.8vw]" />
            <p className="ff-accia text-[1.27vw] text-black mt-[0.8vw]">{r.name}</p>
          </div>
        ))}
      </div>

      <Footer topOffset={244.16} />
    </div>
  )
}
