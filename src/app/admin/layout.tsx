"use client"

import Link from "next/link"
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Menu,
  Loader2,
  Sparkles,
} from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { usePathname, useRouter } from "next/navigation"
import { ToastProvider } from "@/components/ui/Toast"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === "/admin/login"

  useEffect(() => {
    if (isLoginPage) {
      return
    }

    // Phase 0+ moved the admin gate from hard-coded email to role-based:
    // a profiles row with role='admin' (or 'staff') is the source of truth.
    // RLS protects writes regardless, but bouncing non-admins out at the
    // shell level avoids confusing "permission denied" errors deeper in.
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/admin/login")
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()
      const role = profile?.role ?? 'customer'
      if (role !== 'admin' && role !== 'staff') {
        await supabase.auth.signOut()
        router.push("/admin/login")
        return
      }
      setLoading(false)
    }
    checkAuth()
  }, [isLoginPage, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  if (isLoginPage) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-brown" size={40} />
      </div>
    )
  }

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin" },
    { icon: Package, label: "Products", href: "/admin/products" },
    { icon: ShoppingBag, label: "Orders", href: "/admin/orders" },
    { icon: Users, label: "Customers", href: "/admin/customers" },
    { icon: ShieldCheck, label: "Staff & Roles", href: "/admin/staff" },
    { icon: Settings, label: "Settings", href: "/admin/settings" },
  ]

  return (
    <ToastProvider>
    <div className="admin-modern">
    <div className="admin-shell overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } admin-sidebar transition-all duration-300 flex flex-col`}
      >
        <div className="p-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="admin-brand-mark ff-accia">K</div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <span className="ff-accia block text-xl font-bold text-primary-brown leading-none">Kakeez</span>
                <span className="ff-apfel text-[11px] uppercase tracking-[0.18em] text-white/35">Admin studio</span>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {menuItems.map((item) => (
            <Link 
              key={item.label}
              href={item.href}
              className={`admin-nav-link ${pathname === item.href ? "admin-nav-link-active" : ""} flex items-center gap-4 p-3 rounded-xl group transition-all`}
              title={item.label}
            >
              <item.icon size={20} className={pathname === item.href ? "text-primary-brown" : "text-white/45 group-hover:text-primary-brown"} />
              {isSidebarOpen && <span className="ff-apfel text-sm">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-3">
          {isSidebarOpen && (
            <div className="admin-pill rounded-xl px-3 py-3">
              <div className="flex items-center gap-2 ff-apfel text-[11px] uppercase tracking-[0.12em]">
                <Sparkles size={13} />
                Live operations
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-4 p-3 hover:bg-red-500/10 text-red-300 rounded-xl transition-all">
            <LogOut size={20} />
            {isSidebarOpen && <span className="ff-apfel text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main overflow-y-auto">
        <header className="admin-topbar h-20 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <span className="ff-apfel">Admin</span>
            <ChevronRight size={14} />
            <span className="text-white ff-apfel">{menuItems.find((item) => item.href === pathname)?.label ?? "Dashboard"}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 ff-apfel text-xs text-white/60">
              <span className="h-2 w-2 rounded-full bg-[#b8d87c]" />
              Secure session
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-brown flex items-center justify-center font-bold shadow-lg shadow-black/20">
              A
            </div>
          </div>
        </header>

        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
    </div>
    </ToastProvider>
  )
}
