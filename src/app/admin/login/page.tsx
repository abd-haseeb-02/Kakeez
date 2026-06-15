"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Loader2, Lock } from "lucide-react"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError("Invalid credentials. Please try again.")
      setLoading(false)
    } else {
      router.push("/admin")
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 bg-[#121212] border border-white/5 p-10 rounded-3xl shadow-2xl">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary-brown/10 rounded-2xl flex items-center justify-center mb-6">
            <Lock className="text-primary-brown" size={32} />
          </div>
          <h1 className="text-3xl font-bold ff-accia text-primary-brown">Admin Login</h1>
          <p className="text-white/50 ff-apfel mt-2">Secure access to KAKEEZ dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl text-sm ff-apfel text-center">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/50 mb-2 ff-apfel ml-1">Email Address</label>
              <input 
                required
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-primary-brown transition-all text-white"
                placeholder="admin@kakeez.com"
              />
            </div>
            <div>
              <label className="block text-sm text-white/50 mb-2 ff-apfel ml-1">Password</label>
              <input 
                required
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 outline-none focus:border-primary-brown transition-all text-white"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-primary-brown text-white px-6 py-4 rounded-2xl hover:bg-primary-brown/90 transition-all ff-apfel font-bold flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Access Dashboard"}
          </button>
        </form>
      </div>
    </div>
  )
}
