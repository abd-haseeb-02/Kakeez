"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect } from "react"
import type { Session } from "@supabase/supabase-js"
import UserAuthPopup from "./UserAuthPopup"
import CartDrawer from "./CartDrawer"
import { useCart } from "@/store/useCart"
import { supabase } from "@/lib/supabase"
import { Menu, Search, ShieldAlert, LogOut, ShoppingCart, User as UserIcon, LayoutGrid, X } from "lucide-react"

export default function Navbar() {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [user, setUser] = useState<{ email: string | null; name: string } | null>(null)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const totalItems = useCart(state => state.totalItems())
  const clearCart = useCart(state => state.clearCart)

  const applySession = async (session: Session | null) => {
    if (session?.user) {
      setUser({
        email: session.user.email ?? null,
        name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Account",
      })
      // Phase 4: role-based admin gate via profiles, not hard-coded email.
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', session.user.id)
        .maybeSingle()
      if (profile?.full_name) {
        setUser((prev) => prev ? { ...prev, name: profile.full_name as string } : prev)
      }
      setIsAdmin(profile?.role === 'admin' || profile?.role === 'staff')
    } else {
      setUser(null)
      setIsAdmin(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))

    // Listen for auth changes — clear cart on sign-out so the next visitor
    // on a shared device doesn't inherit items.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearCart()
      }
      applySession(session)
    })

    return () => {
      subscription.unsubscribe()
    }
    // clearCart from zustand persist is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <nav className="absolute top-0 left-0 z-50 flex h-[76px] w-full items-center justify-between bg-white px-4 md:px-5 lg:h-[clamp(84px,6.9vw,118px)] lg:px-[clamp(20px,2.5vw,48px)]">
        
        {/* Mobile Menu Button */}
        <button
          type="button"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-[#936939] transition-colors hover:bg-[#936939]/10 lg:hidden"
        >
          {isMenuOpen ? <X className="h-6 w-6" strokeWidth={1.8} /> : <Menu className="h-6 w-6" strokeWidth={1.8} />}
        </button>

        {/* Left Links */}
        <div className="hidden items-center gap-[clamp(28px,4vw,76px)] ff-colville-medium text-[clamp(16px,1.1vw,21px)] text-[#936939] uppercase lg:flex">
          <Link href="/menu" className="hover:opacity-70 transition-opacity">Menu</Link>
          <Link href="/contact" className="hover:opacity-70 transition-opacity">Contact</Link>
          <Link href="/catering" className="hover:opacity-70 transition-opacity">Catering</Link>
        </div>

        {/* Central Logo */}
        <div className="absolute left-1/2 top-1/2 h-[72px] w-[52px] -translate-x-1/2 -translate-y-1/2 lg:h-[clamp(88px,6.2vw,112px)] lg:w-[clamp(62px,4.4vw,80px)]">
          <Link href="/" className="relative block h-full w-full hover:opacity-90 transition-opacity" aria-label="Kakeez home">
            <Image src="/assets/LOGO.png" alt="Kakeez" fill sizes="(max-width: 1024px) 52px, 80px" className="object-contain drop-shadow-sm" priority />
          </Link>
        </div>

        {/* Right Actions */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 lg:ml-0 lg:gap-[clamp(18px,2.1vw,40px)]">
          {isAdmin && (
            <Link 
              href="/admin" 
              className="hidden items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-full border border-red-200 ff-apfel text-sm font-bold hover:bg-red-100 transition-all shadow-sm whitespace-nowrap sm:flex"
            >
              <ShieldAlert size={14} />
              Admin
            </Link>
          )}

          <button
            type="button"
            aria-label="Search"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-[#936939] transition-colors hover:bg-[#936939]/10 sm:flex lg:h-11 lg:w-11"
          >
            <Search className="h-5 w-5 lg:h-[22px] lg:w-[22px]" strokeWidth={2} />
          </button>
          
          <div className="relative">
            <button
              type="button"
              aria-label={user ? "Open account menu" : "Sign in"}
              onClick={handleAccountClick}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#936939] transition-colors hover:bg-[#936939]/10 lg:h-11 lg:w-11"
            >
              <UserIcon className="h-5 w-5 lg:h-[22px] lg:w-[22px]" strokeWidth={1.8} />
            </button>

            {user && isAccountOpen && (
              <>
                <div className="fixed inset-0 z-[59]" onClick={() => setIsAccountOpen(false)} />
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-[60] w-[min(260px,80vw)] bg-white rounded-lg shadow-xl border border-primary-brown/10 overflow-hidden">
                  <div className="px-4 py-4 border-b border-primary-brown/10 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-brown/10 flex items-center justify-center text-primary-brown ff-accia">
                      <UserIcon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="ff-accia text-base text-primary-brown truncate leading-tight">{user.name}</p>
                      <p className="ff-apfel text-xs text-primary-brown/50 truncate">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setIsAccountOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-primary-brown hover:bg-primary-brown/5 transition-all ff-apfel text-sm border-b border-primary-brown/10"
                  >
                    <LayoutGrid size={15} /> My account
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-500 hover:bg-red-50 transition-all ff-apfel text-sm"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Cart Button wrapper */}
          <button
            type="button"
            aria-label="Open cart"
            onClick={() => setIsCartOpen(true)}
            className="relative flex h-11 w-12 items-center justify-center rounded-lg bg-[#936939] text-white transition-colors hover:bg-primary-brown/90 sm:w-14 lg:h-[50px] lg:w-[64px]"
          >
            <ShoppingCart className="h-[22px] w-[22px] lg:h-[25px] lg:w-[25px]" strokeWidth={2} />
            
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-[#936939] shadow-sm ff-apfel">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/15 lg:hidden" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute left-3 right-3 top-[84px] z-50 overflow-hidden rounded-[14px] border border-primary-brown/15 bg-white shadow-2xl lg:hidden">
            <div className="grid divide-y divide-primary-brown/10 ff-colville-medium text-[18px] uppercase text-[#936939]">
              <Link href="/menu" onClick={() => setIsMenuOpen(false)} className="px-5 py-4 transition-colors hover:bg-primary-brown/5">Menu</Link>
              <Link href="/contact" onClick={() => setIsMenuOpen(false)} className="px-5 py-4 transition-colors hover:bg-primary-brown/5">Contact</Link>
              <Link href="/catering" onClick={() => setIsMenuOpen(false)} className="px-5 py-4 transition-colors hover:bg-primary-brown/5">Catering</Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2 px-5 py-4 text-red-600 transition-colors hover:bg-red-50">
                  <ShieldAlert size={16} /> Admin
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
