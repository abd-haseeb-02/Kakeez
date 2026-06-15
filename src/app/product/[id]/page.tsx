"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import Image from "next/image"
import { useCart } from "@/store/useCart"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const addItem = useCart(state => state.addItem)
  const router = useRouter()

  useEffect(() => {
    const fetchProduct = async () => {
      // Mock IDs fallback
      if (id.length < 10) {
        setProduct({
          id: id,
          name: "Classic Creamy Cake",
          price: 1950,
          description: "Our signature classic creamy cake, baked fresh with the finest ingredients. Perfect for any celebration.",
          image_url: "/assets/product.svg",
          reviews: 43
        })
        setLoading(false)
        return
      }

      const { data } = await supabase.from('products').select('*').eq('id', id).single()
      if (data) setProduct(data)
      setLoading(false)
    }
    fetchProduct()
  }, [id])

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-primary-brown" size={40} /></div>
  }

  if (!product) return <div className="min-h-screen bg-white flex items-center justify-center text-primary-brown ff-accia text-2xl">Product not found</div>

  return (
    <div className="bg-white min-h-screen relative overflow-hidden flex flex-col">
      {/* Dynamic wrapper for the absolute Navbar */}
      <div className="relative w-full h-[15vw] bg-accent-green/30">
         <Navbar />
      </div>

      <div className="max-w-[80vw] mx-auto mt-[5vw] mb-[10vw] flex gap-[5vw]">
         {/* Image */}
         <div className="w-[40vw] h-[40vw] relative bg-[#ece9e2] rounded-[2vw] overflow-hidden shadow-xl border border-primary-brown/10">
           <Image src={product.image_url || "/assets/product.svg"} alt={product.name} fill className="object-cover" />
         </div>

         {/* Details */}
         <div className="flex-1 space-y-[2vw] pt-[5vw]">
           <h1 className="ff-accia text-[4vw] text-primary-brown leading-[1.1]">{product.name}</h1>
           <p className="ff-colville text-[2vw] text-primary-brown">Rs. {product.price}</p>
           
           <div className="flex items-center gap-[1vw]">
             <div className="w-[9vw] h-[1.3vw] relative">
               <Image src="/assets/stars.svg" alt="rating" fill className="object-contain" />
             </div>
             <span className="ff-accia-light text-[1.2vw] text-primary-brown lowercase">
               {product.reviews || 43} reviews
             </span>
           </div>

           <div className="w-full h-px bg-primary-brown/10"></div>
           
           <p className="ff-apfel text-[1.2vw] text-primary-brown/80 leading-relaxed">
             {product.description || "A delicious treat made with love. Order now to experience the bliss of Kakeez. Every bite matters when it comes to celebrating your special moments."}
           </p>

           <div className="flex gap-[1vw] pt-[2vw]">
             <button 
               onClick={() => addItem({ id: product.id, name: product.name, price: product.price, quantity: 1, image: product.image_url || "/assets/product.svg" })}
               className="flex-1 bg-white border border-primary-brown text-primary-brown py-[1.5vw] rounded-[1vw] ff-accia text-[1.5vw] hover:bg-primary-brown/5 transition-all"
             >
               ADD TO CART
             </button>
             <button 
               onClick={() => {
                 addItem({ id: product.id, name: product.name, price: product.price, quantity: 1, image: product.image_url || "/assets/product.svg" })
                 router.push('/checkout')
               }}
               className="flex-1 bg-primary-brown text-white py-[1.5vw] rounded-[1vw] ff-accia text-[1.5vw] hover:bg-primary-brown/90 transition-all"
             >
               BUY NOW
             </button>
           </div>
         </div>
      </div>
      
      {/* We use a relative container for the Footer since it was absolutely positioned for the home page */}
      <div className="relative w-full h-[30vw] bg-white mt-auto border-t border-primary-brown/10 flex items-center justify-center">
         <p className="ff-colville text-[1vw] text-primary-brown">© 2022-24 KAKEEZ All rights reserved</p>
      </div>
    </div>
  )
}
