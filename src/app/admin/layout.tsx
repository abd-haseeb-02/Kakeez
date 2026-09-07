"use client"

import Link from "next/link"
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Settings,
  FolderTree,
  ShieldCheck,
  Tag,
  Star,
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
  const [role, setRole] = useState<'admin' | 'staff'>('admin')
  const [loadError, setLoadError] = useState<string>("")
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
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle()
      // A failed lookup used to be read as role='customer', which signed a
      // legitimate admin straight back out. Surface it instead of guessing.
      if (error) {
        setLoadError(error.message)
        setLoading(false)
        return
      }
      const nextRole = profile?.role ?? 'customer'
      if (nextRole !== 'admin' && nextRole !== 'staff') {
        await supabase.auth.signOut()
        router.push("/admin/login")
        return
      }
      setRole(nextRole)
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

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="ff-accia text-xl text-white">Could not verify your access</p>
          <p className="ff-apfel mt-2 text-sm text-red-200/80">{loadError}</p>
          <button onClick={() => location.reload()} className="mt-5 rounded-xl bg-primary-brown px-5 py-2.5 ff-apfel font-bold text-white">
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Catalog, coupons, staff and settings writes are all is_admin()-gated in the
  // database. Showing them to a staff user produced raw RLS errors deeper in
  // (and, for image upload, an orphaned file in the bucket), so the nav is
  // scoped to what each role can actually use.
  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/admin", adminOnly: false },
    { icon: Package, label: "Products", href: "/admin/products", adminOnly: true },
    { icon: FolderTree, label: "Catalog", href: "/admin/catalog", adminOnly: true },
    { icon: ShoppingBag, label: "Orders", href: "/admin/orders", adminOnly: false },
    { icon: Tag, label: "Coupons", href: "/admin/coupons", adminOnly: true },
    { icon: Star, label: "Reviews", href: "/admin/reviews", adminOnly: false },
    { icon: Users, label: "Customers", href: "/admin/customers", adminOnly: false },
    { icon: ShieldCheck, label: "Staff & Roles", href: "/admin/staff", adminOnly: true },
    { icon: Settings, label: "Settings", href: "/admin/settings", adminOnly: true },
  ].filter((item) => role === 'admin' || !item.adminOnly)

  const currentItem = menuItems.find((item) => item.href === pathname)
  // Deep-linking to an admin-only page as staff: say so rather than letting the
  // page fail with a permission error.
  const blockedForStaff = role !== 'admin' && !currentItem && pathname !== '/admin'

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
            <span className="text-white ff-apfel">{currentItem?.label ?? "Dashboard"}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 ff-apfel text-xs text-white/60">
              <span className="h-2 w-2 rounded-full bg-[#b8d87c]" />
              Signed in as {role}
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-brown flex items-center justify-center font-bold shadow-lg shadow-black/20 uppercase">
              {role.charAt(0)}
            </div>
          </div>
        </header>

        <div className="admin-content">
          {blockedForStaff ? (
            <div className="admin-card mx-auto max-w-xl rounded-3xl p-10 text-center">
              <ShieldCheck className="mx-auto mb-4 text-primary-brown" size={40} />
              <h2 className="ff-accia text-2xl text-white">Admin access required</h2>
              <p className="ff-apfel mt-2 text-sm text-white/50">
                This section is limited to admin accounts. Your staff account can work on orders,
                reviews and customers.
              </p>
              <Link href="/admin" className="mt-6 inline-flex rounded-2xl bg-primary-brown px-6 py-3 ff-apfel font-bold text-white transition-all hover:bg-primary-brown/90">
                Back to dashboard
              </Link>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
    </div>
    </ToastProvider>
  )
}
