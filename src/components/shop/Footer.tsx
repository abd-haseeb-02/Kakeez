"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import { CONTACT } from "@/lib/contact"
import { supabase } from "@/lib/supabase"

type FooterProps = {
  topOffset?: number | string
  variant?: "absolute" | "flow"
}

type SignupState = "idle" | "saving" | "done" | "error"

export default function Footer(_props: FooterProps) {
  void _props

  const [email, setEmail] = useState("")
  const [state, setState] = useState<SignupState>("idle")
  const [message, setMessage] = useState("")

  // Was a styled <div> with a decorative arrow and no handler at all. Now it
  // really subscribes: newsletter_subscribers accepts an insert from anon but
  // has no SELECT policy, so the list cannot be read back from the browser.
  const subscribe = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setState("error")
      setMessage("Enter a valid email address.")
      return
    }

    setState("saving")
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: value, source: "footer" })

    // A duplicate means they are already on the list — that is a success from
    // the subscriber's point of view, not an error to shout about.
    if (error && !error.message.toLowerCase().includes("duplicate")) {
      setState("error")
      setMessage("Could not sign you up just now. Please try again.")
      return
    }

    setState("done")
    setMessage("You're on the list. We'll be in touch.")
    setEmail("")
  }

  return (
    <footer className="relative z-20 mx-auto w-[calc(100%_-_24px)] overflow-hidden border border-white bg-[#e1eab4] py-[clamp(24px,2.8vw,42px)] text-[#936939] lg:w-[calc(100%_-_40px)]">
      <div className="mx-auto w-[min(1390px,calc(100%_-_32px))]">
        <div className="grid gap-[clamp(24px,4vw,64px)] md:grid-cols-[1.35fr_0.65fr_0.8fr]">
          <div>
            <h2 className="ff-accia-bold text-[clamp(24px,2vw,30px)] leading-none">Stay in the Loop</h2>
            <p className="ff-colville-light mt-[clamp(12px,1.6vw,22px)] text-[clamp(14px,1vw,16px)]">We will not spam you, we promise.</p>

            {state === "done" ? (
              <p className="mt-[clamp(20px,2vw,28px)] flex max-w-[310px] items-center gap-2 rounded-[10px] border border-[#936939]/40 bg-white/40 px-4 py-3 ff-colville text-[15px]">
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                {message}
              </p>
            ) : (
              <form onSubmit={subscribe} className="mt-[clamp(20px,2vw,28px)] max-w-[310px]">
                <label htmlFor="newsletter-email" className="sr-only">Your email address</label>
                <div className="flex h-[44px] items-center justify-between rounded-[10px] border border-[#936939]/40 bg-white/10 pl-4 pr-2 focus-within:border-[#936939]">
                  <input
                    id="newsletter-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle") }}
                    placeholder="Your e-mail"
                    autoComplete="email"
                    className="h-full w-full bg-transparent ff-accia text-[15px] text-[#936939] outline-none placeholder:text-[#936939]/55"
                  />
                  <button
                    type="submit"
                    disabled={state === "saving"}
                    aria-label="Subscribe to the Kakeez newsletter"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#936939] transition-colors hover:bg-[#936939]/10 disabled:opacity-50"
                  >
                    {state === "saving"
                      ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
                {state === "error" && (
                  <p role="alert" className="mt-2 ff-colville-light text-[13px] text-red-700">{message}</p>
                )}
              </form>
            )}
          </div>

          <div className="md:ml-auto">
            <h3 className="ff-colville text-[clamp(19px,1.35vw,23px)] leading-tight">About Us</h3>
            <div className="ff-colville mt-3 space-y-2 text-[clamp(14px,0.95vw,16px)] capitalize">
              <Link href="/about" className="block transition-opacity hover:opacity-70">Our Story</Link>
              <Link href="/#menu" className="block transition-opacity hover:opacity-70">Menu</Link>
              <Link href="/#menu" className="block transition-opacity hover:opacity-70">Order now</Link>
            </div>
          </div>

          <div className="md:ml-auto">
            <h3 className="ff-colville text-[clamp(19px,1.35vw,23px)] leading-tight">Visit Us</h3>
            <p className="ff-colville-light mt-3 max-w-[200px] text-[clamp(14px,0.95vw,16px)] leading-snug">
              {CONTACT.addressLines.map((line) => (
                <span key={line} className="block">{line}</span>
              ))}
            </p>
            <a href={CONTACT.phoneHref} className="mt-3 block ff-colville-light text-[clamp(14px,0.95vw,16px)] transition-opacity hover:opacity-70">{CONTACT.phone}</a>
            <a href={`mailto:${CONTACT.email}`} className="mt-1 block ff-colville-light text-[clamp(14px,0.95vw,16px)] normal-case transition-opacity hover:opacity-70">{CONTACT.email}</a>
          </div>
        </div>

        <div className="mt-[clamp(24px,3vw,46px)] border-t border-[#936939]/20 pt-4 ff-colville text-[clamp(13px,0.9vw,15px)] capitalize">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p>(c) 2022-{new Date().getFullYear()} Kakeez All rights reserved</p>
            {/* These were plain text pointing at pages that did not exist. */}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 md:justify-end">
              <Link href="/terms" className="transition-opacity hover:opacity-70">Terms &amp; Conditions</Link>
              <span aria-hidden="true" className="opacity-40">|</span>
              <Link href="/cookies" className="transition-opacity hover:opacity-70">Cookies</Link>
              <span aria-hidden="true" className="opacity-40">|</span>
              <Link href="/privacy" className="transition-opacity hover:opacity-70">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
