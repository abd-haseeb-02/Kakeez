"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { Bell, CheckCircle, AlertTriangle, X } from "lucide-react"

// Global toast primitive. Used by /admin (dashboard) AND /admin/orders to
// announce new orders + status changes — replaces the bespoke top-right
// banner on the dashboard.
//
// Simple by design: one provider at the admin layout root, stack of toasts
// auto-dismissing after 6 s. No animation framework; lightweight CSS
// transitions. Toast colour palette matches the admin's dark theme.

export type ToastKind = 'info' | 'success' | 'warn'

export interface ToastInput {
  kind?: ToastKind
  title: string
  body?: string
  durationMs?: number
}

interface ToastEntry extends ToastInput {
  id: number
  kind: ToastKind
  expiresAt: number
}

interface ToastContextValue {
  push: (t: ToastInput) => void
}

const ToastCtx = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx)
  if (!ctx) {
    // Safe no-op so non-admin pages don't crash if they ever import this.
    return { push: () => {} }
  }
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const push = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random()
    const dur = t.durationMs ?? 6000
    setToasts((prev) => [
      ...prev,
      { id, kind: t.kind ?? 'info', title: t.title, body: t.body, durationMs: dur, expiresAt: Date.now() + dur },
    ])
  }, [])

  // Auto-dismiss expired toasts.
  useEffect(() => {
    if (toasts.length === 0) return
    const id = setInterval(() => {
      const now = Date.now()
      setToasts((prev) => prev.filter((t) => t.expiresAt > now))
    }, 500)
    return () => clearInterval(id)
  }, [toasts.length])

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed top-24 right-8 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-2xl shadow-2xl border backdrop-blur-md flex items-start gap-3 px-5 py-4 ff-apfel animate-in slide-in-from-right duration-300 ${
              t.kind === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                : t.kind === 'warn'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                  : 'bg-primary-brown/95 border-white/10 text-white'
            }`}
            role="status"
            aria-live="polite"
          >
            <div className="shrink-0 mt-0.5">
              {t.kind === 'success' ? <CheckCircle size={18} />
                : t.kind === 'warn' ? <AlertTriangle size={18} />
                : <Bell size={18} className="animate-pulse" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold leading-tight">{t.title}</p>
              {t.body && <p className="text-xs opacity-80 mt-1 leading-snug">{t.body}</p>}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
