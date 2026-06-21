"use client"

import { useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { requestPhoneOtp, verifyPhoneOtp } from "@/app/account/verification/actions"

export default function PhoneVerificationPanel({
  phone,
  onVerified,
  compact = false,
}: {
  phone: string
  onVerified?: () => void
  compact?: boolean
}) {
  const [code, setCode] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle")
  const [loading, setLoading] = useState<"send" | "verify" | null>(null)

  const send = async () => {
    setLoading("send")
    const result = await requestPhoneOtp(phone)
    setStatus(result.ok ? "ok" : "error")
    setMessage(result.message)
    setLoading(null)
  }

  const verify = async () => {
    setLoading("verify")
    const result = await verifyPhoneOtp(phone, code)
    setStatus(result.ok ? "ok" : "error")
    setMessage(result.message)
    setLoading(null)
    if (result.ok) onVerified?.()
  }

  return (
    <div className={`rounded-[14px] border border-primary-brown/15 bg-white/75 p-4 shadow-sm sm:p-5 ${compact ? "space-y-3" : "space-y-4"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-green text-primary-brown">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="ff-accia text-[22px] leading-tight text-primary-brown">Verify your phone</p>
          <p className="mt-1 ff-colville-light text-[14px] leading-relaxed text-primary-brown/65">
            We will use this number for COD confirmation and delivery updates.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto]">
        <button
          type="button"
          onClick={send}
          disabled={loading !== null || !phone}
          className="min-h-11 rounded-[10px] bg-primary-brown px-4 ff-accia text-[16px] text-white transition-colors hover:bg-primary-brown/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === "send" ? <Loader2 size={16} className="inline animate-spin" /> : "Send Code"}
        </button>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit code"
          inputMode="numeric"
          className="min-h-11 rounded-[10px] border border-primary-brown/20 bg-white px-4 text-center ff-apfel text-[16px] tracking-[0.2em] text-primary-brown outline-none placeholder:tracking-normal placeholder:text-primary-brown/40 focus:border-primary-brown"
        />
        <button
          type="button"
          onClick={verify}
          disabled={loading !== null || code.length !== 6}
          className="min-h-11 rounded-[10px] bg-accent-green px-4 ff-accia text-[16px] text-primary-brown transition-colors hover:bg-accent-green/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading === "verify" ? <Loader2 size={16} className="inline animate-spin" /> : "Verify"}
        </button>
      </div>

      {message && (
        <p className={`rounded-[10px] px-3 py-2 ff-colville-light text-[13px] ${status === "error" ? "bg-red-50 text-red-600" : "bg-accent-green/60 text-primary-brown"}`}>
          {message}
        </p>
      )}
    </div>
  )
}
