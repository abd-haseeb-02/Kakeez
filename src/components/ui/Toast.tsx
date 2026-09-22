"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { Bell, CheckCircle, AlertTriangle, X } from "lucide-react"

// Global toast primitive, shared by the storefront and /admin.
//
// The two skins are deliberately separate. The original palette was built for
// the admin's dark chrome — tints like `bg-emerald-500/15` with
// `text-emerald-200` — and when the provider was mounted on the storefront that
// same pale-green-on-pale-green landed over a cream page and was effectively
// invisible. The shop skin is an opaque white card with ink text and a coloured
// spine, which holds up over white, cream and the accent-green panels alike.
//
// It has to be a prop rather than a CSS-scoped override: the admin layout mounts
// <ToastProvider> *outside* its `.admin-modern` wrapper, so the toast container
// never inherits that class.

export type ToastKind = 'info' | 'success' | 'warn'
export type ToastTheme = 'shop' | 'admin'

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
    // Safe no-op so a component that outlives its provider can't crash a page.
    return { push: () => {} }
  }
  return ctx
}

// Top-right, just below the navbar. --nav-h is the navbar's own height (see
// src/app/globals.css), so this follows it instead of restating it.
const STACK_POSITION: Record<ToastTheme, string> = {
  shop: 'right-4 top-[calc(var(--nav-h)+12px)] lg:right-8',
  admin: 'right-4 top-20 sm:right-8 sm:top-24',
}

const SHOP_SPINE: Record<ToastKind, string> = {
  success: 'bg-emerald-500',
  warn: 'bg-amber-500',
  info: 'bg-primary-brown',
}

const SHOP_ICON: Record<ToastKind, string> = {
  success: 'text-emerald-600',
  warn: 'text-amber-600',
  info: 'text-primary-brown',
}

const ADMIN_CARD: Record<ToastKind, string> = {
  success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200',
  warn: 'bg-amber-500/15 border-amber-500/30 text-amber-200',
  info: 'bg-primary-brown/95 border-white/10 text-white',
}

export function ToastProvider({
  children,
  theme = 'shop',
}: {
  children: React.ReactNode
  theme?: ToastTheme
}) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const push = useCallback((t: ToastInput) => {
    const id = Date.now() + Math.random()
    const dur = t.durationMs ?? 6000
    setToasts((prev) => [
      ...prev,
      { id, kind: t.kind ?? 'info', title: t.title, body: t.body, durationMs: dur, expiresAt: Date.now() + dur },
    ])
  }, [])

  // Auto-dismiss expired toasts. The sweep returns the SAME array when nothing
  // has expired — `filter` always allocates a new one, which re-rendered the
  // whole subtree twice a second for as long as any toast was on screen.
  useEffect(() => {
    if (toasts.length === 0) return
    const id = setInterval(() => {
      const now = Date.now()
      setToasts((prev) => {
        const next = prev.filter((t) => t.expiresAt > now)
        return next.length === prev.length ? prev : next
      })
    }, 500)
    return () => clearInterval(id)
  }, [toasts.length])

  const isShop = theme === 'shop'

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div
        className={`pointer-events-none fixed z-[110] flex w-[calc(100vw-2rem)] max-w-[22rem] flex-col gap-2.5 ${STACK_POSITION[theme]}`}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={
              isShop
                ? 'kz-toast-in pointer-events-auto flex items-start gap-3 overflow-hidden rounded-xl border border-primary-brown/15 bg-white pr-3 shadow-[0_10px_30px_rgba(38,39,41,0.16)]'
                : `kz-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur-md ff-apfel ${ADMIN_CARD[t.kind]}`
            }
          >
            {/* Coloured spine instead of a tinted fill: it survives on any page
                background and keeps the text on plain white. */}
            {isShop && <span className={`w-1 self-stretch ${SHOP_SPINE[t.kind]}`} aria-hidden="true" />}

            <div className={isShop ? 'shrink-0 pl-2 pt-3.5' : 'shrink-0 mt-0.5'}>
              {t.kind === 'success' ? <CheckCircle size={18} className={isShop ? SHOP_ICON.success : undefined} />
                : t.kind === 'warn' ? <AlertTriangle size={18} className={isShop ? SHOP_ICON.warn : undefined} />
                  : <Bell size={18} className={isShop ? SHOP_ICON.info : 'animate-pulse'} />}
            </div>

            <div className={isShop ? 'min-w-0 flex-1 py-3' : 'min-w-0 flex-1'}>
              <p className={isShop ? 'ff-apfel text-[14px] font-semibold leading-snug text-[#262729]' : 'font-bold leading-tight'}>
                {t.title}
              </p>
              {t.body && (
                <p className={isShop ? 'ff-apfel mt-0.5 text-[13px] leading-snug text-black/55' : 'text-xs opacity-80 mt-1 leading-snug'}>
                  {t.body}
                </p>
              )}
            </div>

            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className={
                isShop
                  ? 'shrink-0 self-start p-3 text-black/30 transition-colors hover:text-black/70'
                  : 'shrink-0 opacity-50 hover:opacity-100 transition-opacity'
              }
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
