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
    <div className={`rounded-[12px] border border-primary-brown/20 bg-white p-4 ${compact ? "space-y-3" : "space-y-4"}`}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-brown" />
        <div>
          <p className="ff-accia text-[18px] leading-tight text-primary-brown">Verify your phone</p>
          <p className="mt-1 ff-accia-light text-[14px] leading-snug text-black/60">
            We will use this number for COD confirmation and delivery updates.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={send}
          disabled={loading !== null || !phone}
          className="min-h-10 rounded-[10px] bg-primary-brown px-4 ff-accia text-[15px] text-white transition-all hover:bg-primary-brown/90 disabled:opacity-60"
        >
          {loading === "send" ? <Loader2 size={16} className="inline animate-spin" /> : "Send Code"}
        </button>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit code"
          inputMode="numeric"
          className="min-h-10 flex-1 rounded-[10px] border border-primary-brown/30 bg-white px-3 ff-accia-light text-[15px] text-black outline-none focus:border-primary-brown"
        />
        <button
          type="button"
          onClick={verify}
          disabled={loading !== null || code.length !== 6}
          className="min-h-10 rounded-[10px] bg-accent-green px-4 ff-accia text-[15px] text-primary-brown transition-all hover:bg-accent-green/80 disabled:opacity-60"
        >
          {loading === "verify" ? <Loader2 size={16} className="inline animate-spin" /> : "Verify"}
        </button>
      </div>

      {message && (
        <p className={`ff-accia-light text-[13px] ${status === "error" ? "text-red-500" : "text-green-700"}`}>
          {message}
        </p>
      )}
    </div>
  )
}
