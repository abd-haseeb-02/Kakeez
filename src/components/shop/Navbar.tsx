"use client"

import Image from "next/image"
import Link from "next/link"
import { useState, useEffect, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import type { Session } from "@supabase/supabase-js"
import UserAuthPopup, { type AuthReason } from "./UserAuthPopup"
import CartDrawer from "./CartDrawer"
import SearchDialog from "./SearchDialog"
import { useCart, useCartDrawer } from "@/store/useCart"
import { supabase } from "@/lib/supabase"
import { Menu, Search, ShieldAlert, LogOut, ShoppingCart, User as UserIcon, LayoutGrid, X } from "lucide-react"

// src/proxy.ts sends signed-out visitors of a gated route to "/" with the
// destination in `?next=`. Nothing acted on it, so the customer simply found
// themselves on the homepage with no idea why. These turn that path back into
// the sentence "Sign in to …".
function reasonForNext(next: string | null): AuthReason | undefined {
  if (!next) return undefined
  if (next.startsWith('/checkout')) {
    return { action: 'finish checking out', detail: 'Your cart is saved — you will come straight back to it.' }
  }
  if (next.startsWith('/account/orders')) {
    return { action: 'see your orders', detail: 'Order history lives on your account.' }
  }
  if (next.startsWith('/account/wishlist')) {
    return { action: 'open your wishlist', detail: 'Your wishlist is tied to your account, so it follows you between devices.' }
  }
  if (next.startsWith('/account/addresses')) {
    return { action: 'manage your saved addresses' }
  }
  if (next.startsWith('/account')) {
    return { action: 'open your account' }
  }
  return undefined
}

export default function Navbar() {
  const router = useRouter()
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  // Dismissing the redirect prompt is the only state needed: whether to SHOW it
  // is derived, so nothing has to be set from an effect (which this repo lints
  // against). Same useSyncExternalStore trick as the cart badge below — the
  // server snapshot is null, so SSR and the hydration pass agree.
  const [redirectPromptDismissed, setRedirectPromptDismissed] = useState(false)
  const pendingNext = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get('next'),
    () => null
  )
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [user, setUser] = useState<{ email: string | null; name: string } | null>(null)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  // The cart is persisted to localStorage, which the server cannot see. Reading
  // it straight through `useCart(...)` meant the server rendered no badge while
  // a returning customer's first client render drew one — a hydration mismatch
  // on every page load with a non-empty cart.
  //
  // useSyncExternalStore fixes it at the source: `getServerSnapshot` (the third
  // argument) is what React uses for SSR *and* for the hydration pass, so the
  // first client render always matches the server at 0, then re-renders with
  // the real count once hydration is done. No mounted flag, so no clash with
  // the react-hooks/set-state-in-effect rule this repo enforces.
  const totalItems = useSyncExternalStore(
    useCart.subscribe,
    () => useCart.getState().items.reduce((sum, item) => sum + item.quantity, 0),
    () => 0
  )
  const clearCart = useCart(state => state.clearCart)
  // Shared so any page can open the cart — see src/store/useCart.ts.
  const isCartOpen = useCartDrawer(state => state.isOpen)
  const openCart = useCartDrawer(state => state.open)
  const closeCart = useCartDrawer(state => state.close)

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

  const redirectReason = !user && !redirectPromptDismissed ? reasonForNext(pendingNext) : undefined
  const authPopupOpen = isAuthOpen || !!redirectReason

  return (
    <>
      <UserAuthPopup
        isOpen={authPopupOpen}
        reason={redirectReason}
        onClose={() => {
          setIsAuthOpen(false)
          setRedirectPromptDismissed(true)
        }}
        onSuccess={() => {
          setIsAuthOpen(false)
          setRedirectPromptDismissed(true)
          // Take them where they were headed before the gate.
          if (pendingNext) router.push(pendingNext)
        }}
      />
      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
      {/* Mounted only while open so each search starts from a clean slate. */}
      {isSearchOpen && <SearchDialog onClose={() => setIsSearchOpen(false)} />}

      <nav className="absolute top-0 left-0 z-50 flex h-[var(--nav-h)] w-full items-center justify-between bg-white px-4 md:px-5 lg:px-[clamp(20px,2.5vw,48px)]">
        
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
        <div className="hidden items-center gap-[clamp(24px,2.3vw,40px)] ff-colville-medium text-[clamp(15px,1vw,18px)] tracking-[0.04em] text-[#936939] uppercase lg:flex">
          <Link href="/#menu" className="hover:opacity-70 transition-opacity">Menu</Link>
          <Link href="/about" className="hover:opacity-70 transition-opacity">About</Link>
          <Link href="/about#contact" className="hover:opacity-70 transition-opacity">Contact</Link>
        </div>

        {/* Central Logo */}
        <div className="absolute left-1/2 top-1/2 h-[var(--nav-logo-h)] w-[var(--nav-logo-w)] -translate-x-1/2 -translate-y-1/2">
          <Link href="/" className="relative block h-full w-full hover:opacity-90 transition-opacity" aria-label="Kakeez home">
            <Image src="/assets/LOGO.png" alt="Kakeez" fill sizes="(max-width: 1024px) 52px, 80px" className="object-contain drop-shadow-sm" priority />
          </Link>
        </div>

        {/* Right Actions */}
        <div className="ml-auto flex items-center gap-1 sm:gap-1.5 lg:ml-0 lg:gap-2">
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
            onClick={() => setIsSearchOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#936939] transition-colors hover:bg-[#936939]/10 lg:h-[42px] lg:w-[42px]"
          >
            <Search className="h-5 w-5 lg:h-[21px] lg:w-[21px]" strokeWidth={2} />
          </button>
          
          <div className="relative">
            <button
              type="button"
              aria-label={user ? "Open account menu" : "Sign in"}
              onClick={handleAccountClick}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#936939] transition-colors hover:bg-[#936939]/10 lg:h-[42px] lg:w-[42px]"
            >
              <UserIcon className="h-5 w-5 lg:h-[21px] lg:w-[21px]" strokeWidth={1.8} />
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
            onClick={openCart}
            className="relative flex h-10 w-[46px] items-center justify-center rounded-xl bg-[#936939] text-white transition-colors hover:bg-primary-brown/90 lg:h-[42px] lg:w-[54px]"
          >
            <ShoppingCart className="h-5 w-5 lg:h-[21px] lg:w-[21px]" strokeWidth={2} />
            
            {totalItems > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-[#936939]/15 bg-white px-1 text-[11px] font-bold leading-none text-[#936939] shadow-sm ff-apfel">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/15 lg:hidden" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute left-3 right-3 top-[calc(var(--nav-h)+8px)] z-50 overflow-hidden rounded-[14px] border border-primary-brown/15 bg-white shadow-2xl lg:hidden">
            <div className="grid divide-y divide-primary-brown/10 ff-colville-medium text-[18px] uppercase text-[#936939]">
              <Link href="/#menu" onClick={() => setIsMenuOpen(false)} className="px-5 py-4 transition-colors hover:bg-primary-brown/5">Menu</Link>
              <Link href="/about" onClick={() => setIsMenuOpen(false)} className="px-5 py-4 transition-colors hover:bg-primary-brown/5">About</Link>
              <Link href="/about#contact" onClick={() => setIsMenuOpen(false)} className="px-5 py-4 transition-colors hover:bg-primary-brown/5">Contact</Link>
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
