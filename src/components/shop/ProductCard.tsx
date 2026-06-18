"use client"

import Image from "next/image"
import { useCart } from "@/store/useCart"
import { useRouter } from "next/navigation"

interface ProductCardProps {
  id: string
  slug?: string                // Phase 2: SEO-friendly route key. Falls back to id.
  name: string
  price: number
  reviews?: number             // Phase 6: real product.rating_count from DB (was hardcoded 43)
  ratingAvg?: number
  imageUrl?: string
  description?: string
  isBestSeller?: boolean
  layoutType?: 'standard' | 'add-to-cart' | 'buy-now'
  left: string
  top: string
}

export default function ProductCard({
  id,
  slug,
  name,
  price,
  reviews = 0,
  imageUrl = "/assets/product.svg",
  description,
  isBestSeller = false,
  layoutType = 'standard',
  left,
  top
}: ProductCardProps) {
  const addItem = useCart(state => state.addItem)
  const router = useRouter()

  const handleAddToCart = () => {
    addItem({ id, name, price, quantity: 1, image: imageUrl, description })
  }

  const goToProduct = () => {
    router.push(`/product/${slug ?? id}`)
  }

  const cardStyle = { left, top }

  // The original image height was 28.93vw.
  // The original card heights were 41.08vw (standard) and 42.30vw (buy now).
  // Bottom padding was approx 2.9vw. 
  // We want the space ABOVE the title to match that exactly.
  
  const renderImage = () => (
    <div className="absolute inset-[0.0755vw] bottom-[12.15vw] bg-[#ece9e2] rounded-t-[0.9053vw] overflow-hidden pointer-events-none">
      <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
    </div>
  )

  const titleTop = `calc(${top} + 31.8vw)` // 28.93 (img) + 2.87 (padding) = 31.8
  const priceTop = `calc(${top} + 35.5vw)`

  if (layoutType === 'add-to-cart') {
    return (
      <>
        <div onClick={goToProduct} className={`absolute w-[26.3889vw] h-[41.0880vw] bg-white border-[0.0755vw] border-black border-solid rounded-[0.9053vw] cursor-pointer overflow-hidden`} style={cardStyle}>
          {renderImage()}
        </div>
        <div onClick={goToProduct} className={`absolute ff-accia text-[2.3148vw] text-[#936939] text-center tracking-[-0.0463vw] whitespace-nowrap leading-[1.2] cursor-pointer`} style={{ left: `calc(${left} + 13.2vw)`, top: titleTop, transform: 'translateX(-50%) translateY(-50%)' }}>
          {name}
        </div>
        <div className={`absolute ff-colville text-[1.8105vw] text-[#936939] text-center tracking-[-0.0362vw] whitespace-nowrap leading-[1.2]`} style={{ left: `calc(${left} + 13.2vw)`, top: priceTop, transform: 'translateX(-50%) translateY(-50%)' }}>
          Rs.{price}
        </div>
        <button 
          onClick={handleAddToCart}
          className={`absolute w-[18.2870vw] h-[2.4306vw] bg-[#936939] rounded-[0.6944vw] hover:bg-primary-brown/90 transition-all cursor-pointer`} 
          style={{ left: `calc(${left} + 4.05vw)`, top: `calc(${top} + 37.8vw)` }}
        ></button>
        <div 
          onClick={handleAddToCart}
          className={`absolute ff-accia text-[1.2731vw] text-white tracking-[-0.0255vw] whitespace-nowrap leading-[0.9] pointer-events-none`} 
          style={{ left: `calc(${left} + 8.9vw)`, top: `calc(${top} + 39.0vw)`, transform: 'translateY(-50%)' }}
        >
          ADD TO CART
        </div>
      </>
    )
  }

  if (layoutType === 'buy-now') {
    return (
      <>
        <div onClick={goToProduct} className={`absolute w-[26.3889vw] h-[42.3032vw] bg-white border-[0.0755vw] border-black border-solid rounded-[0.9053vw] cursor-pointer overflow-hidden`} style={cardStyle}>
          {renderImage()}
        </div>
        <div onClick={goToProduct} className={`absolute ff-accia text-[2.3148vw] text-[#936939] text-center tracking-[-0.0463vw] whitespace-nowrap leading-[1.2] cursor-pointer`} style={{ left: `calc(${left} + 13.2vw)`, top: titleTop, transform: 'translateX(-50%) translateY(-50%)' }}>
          {name}
        </div>
        <div className={`absolute ff-colville text-[1.8105vw] text-[#936939] text-center tracking-[-0.0362vw] whitespace-nowrap leading-[1.2]`} style={{ left: `calc(${left} + 13.2vw)`, top: priceTop, transform: 'translateX(-50%) translateY(-50%)' }}>
          Rs.{price}
        </div>
        <button 
          onClick={goToProduct}
          className={`absolute w-[8.9120vw] h-[2.3148vw] border border-[#936939] border-solid rounded-[0.6944vw] hover:bg-primary-brown/5 transition-all cursor-pointer`} 
          style={{ left: `calc(${left} + 2.54vw)`, top: `calc(${top} + 38.5vw)`, borderWidth: '0.0579vw' }}
        ></button>
        <div className={`absolute ff-accia text-[1.2731vw] text-[#936939] tracking-[-0.0255vw] whitespace-nowrap leading-[0.9] pointer-events-none`} style={{ left: `calc(${left} + 3.9vw)`, top: `calc(${top} + 39.6vw)`, transform: 'translateY(-50%)' }}>
          BUY NOW
        </div>
        <button 
          onClick={handleAddToCart}
          className={`absolute w-[11.4583vw] h-[2.3148vw] bg-[#936939] rounded-[0.6944vw] hover:bg-primary-brown/90 transition-all cursor-pointer`} 
          style={{ left: `calc(${left} + 12.4vw)`, top: `calc(${top} + 38.5vw)` }}
        ></button>
        <div 
          onClick={handleAddToCart}
          className={`absolute ff-accia text-[1.2731vw] text-white tracking-[-0.0255vw] whitespace-nowrap leading-[0.9] pointer-events-none`} 
          style={{ left: `calc(${left} + 13.8vw)`, top: `calc(${top} + 39.6vw)`, transform: 'translateY(-50%)' }}
        >
          ADD TO CART
        </div>
      </>
    )
  }

  return (
    <>
      <div onClick={goToProduct} className={`absolute w-[26.3889vw] h-[41.0880vw] bg-white border-[0.0755vw] border-black border-solid rounded-[0.9053vw] cursor-pointer overflow-hidden`} style={cardStyle}>
        {renderImage()}
      </div>
      <div onClick={goToProduct} className={`absolute ff-accia text-[2.3148vw] text-[#936939] text-center tracking-[-0.0463vw] whitespace-nowrap leading-[1.2] cursor-pointer`} style={{ left: `calc(${left} + 13.2vw)`, top: titleTop, transform: 'translateX(-50%) translateY(-50%)' }}>
        {name}
      </div>
      <div className={`absolute ff-colville text-[1.8105vw] text-[#936939] text-center tracking-[-0.0362vw] whitespace-nowrap leading-[1.2]`} style={{ left: `calc(${left} + 13.2vw)`, top: priceTop, transform: 'translateX(-50%) translateY(-50%)' }}>
        Rs.{price}
      </div>
      <div className={`absolute w-[9.0278vw] h-[1.3889vw]`} style={{ left: `calc(${left} + 5.08vw)`, top: `calc(${top} + 37.8vw)` }}>
        <Image src="/assets/stars.svg" alt="rating" width={156} height={24} className="block w-full h-full" />
      </div>
      <div className={`absolute ff-accia-light text-[1.2731vw] text-[#936939] lowercase text-center whitespace-nowrap leading-[1.2]`} style={{ left: `calc(${left} + 18.16vw)`, top: `calc(${top} + 38.5vw)`, transform: 'translateX(-50%) translateY(-50%)' }}>
        {reviews} reviews
      </div>

      {isBestSeller && (
        <div className="absolute pointer-events-none" style={{ left: `calc(${left} + 1.67vw)`, top: `calc(${top} + 1.67vw)`, width: '6.4815vw', height: '1.8519vw' }}>
          <div className="absolute inset-0 bg-white opacity-70 rounded-[1.5046vw]"></div>
          <div className="absolute left-[0.6944vw] top-1/2 -translate-y-1/2 ff-colville text-[0.8102vw] text-[#747474] tracking-[-0.0162vw] whitespace-nowrap">Best seller</div>
          <div className="absolute left-[4.8611vw] top-[0.4630vw] w-[1.0417vw] h-[1.0417vw] overflow-hidden">
            <div className="absolute left-[5.56%] right-[5.56%] top-0 bottom-0">
              <Image src="/assets/fire-1.svg" alt="" width={18} height={18} className="absolute" style={{ top: '3.12%', right: '13.25%', bottom: '3.13%', left: '13.23%' }} />
              <Image src="/assets/fire-2.svg" alt="" width={18} height={18} className="absolute" style={{ top: '35.92%', right: '30.92%', bottom: '3.13%', left: '31.79%' }} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
