// Credential check and template preview for the transactional email chain.
//
// Exists because the failure mode this replaces was silence: order mail sat
// queued for months with no way to tell whether the cause was SMTP, the
// secret, the dry-run flag or the queue itself. Point this at a mailbox and it
// answers that in one request — it reports the resolved SMTP settings, opens
// an authenticated connection, and sends a fully rendered branded email built
// from sample data so nothing touches a real order.
//
//   GET /api/notifications/test?to=you@example.com
//   GET /api/notifications/test?template=admin_new_order
//   GET /api/notifications/test?preview=1          → returns the HTML, sends nothing
//
// Authorization: Bearer $NOTIFICATIONS_PROCESS_SECRET (same gate as the drain).
//
// This deliberately sends even when NOTIFICATIONS_DRY_RUN is on. Proving
// delivery is the entire point, and dry-run is exactly the state you are in
// when you need the proof. It is safe to do so: the route is secret-gated, the
// payload is invented, and the recipient defaults to the admin's own inbox.

import { NextResponse, type NextRequest } from 'next/server'
import nodemailer from 'nodemailer'
import { renderOrderEmail, type OrderEmailData } from '@/lib/notifications/email'
import { adminEmail, isDryRun, readSmtpConfig, verifySmtp } from '@/lib/notifications/smtp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TEMPLATES = ['order_confirmed', 'admin_new_order', 'order_status_out_for_delivery'] as const
type TemplateKey = (typeof TEMPLATES)[number]

const isTemplate = (v: string | null): v is TemplateKey =>
  !!v && (TEMPLATES as readonly string[]).includes(v)

// A believable order: two lines, a variation, a coupon discount, a delivery
// slot and gift instructions, so every branch of the template renders. Totals
// are in minor units (paisa) like the real thing — 402500 renders as
// Rs. 4,025.00.
function sampleOrder(templateKey: TemplateKey): OrderEmailData {
  return {
    orderNumber: 'KKZ-TEST01',
    customerName: 'Ayesha Khan',
    customerEmail: 'ayesha@example.com',
    customerPhone: '+923001234567',
    status: templateKey === 'order_status_out_for_delivery' ? 'out_for_delivery' : 'pending_confirmation',
    previousStatus: templateKey === 'order_status_out_for_delivery' ? 'ready_for_dispatch' : null,
    subtotalMinor: 425000,
    discountMinor: 42500,
    taxMinor: 0,
    deliveryMinor: 20000,
    totalMinor: 402500,
    isGift: false,
    deliverySlotDate: 'Saturday, 26 September',
    deliverySlotWindow: '2:00 PM - 5:00 PM',
    address: {
      recipient: 'Ayesha Khan',
      line1: 'House 42, Street 7',
      line2: 'Block C',
      area: 'Johar Town',
      city: 'Lahore',
      instructions: 'Please ring the bell twice, the gate is usually open.',
    },
    items: [
      { name: 'Belgian Chocolate Truffle Cake', variation: '2 lbs', quantity: 1, unitMinor: 350000, lineMinor: 350000 },
      { name: 'Red Velvet Cupcakes', variation: 'Box of 6', quantity: 1, unitMinor: 75000, lineMinor: 75000 },
    ],
  }
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.NOTIFICATIONS_PROCESS_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    // Fails closed exactly like the drain: with no secret set there is no
    // request that can pass, rather than every request passing.
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const requested = searchParams.get('template')
  const templateKey: TemplateKey = isTemplate(requested) ? requested : 'order_confirmed'
  const audience = templateKey === 'admin_new_order' ? 'admin' : 'user'
  const rendered = renderOrderEmail(templateKey, audience, sampleOrder(templateKey))

  // Preview mode: hand back the HTML so branding can be eyeballed in a browser
  // without spending a send or needing credentials at all.
  if (searchParams.get('preview')) {
    return new NextResponse(rendered.html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }

  const status = readSmtpConfig()

  if (!status.configured) {
    return NextResponse.json({
      ok: false,
      stage: 'config',
      message: `SMTP is not configured. Missing: ${status.missing.join(', ')}`,
      missing: status.missing,
      dryRun: isDryRun(),
      template: templateKey,
      subject: rendered.subject,
    }, { status: 503 })
  }

  const settings = {
    host: status.config.host,
    port: status.config.port,
    secure: status.config.secure,
    user: status.config.user,
    from: status.config.from,
    // Never echo the app password. Its length is the one property worth
    // reporting: Google's are 16 characters once the display spaces are
    // stripped, so a different number points straight at a paste error.
    passwordLength: status.config.pass.length,
  }

  const verification = await verifySmtp()
  if (!verification.ok) {
    return NextResponse.json({
      ok: false,
      stage: 'connect',
      message: verification.error,
      hint: 'A 535 here almost always means GOOGLE_SMTP_PASS is an account password rather than an app password, or 2-Step Verification is off for that account.',
      settings,
    }, { status: 502 })
  }

  const to = searchParams.get('to') || adminEmail()
  if (!to) {
    return NextResponse.json({
      ok: false,
      stage: 'recipient',
      message: 'No recipient. Pass ?to=someone@example.com or set KAKEEZ_ADMIN_EMAIL.',
      settings,
    }, { status: 400 })
  }

  // Sent through a one-off transporter rather than the shared sendEmail(),
  // precisely so the global dry-run flag cannot swallow the thing we are here
  // to prove. Everything else — host, auth, From — comes from the same resolved
  // config the drain uses, so a pass here means the drain will pass too.
  try {
    const info = await nodemailer.createTransport({
      host: status.config.host,
      port: status.config.port,
      secure: status.config.secure,
      auth: { user: status.config.user, pass: status.config.pass },
    }).sendMail({
      from: `Kakeez <${status.config.from}>`,
      to,
      subject: `[TEST] ${rendered.subject}`,
      text: rendered.text,
      html: rendered.html,
    })

    return NextResponse.json({
      ok: true,
      stage: 'sent',
      to,
      template: templateKey,
      subject: `[TEST] ${rendered.subject}`,
      messageId: String(info.messageId || ''),
      accepted: info.accepted,
      rejected: info.rejected,
      settings,
      dryRun: isDryRun(),
      note: isDryRun()
        ? 'Sent for real. NOTIFICATIONS_DRY_RUN is still on, so the queue drain will keep logging instead of sending until it is set to "false".'
        : 'Sent for real, and the queue drain is live too.',
      checkFrom: `Google rewrites the From header unless ${status.config.from} is a verified alias on ${status.config.user}. Confirm what the delivered mail actually shows as the sender.`,
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      stage: 'send',
      message: err instanceof Error ? err.message : 'Send failed',
      to,
      settings,
    }, { status: 502 })
  }
}
