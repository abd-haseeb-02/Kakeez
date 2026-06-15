"use client"

import Link from "next/link"
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  Settings, 
  LogOut,
  ChevronRight,
  Menu,
  Loader2
} from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push("/admin/login")
      } else if (session.user.email !== "admin@kakeez.com") {
        // Not an admin user, boot them out
        await supabase.auth.signOut()
        router.push("/admin/login")
      } else {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/admin/login")
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
    { icon: Settings, label: "Settings", href: "/admin/settings" },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } bg-[#121212] border-r border-white/5 transition-all duration-300 flex flex-col`}
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && <span className="ff-accia text-xl font-bold text-primary-brown">KAKEEZ ADMIN</span>}
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-lg">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {menuItems.map((item) => (
            <Link 
              key={item.label}
              href={item.href}
              className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl group transition-all"
            >
              <item.icon size={20} className="text-primary-brown" />
              {isSidebarOpen && <span className="ff-apfel text-sm">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button className="w-full flex items-center gap-4 p-3 hover:bg-red-500/10 text-red-400 rounded-xl transition-all">
            <LogOut size={20} />
            {isSidebarOpen && <span className="ff-apfel text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between bg-[#0a0a0a]/50 backdrop-blur-xl sticky top-0 z-10">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <span className="ff-apfel">Admin</span>
            <ChevronRight size={14} />
            <span className="text-white ff-apfel">Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary-brown flex items-center justify-center font-bold">
              A
            </div>
          </div>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
