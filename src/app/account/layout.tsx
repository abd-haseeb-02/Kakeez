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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-brown" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-[clamp(122px,8.8vw,150px)] pb-20">
        <div className="mx-auto w-[min(1180px,calc(100vw-40px))]">
          <div className="mb-8">
            <h1 className="ff-accia text-[clamp(34px,3vw,48px)] text-primary-brown leading-[1.02]">
              {profileName ? `Welcome, ${profileName.split(' ')[0]}` : 'Your account'}
            </h1>
            <p className="ff-accia-light text-[clamp(13px,0.95vw,15px)] text-black/50 mt-1">
              {profileEmail}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-[220px_1fr]">
            <aside className="space-y-1">
              {SECTIONS.map((s) => {
                const isActive = pathname === s.href || (s.href !== '/account' && pathname.startsWith(s.href))
                const Icon = s.icon
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2.5 ff-apfel text-sm transition-all ${
                      isActive
                        ? 'bg-primary-brown text-white'
                        : 'text-black/70 hover:bg-primary-brown/5'
                    }`}
                  >
                    <Icon size={16} />
                    {s.label}
                  </Link>
                )
              })}
              <button
                onClick={signOut}
                className="flex items-center gap-3 rounded-lg px-4 py-2.5 ff-apfel text-sm transition-all text-red-500 hover:bg-red-50 w-full text-left mt-4"
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
