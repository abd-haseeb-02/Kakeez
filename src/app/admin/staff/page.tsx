"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/Toast"
import {
  Loader2, Search, ShieldCheck, ShieldAlert, User as UserIcon,
  Ban, RotateCcw, Mail, Phone, Clock,
} from "lucide-react"

interface UserRow {
  id: string
  email: string
  role: 'customer' | 'staff' | 'admin'
  full_name: string | null
  phone_e164: string | null
  cod_trust_level: string
  no_show_count: number
  blocked_at: string | null
  blocked_reason: string | null
  email_confirmed_at: string | null
  last_sign_in_at: string | null
  created_at: string
}

const ROLE_OPTIONS: { value: UserRow['role']; label: string; tone: string }[] = [
  { value: 'admin',    label: 'Admin',    tone: 'bg-red-500/15 text-red-300 border-red-500/30' },
  { value: 'staff',    label: 'Staff',    tone: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { value: 'customer', label: 'Customer', tone: 'bg-white/5 text-white/60 border-white/10' },
]

export default function StaffPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [savingId, setSavingId] = useState<string>("")
  const [self, setSelf] = useState<string>("")
  const toast = useToast()

  const load = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    setSelf(session?.user.id ?? "")
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) {
      toast.push({ kind: 'warn', title: 'Could not load users', body: error.message })
    } else {
      setUsers((data as UserRow[]) ?? [])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const setRole = async (id: string, newRole: UserRow['role']) => {
    setSavingId(id)
    const { error } = await supabase.rpc('set_profile_role', { p_user_id: id, p_new_role: newRole })
    setSavingId("")
    if (error) {
      const code = error.message?.split(':')[0]?.trim() ?? error.message
      const friendly = code === 'cannot_demote_last_admin'
        ? 'There must be at least one admin. Promote someone else first.'
        : code === 'invalid_role'
          ? 'That role value is not allowed.'
          : (error.message ?? 'Unknown error')
      toast.push({ kind: 'warn', title: 'Could not change role', body: friendly })
      return
    }
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u))
    toast.push({ kind: 'success', title: `Role updated`, body: `${newRole}` })
  }

  const toggleBlocked = async (u: UserRow) => {
    const next = !u.blocked_at
    let reason: string | null = null
    if (next) {
      const r = window.prompt('Why are you blocking this user? (will be visible in /admin/staff only)')
      if (r === null) return  // cancelled
      reason = r.trim() || null
    }
    setSavingId(u.id)
    const { error } = await supabase.rpc('admin_set_user_blocked', { p_user_id: u.id, p_blocked: next, p_reason: reason })
    setSavingId("")
    if (error) {
      toast.push({ kind: 'warn', title: 'Could not change block state', body: error.message ?? 'Unknown error' })
      return
    }
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, blocked_at: next ? new Date().toISOString() : null, blocked_reason: next ? reason : null } : x))
    toast.push({ kind: next ? 'warn' : 'success', title: next ? 'User blocked' : 'User unblocked' })
  }

  const filtered = users.filter((u) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.phone_e164 ?? '').toLowerCase().includes(q)
    )
  })

  const counts = users.reduce(
    (acc, u) => { acc[u.role] = (acc[u.role] ?? 0) + 1; return acc },
    { admin: 0, staff: 0, customer: 0 } as Record<string, number>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <p className="admin-pill mb-3 inline-flex rounded-full px-3 py-1 ff-apfel text-[11px] uppercase tracking-[0.16em]">Access control</p>
          <h1 className="text-3xl font-bold ff-accia text-primary-brown">Users &amp; Roles</h1>
          <p className="text-white/50 ff-apfel mt-1">{counts.admin} admin · {counts.staff} staff · {counts.customer} customer</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 w-full sm:w-[320px]">
          <Search size={14} className="text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email, name, phone…"
            className="bg-transparent outline-none ff-apfel text-sm text-white placeholder:text-white/30 w-full"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary-brown" size={32} /></div>
      ) : (
        <div className="admin-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-white/30 text-xs uppercase tracking-wider ff-apfel border-b border-white/5">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">COD trust</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((u) => (
                  <tr key={u.id} className={`hover:bg-white/5 transition-all ${u.blocked_at ? 'bg-red-500/5' : ''}`}>
                    <td className="px-6 py-4 min-w-[260px]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-brown/20 flex items-center justify-center ff-accia text-primary-brown">
                          {(u.full_name?.[0] ?? u.email[0] ?? '?').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="ff-apfel text-sm text-white truncate">
                            {u.full_name ?? <span className="text-white/40 italic">no name</span>}
                            {u.id === self && <span className="ml-2 text-[10px] uppercase tracking-widest bg-primary-brown/30 text-primary-brown px-1.5 py-0.5 rounded">you</span>}
                          </p>
                          <p className="ff-apfel text-xs text-white/40 truncate flex items-center gap-1.5"><Mail size={10} /> {u.email}</p>
                          {u.phone_e164 && <p className="ff-apfel text-xs text-white/30 flex items-center gap-1.5"><Phone size={10} /> {u.phone_e164}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.role}
                        disabled={savingId === u.id}
                        onChange={(e) => setRole(u.id, e.target.value as UserRow['role'])}
                        className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs ff-apfel text-white outline-none focus:border-primary-brown transition-all disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className="ff-apfel text-xs text-white/60 capitalize">{u.cod_trust_level}</span>
                      {u.no_show_count > 0 && (
                        <span className="ml-2 ff-apfel text-[10px] uppercase tracking-widest bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded">{u.no_show_count} no-show{u.no_show_count > 1 ? 's' : ''}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.blocked_at ? (
                        <div className="flex items-center gap-2">
                          <Ban size={14} className="text-red-400" />
                          <div>
                            <p className="ff-apfel text-xs text-red-300">Blocked</p>
                            {u.blocked_reason && <p className="ff-apfel text-[10px] text-white/40 italic">{u.blocked_reason}</p>}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {u.role === 'admin'
                            ? <ShieldCheck size={14} className="text-red-300" />
                            : u.role === 'staff'
                              ? <ShieldAlert size={14} className="text-amber-300" />
                              : <UserIcon size={14} className="text-white/40" />}
                          <span className="ff-apfel text-xs text-white/50 flex items-center gap-1.5">
                            {u.last_sign_in_at ? <><Clock size={10} /> {new Date(u.last_sign_in_at).toLocaleDateString()}</> : 'never signed in'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleBlocked(u)}
                        disabled={savingId === u.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ff-apfel text-xs transition-all ${
                          u.blocked_at
                            ? 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                            : 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/30'
                        }`}
                      >
                        {u.blocked_at ? <><RotateCcw size={12} /> Unblock</> : <><Ban size={12} /> Block</>}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center ff-apfel text-sm text-white/40">No users match the filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
