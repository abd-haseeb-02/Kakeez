"use client"

import Image from "next/image"
import Navbar from "@/components/shop/Navbar"
import Hero from "@/components/shop/Hero"
import ProductCard from "@/components/shop/ProductCard"
import Footer from "@/components/shop/Footer"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

export default function Home() {
  const [categories, setCategories] = useState<any[]>([])
  const [productsByCategory, setProductsByCategory] = useState<Record<string, any[]>>({})
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      // Fetch categories
      const { data: catData } = await supabase.from('categories').select('*').order('name')
      if (catData) {
        // Enforce specific category order
        const desiredOrder = ["Simple Cakes", "Customized Cake", "Cookies", "Cup Cakes"]
        const orderedCategories = catData.sort((a, b) => {
          const indexA = desiredOrder.indexOf(a.name)
          const indexB = desiredOrder.indexOf(b.name)
          // If a category isn't in the list, put it at the end
          if (indexA === -1) return 1
          if (indexB === -1) return -1
          return indexA - indexB
        })

        setCategories(orderedCategories)
        if (orderedCategories.length > 0) setActiveCategory(orderedCategories[0].id)
        
        // Fetch products for each category and set initial pagination
        const productsMap: Record<string, any[]> = {}
        const initialCounts: Record<string, number> = {}
        for (const cat of orderedCategories) {
          const { data: prodData } = await supabase
            .from('products')
            .select('*')
            .eq('category_id', cat.id)
            .order('created_at', { ascending: false })
          
          if (prodData) {
            productsMap[cat.id] = prodData
          }
          initialCounts[cat.id] = 6 // Show 6 products initially per category
        }
        setProductsByCategory(productsMap)
        setVisibleCounts(initialCounts)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><Loader2 className="animate-spin text-primary-brown" size={40} /></div>
  }

  // Calculate layout dynamically to preserve the exact vw coordinates
  const leftPositions = ["8.1094vw", "36.8131vw", "65.5168vw"]
  
  let currentTop = 145; // Start position for first category title (below tabs)
  
  const categoryLayouts = categories.map((category) => {
    const allProducts = productsByCategory[category.id] || [];
    const visibleCount = visibleCounts[category.id] || 6;
    const products = allProducts.slice(0, visibleCount);
    const hasMore = allProducts.length > visibleCount;

    const titleTop = currentTop;
    const rowStartTop = titleTop + 6.77;
    
    const productPositions = products.map((product, index) => {
      const row = Math.floor(index / 3);
      const col = index % 3;
      return {
        ...product,
        left: leftPositions[col],
        top: rowStartTop + (row * 44.85)
      }
    });

    const numRows = Math.ceil(products.length / 3) || 1; // at least 1 row space
    let nextTop = rowStartTop + (numRows * 44.85);

    let buttonTop = null;
    if (hasMore) {
      buttonTop = nextTop + 2;
      nextTop += 10; // add space for the button before next category
    } else {
      nextTop += 7; // add standard gap before next category
    }

    currentTop = nextTop;

    return {
      category,
      titleTop,
      productPositions,
      hasMore,
      buttonTop
    }
  });

  const bottomTop = currentTop;

  // The green background needs to start at 122vw and go all the way down to bottomTop
  const greenBgHeight = bottomTop - 122.6852 + 10; // padding at the bottom

  return (
    <div className="frame bg-white">
      {/* Decorative Vectors - Bottom Layer */}
      <div className="absolute left-[-57.5231vw] top-[72.0341vw] w-[67.4527vw] h-[27.5701vw]" style={{ transform:'rotate(180deg) scaleY(-1)' }}>
        <Image src="/assets/vector15.svg" alt="" fill className="block w-full h-full" />
      </div>
      <div className="absolute left-[70.0914vw] top-[56.4387vw] w-[72.8486vw] h-[49.7782vw] flex items-center justify-center">
        <div className="w-[67.4527vw] h-[27.5701vw]" style={{ transform:'rotate(159.14deg) scaleY(-1)' }}>
          <Image src="/assets/vector16.svg" alt="" fill className="block w-full h-full" />
        </div>
      </div>

      <Navbar />
      <Hero />

      {/* Welcome Section */}
      <div className="absolute left-[8.1019vw] top-[73.5532vw] w-[23.6108vw] h-[31.2397vw] border-[0.1157vw] border-[#936939] border-solid rounded-[0.6944vw] overflow-hidden">
        <Image src="/assets/welcome-1.png" alt="" fill className="object-cover" />
      </div>
      <div className="absolute left-[68.2870vw] top-[77.9514vw] w-[23.6108vw] h-[31.2397vw] border-[0.1157vw] border-[#936939] border-solid rounded-[0.6944vw] overflow-hidden">
        <Image src="/assets/welcome-2.png" alt="" fill className="object-cover" />
      </div>
      <div className="absolute left-[64.1782vw] top-[71.7014vw] w-[10.7615vw] h-[10.7615vw] flex items-center justify-center">
        <div style={{ transform:'rotate(-4.86deg)' }}>
          <div className="w-[9.9537vw] h-[9.9537vw] border-[0.1234vw] border-[#936939] border-solid rounded-[4.9769vw] overflow-hidden relative">
            <Image src="/assets/badge-circle.png" alt="" fill className="object-cover" />
          </div>
        </div>
      </div>
      <div className="absolute left-[45.3125vw] top-[77.1042vw] w-[9.3188vw] -translate-x-1/2 ff-accia text-[0.8691vw] text-[#936939] text-center" style={{ left:'49.9716vw' }}>— WELCOME TO</div>
      <div className="absolute left-[49.9786vw] top-[78.5041vw] -translate-x-1/2 text-center tracking-[-0.0625vw] whitespace-nowrap leading-[3.3799vw]">
        <span className="ff-accia text-[3.1250vw] text-[#936939]">KAKEEZ</span><span className="ff-accia text-[3.1250vw] text-[#262729]"> Bakeshop</span>
      </div>
      <div className="absolute left-[36.1476vw] top-[84.3414vw] w-[27.6667vw] flex flex-col items-center gap-[0.8691vw] ff-accia text-[0.9259vw] text-[#262729] text-center tracking-[-0.0278vw] leading-[1.5188vw]">
        <p className="w-[25.9285vw]">At Kakeez, we believe every celebration deserves a centerpiece as delicious as it is beautiful.</p>
        <p className="w-[25.9285vw]">We specialize in custom, artisanal baking - from grand wedding cakes to rich, fudgy brownies. We pour our passion into every recipe to craft unforgettable memories, ensuring that truly, Every Bite Matters.</p>
      </div>
      <div className="absolute left-[44.5023vw] top-[98.1481vw] w-[10.9375vw] h-[2.8935vw] bg-white border-[0.1157vw] border-[#936939] border-solid rounded-[0.2894vw]"></div>
      <div className="absolute left-[49.9711vw] top-[98.9005vw] -translate-x-1/2 ff-accia text-[1.0417vw] text-[#936939] text-center uppercase tracking-[0.0208vw] whitespace-nowrap">Learn More</div>

      {/* Green Section Background (Now dynamically sized to cover all products) */}
      <div className="absolute left-[1.7361vw] top-[110.4167vw] w-[96.5278vw] h-[145.0231vw] bg-[#e1eab4] z-0"></div>
      <div className="absolute left-[1.7361vw] top-[110.8218vw] w-[96.5278vw] h-[26.1362vw] z-0">
        <Image src="/assets/union-drip.svg" alt="" fill className="block w-full h-full" />
      </div>
      <div className="absolute left-[1.7361vw] top-[122.6852vw] w-[96.5278vw] bg-[#e1eab4] rounded-bl-[2.0255vw] rounded-br-[2.0255vw] z-0" style={{ height: `${greenBgHeight}vw` }}></div>
      <div className="absolute left-[-21.9907vw] top-[108.0729vw] w-[134.4039vw] h-[23.0510vw] z-10 pointer-events-none">
        <Image src="/assets/vector13.svg" alt="" fill className="block w-full h-full" />
      </div>

      <div className="absolute left-[50.0000vw] top-[122.6852vw] -translate-x-1/2 ff-accia text-[3.7616vw] text-[#936939] text-center leading-[1.1] whitespace-nowrap z-20">Shop Best Sellers</div>
      
      {/* Dynamic Category Pills */}
      <div className="absolute left-[8.1vw] top-[134vw] flex items-center gap-[3vw] z-30 flex-wrap max-w-[80vw]">
        {categoryLayouts.map((layout) => {
          const isActive = activeCategory === layout.category.id;
          
          const handleScroll = () => {
            setActiveCategory(layout.category.id);
            const scrollTargetTop = layout.titleTop ? layout.titleTop - 5 : 130;
            window.scrollTo({ top: (scrollTargetTop * window.innerWidth) / 100, behavior: 'smooth' });
          }

          if (isActive) {
            return (
              <button key={layout.category.id} onClick={handleScroll} className="relative flex items-center gap-[1vw] bg-white rounded-full px-[2vw] h-[3.4vw] shrink-0 shadow-sm border border-primary-brown/10 hover:opacity-90 transition-all cursor-pointer">
                <div className="w-[1.6vw] h-[1.6vw] flex-shrink-0">
                  <Image src="/assets/cakes-icon.svg" alt="" width={100} height={100} className="w-full h-full object-contain" />
                </div>
                <span className="ff-colville text-[1.27vw] text-[#936939] underline decoration-solid tracking-[-0.0255vw] whitespace-nowrap uppercase">
                  {layout.category.name}
                </span>
              </button>
            )
          }
          
          return (
            <button key={layout.category.id} onClick={handleScroll} className="ff-colville text-[1.27vw] text-[#936939] underline decoration-solid tracking-[-0.0255vw] whitespace-nowrap uppercase hover:opacity-80 transition-opacity shrink-0 cursor-pointer">
              {layout.category.name}
            </button>
          )
        })}
      </div>

      {/* Dynamic Product Rows */}
      {categoryLayouts.map((layout) => (
        <div key={layout.category.id} className="z-20 relative">
          <div className="absolute -translate-x-1/2 ff-accia text-[3.7616vw] text-[#936939] text-center leading-[1.1] whitespace-nowrap uppercase z-20" style={{ left: '49.9711vw', top: `${layout.titleTop}vw` }}>
            {layout.category.name}
          </div>
          
          {layout.productPositions.map((product) => (
            <ProductCard 
              key={product.id}
              id={product.id} 
              name={product.name} 
              price={product.price}
              reviews={43}
              imageUrl={product.image_url}
              description={product.description}
              left={product.left} 
              top={`${product.top}vw`} 
              isBestSeller={product.is_best_seller}
              layoutType="buy-now" // Forces the dual button layout as requested earlier
            />
          ))}

          {/* View All Button for this category */}
          {layout.hasMore && layout.buttonTop && (
            <div 
              className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity z-30" 
              style={{ top: `${layout.buttonTop}vw` }} 
              onClick={() => setVisibleCounts(prev => ({ ...prev, [layout.category.id]: prev[layout.category.id] + 6 }))}
            >
              <div className="w-auto px-[2vw] h-[2.8935vw] bg-white border-[0.1157vw] border-[#936939] border-solid rounded-[0.2894vw] flex items-center justify-center">
                <span className="ff-accia text-[1.0417vw] text-[#936939] uppercase tracking-[0.0208vw] whitespace-nowrap">View More {layout.category.name}</span>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Promo Banners positioned dynamically below everything else */}
      <div className="absolute w-[40.7289vw] h-[31.8621vw] rounded-[0.9744vw] overflow-hidden z-20" style={{ left: '8.1019vw', top: `${bottomTop + 14.1}vw` }}>
        <Image src="/assets/banner-left.png" alt="" fill className="object-cover" />
      </div>
      <div className="absolute w-[40.7289vw] h-[31.8621vw] rounded-[0.9744vw] overflow-hidden z-20" style={{ left: '51.1696vw', top: `${bottomTop + 14.1}vw` }}>
        <Image src="/assets/banner-right.png" alt="" fill className="object-cover" />
      </div>
      <div className="absolute -translate-x-1/2 ff-apfel text-[2.3385vw] text-white text-center tracking-[-0.0468vw] whitespace-nowrap leading-[3.4103vw] z-30" style={{ left: '37.3819vw', top: `${bottomTop + 16.1}vw` }}>Bakery</div>
      <div className="absolute -translate-x-1/2 ff-apfel-satt text-[5.5539vw] text-white text-center tracking-[-0.1111vw] whitespace-nowrap leading-[6.1385vw] z-30" style={{ left: '37.3333vw', top: `${bottomTop + 19.5}vw` }}>Big Sale</div>
      <div className="absolute -translate-x-1/2 ff-colville text-[1.5590vw] text-white text-center tracking-[-0.0312vw] whitespace-nowrap leading-[1.5590vw] z-30" style={{ left: '37.3791vw', top: `${bottomTop + 31.8}vw` }}>Limited Time Offer</div>
      <div className="absolute w-[12.7156vw] h-[2.6795vw] z-30" style={{ left: '30.9994vw', top: `${bottomTop + 27.1}vw` }}>
        <Image src="/assets/badge-25.svg" alt="" width={220} height={46} className="block w-full h-full" />
      </div>
      <div className="absolute -translate-x-1/2 ff-apfel text-[1.9487vw] text-[#262729] text-center tracking-[-0.0390vw] leading-[2.1436vw] z-30" style={{ left: '37.3576vw', top: `${bottomTop + 27.4}vw` }}>25% OFF</div>
      <div className="absolute w-[6.0411vw] h-[6.0411vw] bg-[#936939] rounded-[3.0205vw] flex flex-col items-center justify-center z-30" style={{ left: '47.0284vw', top: `${bottomTop + 28.4}vw` }}>
        <p className="ff-apfel-fett text-[1.4855vw] text-white text-center leading-[1.3865vw] whitespace-nowrap">UP T0<br/>30%</p>
      </div>

      <div className="absolute -translate-x-1/2 ff-apfel text-[2.3385vw] text-white text-center tracking-[-0.0468vw] whitespace-nowrap leading-[3.4103vw] z-30" style={{ left: '79.9132vw', top: `${bottomTop + 16.1}vw` }}>Winter Sale</div>
      <div className="absolute -translate-x-1/2 ff-apfel-satt text-[5.5539vw] text-white text-center tracking-[-0.1111vw] whitespace-nowrap leading-[6.1385vw] z-30" style={{ left: '79.8889vw', top: `${bottomTop + 19.5}vw` }}>50% Off</div>
      <div className="absolute w-[9.9873vw] h-[3.0205vw] -translate-x-1/2 bg-[#e1eab4] rounded-[0.2436vw] flex items-center justify-center overflow-hidden z-30" style={{ left: '79.9132vw', top: `${bottomTop + 27.1}vw` }}>
        <span className="ff-accia text-[1.0417vw] text-black text-center uppercase tracking-[0.0208vw] whitespace-nowrap">Order now</span>
      </div>

      <div className="absolute -translate-x-1/2 ff-accia text-[3.1250vw] text-[#262729] text-center tracking-[-0.0625vw] whitespace-nowrap leading-[3.4103vw] z-20" style={{ left: '49.9711vw', top: `${bottomTop + 52.9}vw` }}>Follow @kakeezbakers</div>
      
      {/* Gallery Placeholders */}
      <div className="absolute w-[15.9797vw] h-[19.0003vw] rounded-[0.6944vw] bg-[#ece9e2] z-20 border border-primary-brown/10" style={{ left: '8.1019vw', top: `${bottomTop + 58.8}vw` }}></div>
      <div className="absolute w-[15.9797vw] h-[19.0003vw] rounded-[0.6944vw] bg-[#ece9e2] z-20 border border-primary-brown/10" style={{ left: '25.0561vw', top: `${bottomTop + 58.8}vw` }}></div>
      <div className="absolute w-[15.9797vw] h-[19.0003vw] rounded-[0.6944vw] bg-[#ece9e2] z-20 border border-primary-brown/10" style={{ left: '42.0098vw', top: `${bottomTop + 58.8}vw` }}></div>
      <div className="absolute w-[15.9797vw] h-[19.0003vw] rounded-[0.6944vw] bg-[#ece9e2] z-20 border border-primary-brown/10" style={{ left: '58.9641vw', top: `${bottomTop + 58.8}vw` }}></div>
      <div className="absolute w-[15.9797vw] h-[19.0003vw] rounded-[0.6944vw] bg-[#ece9e2] z-20 border border-primary-brown/10" style={{ left: '75.9184vw', top: `${bottomTop + 58.8}vw` }}></div>

      {/* Decorative Vectors - Top Layer */}
      <div className="absolute w-[67.4527vw] h-[27.5701vw] z-10 pointer-events-none" style={{ left: '-33.7384vw', top: `${bottomTop + 33.6}vw`, transform:'rotate(180deg) scaleY(-1)' }}>
        <Image src="/assets/vector15.svg" alt="" fill className="block w-full h-full" />
      </div>
      <div className="absolute w-[72.8486vw] h-[49.7782vw] flex items-center justify-center z-10 pointer-events-none" style={{ left: '70.0914vw', top: `${bottomTop + 22.5}vw` }}>
        <div className="w-[67.4527vw] h-[27.5701vw]" style={{ transform:'rotate(159.14deg) scaleY(-1)' }}>
          <Image src="/assets/vector16.svg" alt="" fill className="block w-full h-full" />
        </div>
      </div>
      <div className="absolute w-[96.5567vw] h-[23.0324vw] z-10 pointer-events-none" style={{ left: '1.7072vw', top: `${bottomTop - 3.6}vw` }}>
        <Image src="/assets/vector14.svg" alt="" fill className="block w-full h-full" />
      </div>

      {/* Adjust frame height manually using CSS for the dynamic length */}
      <style dangerouslySetInnerHTML={{__html: `
        body { background-color: #ffffff; }
        .frame { height: ${bottomTop + 106.3}vw !important; background-color: #ffffff; }
      `}} />
      <Footer topOffset={bottomTop + 83.3} />
    </div>
  )
}
