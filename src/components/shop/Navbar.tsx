"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import UserAuthPopup from "./UserAuthPopup"
import CartDrawer from "./CartDrawer"
import { useCart } from "@/store/useCart"
import { supabase } from "@/lib/supabase"
import { ShieldAlert, LogOut, User as UserIcon } from "lucide-react"

export default function Navbar() {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [user, setUser] = useState<{ email: string | null; name: string } | null>(null)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const totalItems = useCart(state => state.totalItems())

  const applySession = (session: any) => {
    if (session?.user) {
      setUser({
        email: session.user.email ?? null,
        name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Account",
      })
      setIsAdmin(session.user.email === "admin@kakeez.com")
    } else {
      setUser(null)
      setIsAdmin(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAccountOpen(false)
  }

  const handleAccountClick = () => {
    if (user) {
      setIsAccountOpen((o) => !o)
    } else {
      setIsAuthOpen(true)
    }
  }

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
          
          <div className="relative">
            <div
              onClick={handleAccountClick}
              className="w-[1.3310vw] h-[1.3310vw] cursor-pointer hover:opacity-70 transition-opacity flex items-center justify-center"
            >
              <Image src="/assets/icon-person.svg" alt="account" width={23} height={23} className="w-full h-full" />
            </div>

            {user && isAccountOpen && (
              <>
                <div className="fixed inset-0 z-[59]" onClick={() => setIsAccountOpen(false)} />
                <div className="absolute right-0 top-[2.2vw] z-[60] w-[16vw] min-w-[200px] bg-white rounded-[0.8vw] shadow-xl border border-primary-brown/10 overflow-hidden">
                  <div className="px-[1.2vw] py-[1vw] border-b border-primary-brown/10 flex items-center gap-[0.6vw]">
                    <div className="w-[2vw] h-[2vw] min-w-[28px] min-h-[28px] rounded-full bg-primary-brown/10 flex items-center justify-center text-primary-brown ff-accia">
                      <UserIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="ff-accia text-[0.95vw] text-primary-brown truncate leading-tight">{user.name}</p>
                      <p className="ff-apfel text-[0.75vw] text-primary-brown/50 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-[0.6vw] px-[1.2vw] py-[0.9vw] text-left text-red-500 hover:bg-red-50 transition-all ff-apfel text-[0.85vw]"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </>
            )}
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
