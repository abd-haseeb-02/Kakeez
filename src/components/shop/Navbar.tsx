"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import UserAuthPopup from "./UserAuthPopup"
import CartDrawer from "./CartDrawer"
import { useCart } from "@/store/useCart"
import { supabase } from "@/lib/supabase"
import { ShieldAlert } from "lucide-react"

export default function Navbar() {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const totalItems = useCart(state => state.totalItems())

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email === "admin@kakeez.com") {
        setIsAdmin(true)
      }
    }
    checkAdmin()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email === "admin@kakeez.com") {
        setIsAdmin(true)
      } else {
        setIsAdmin(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <>
      <UserAuthPopup isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Structured Flexbox Navbar for perfect vertical alignment and equal padding */}
      <nav className="absolute top-0 left-0 w-full z-50 flex items-center justify-between px-[8.1vw] py-[0.6vw]">
        
        {/* Left Links */}
        <div className="flex items-center gap-[4vw] ff-colville-medium text-[1.1574vw] text-[#936939] uppercase">
          <Link href="/menu" className="hover:opacity-70 transition-opacity">Menu</Link>
          <Link href="/contact" className="hover:opacity-70 transition-opacity">Contact</Link>
          <Link href="/catering" className="hover:opacity-70 transition-opacity">Catering</Link>
        </div>

        {/* Central Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 w-[6vw] h-[6vw] cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center">
          <Link href="/">
             <Image src="/assets/LOGO.png" alt="Kakeez" fill className="object-contain drop-shadow-sm" priority />
          </Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-[2.5vw]">
          {isAdmin && (
            <Link 
              href="/admin" 
              className="flex items-center gap-[0.5vw] bg-red-50 text-red-600 px-[1vw] py-[0.5vw] rounded-full border border-red-200 ff-apfel text-[0.9vw] font-bold hover:bg-red-100 transition-all shadow-sm whitespace-nowrap"
            >
              <ShieldAlert size={14} />
              Admin
            </Link>
          )}

          <div className="w-[1.3310vw] h-[1.3310vw] cursor-pointer hover:opacity-70 transition-opacity flex items-center justify-center">
            <Image src="/assets/icon-search.svg" alt="search" width={23} height={23} className="w-full h-full" />
          </div>
          
          <div 
            onClick={() => setIsAuthOpen(true)}
            className="w-[1.3310vw] h-[1.3310vw] cursor-pointer hover:opacity-70 transition-opacity flex items-center justify-center"
          >
            <Image src="/assets/icon-person.svg" alt="account" width={23} height={23} className="w-full h-full" />
          </div>

          {/* Cart Button wrapper */}
          <div 
            onClick={() => setIsCartOpen(true)}
            className="relative w-[3.3565vw] h-[2.6042vw] bg-[#936939] rounded-[0.5787vw] cursor-pointer hover:bg-primary-brown/90 transition-all flex items-center justify-center"
          >
            <div className="w-[1.3310vw] h-[1.3310vw]">
               <Image src="/assets/icon-cart.svg" alt="cart" width={23} height={23} className="w-full h-full brightness-0 invert" />
            </div>
            
            {totalItems > 0 && (
              <span className="absolute -top-[0.5vw] -right-[0.5vw] bg-white text-[#936939] text-[0.7vw] font-bold w-[1.2vw] h-[1.2vw] rounded-full flex items-center justify-center ff-apfel shadow-sm">
                {totalItems}
              </span>
            )}
          </div>
        </div>
      </nav>
    </>
  )
}
