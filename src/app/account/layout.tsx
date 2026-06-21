"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Navbar from "@/components/shop/Navbar"
import Footer from "@/components/shop/Footer"
import { User, MapPin, ShoppingBag, Heart, LogOut, Loader2 } from "lucide-react"
import { useCart } from "@/store/useCart"

// Customer account shell. Auth-gated at the client (server protection lands
// in proxy.ts when Phase 4 part 2 wires it up). The nav, gating, and signed-
// in chrome live here so each /account/* page can focus on its own panel.

const SECTIONS = [
  { href: '/account',           label: 'Overview',  icon: User },
  { href: '/account/orders',    label: 'Orders',    icon: ShoppingBag },
  { href: '/account/wishlist',  label: 'Wishlist',  icon: Heart },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/profile',   label: 'Profile',   icon: User },
]

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const clearCart = useCart((s) => s.clearCart)
  const [checking, setChecking] = useState(true)
  const [profileName, setProfileName] = useState<string>("")
  const [profileEmail, setProfileEmail] = useState<string>("")

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/')
        return
      }
      setProfileEmail(session.user.email ?? '')
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .maybeSingle()
      setProfileName(data?.full_name ?? '')
      setChecking(false)
    }
    check()
  }, [router])

  const signOut = async () => {
    await supabase.auth.signOut()
    clearCart()
    router.replace('/')
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fffdf7]">
        <Loader2 className="animate-spin text-primary-brown" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fffdf7] text-primary-brown">
      <Navbar />

      <main className="pb-20 pt-[clamp(122px,8.8vw,150px)]">
        <div className="mx-auto w-[min(1390px,calc(100%_-_32px))]">
          <div className="mb-8 rounded-[18px] border border-primary-brown/10 bg-accent-green/55 px-5 py-6 sm:px-8">
            <p className="ff-colville text-[15px] uppercase tracking-[0.12em] text-primary-brown/65">My account</p>
            <h1 className="ff-accia mt-2 text-[clamp(38px,5vw,72px)] leading-[0.95] text-primary-brown">
              {profileName ? `Welcome, ${profileName.split(' ')[0]}` : 'Your account'}
            </h1>
            <p className="ff-colville-light mt-3 text-[clamp(14px,1vw,16px)] text-primary-brown/70">
              {profileEmail}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="h-fit rounded-[16px] border border-primary-brown/10 bg-white/70 p-2 shadow-sm">
              {SECTIONS.map((s) => {
                const isActive = pathname === s.href || (s.href !== '/account' && pathname.startsWith(s.href))
                const Icon = s.icon
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className={`flex items-center gap-3 rounded-[10px] px-4 py-3 ff-colville text-[16px] transition-all ${
                      isActive
                        ? 'bg-primary-brown text-white'
                        : 'text-primary-brown/75 hover:bg-accent-green/55 hover:text-primary-brown'
                    }`}
                  >
                    <Icon size={16} />
                    {s.label}
                  </Link>
                )
              })}
              <button
                onClick={signOut}
                className="mt-2 flex w-full items-center gap-3 rounded-[10px] px-4 py-3 text-left ff-colville text-[16px] text-red-600 transition-all hover:bg-red-50"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </aside>

            <section className="min-w-0">{children}</section>
          </div>
        </div>

        <div className="mt-20">
          <Footer variant="flow" />
        </div>
      </main>
    </div>
  )
}
