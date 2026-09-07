import { NextResponse, type NextRequest } from 'next/server'
import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPkr } from '@/lib/money'
import { renderOrderEmail, type OrderEmailData, type RenderedEmail } from '@/lib/notifications/email'

// nodemailer needs the Node.js runtime (not Edge), and the queue drain must
// never be statically cached.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Admin = ReturnType<typeof createAdminClient>

type NotificationRow = {
  id: number
  order_id: string | null
  user_id: string | null
  audience: 'user' | 'admin'
  channel: 'email' | 'wa_click' | 'wa_template' | 'sms' | 'in_app'
  template_key: string
  payload: Record<string, unknown>
}

type OrderRow = {
  order_number: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  delivery_fee_minor: number
  total_minor: number
  is_gift: boolean
  status: string
  delivery_slot_date: string | null
  delivery_slot_window: string | null
  delivery_address_snapshot: Record<string, unknown> | null
}

type OrderItemRow = {
  product_name_snapshot: string
  variation_label_snapshot: string | null
  quantity: number
  unit_price_minor_snapshot: number
  line_total_minor_snapshot: number
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function numValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value) || 0
}

// Build the typed email data for an order-linked notification. Falls back to the
// notification payload (order-level fields only, no line items) if the order or
// its items can't be read — the customer still gets a correct, if terser, note.
async function buildOrderEmailData(admin: Admin, n: NotificationRow): Promise<OrderEmailData> {
  const p = n.payload
  let order: OrderRow | null = null
  let items: OrderItemRow[] = []

  if (n.order_id) {
    const [orderRes, itemsRes] = await Promise.all([
      admin.from('orders')
        .select('order_number, customer_name, customer_email, customer_phone, subtotal_minor, discount_minor, tax_minor, delivery_fee_minor, total_minor, is_gift, status, delivery_slot_date, delivery_slot_window, delivery_address_snapshot')
        .eq('id', n.order_id).maybeSingle(),
      admin.from('order_items')
        .select('product_name_snapshot, variation_label_snapshot, quantity, unit_price_minor_snapshot, line_total_minor_snapshot')
        .eq('order_id', n.order_id),
    ])
    order = (orderRes.data as OrderRow | null) ?? null
    items = (itemsRes.data as OrderItemRow[] | null) ?? []
  }

  const addr = (order?.delivery_address_snapshot ?? {}) as Record<string, unknown>

  return {
    orderNumber: order?.order_number || textValue(p.order_number) || 'your order',
    customerName: order?.customer_name || textValue(p.customer_name) || 'Customer',
    customerEmail: order?.customer_email || textValue(p.customer_email),
    customerPhone: order?.customer_phone || textValue(p.customer_phone),
    status: textValue(p.status) || order?.status,
    previousStatus: textValue(p.previous_status) || null,
    subtotalMinor: order ? order.subtotal_minor : numValue(p.total_minor),
    discountMinor: order ? order.discount_minor : 0,
    taxMinor: order ? order.tax_minor : 0,
    deliveryMinor: order ? order.delivery_fee_minor : 0,
    totalMinor: order ? order.total_minor : numValue(p.total_minor),
    isGift: order?.is_gift ?? false,
    deliverySlotDate: order?.delivery_slot_date || textValue(p.delivery_slot_date) || null,
    deliverySlotWindow: order?.delivery_slot_window || textValue(p.delivery_slot_window) || null,
    address: {
      recipient: textValue(addr.recipient_name) || null,
      line1: textValue(addr.line1) || null,
      line2: textValue(addr.line2) || null,
      area: textValue(addr.area) || null,
      city: textValue(addr.city) || null,
      instructions: textValue(addr.instructions) || null,
    },
    items: items.map((it) => ({
      name: it.product_name_snapshot,
      variation: it.variation_label_snapshot,
      quantity: it.quantity,
      unitMinor: it.unit_price_minor_snapshot,
      lineMinor: it.line_total_minor_snapshot,
    })),
  }
}

function adminEmail(): string | null {
  return process.env.KAKEEZ_ADMIN_EMAIL || process.env.GOOGLE_SMTP_FROM || null
}

async function sendEmail(admin: Admin, notification: NotificationRow): Promise<string> {
  const data = await buildOrderEmailData(admin, notification)
  const to = notification.audience === 'admin' ? adminEmail() : (data.customerEmail || null)
  if (!to) throw new Error('No email recipient configured')

  const rendered: RenderedEmail = renderOrderEmail(notification.template_key, notification.audience, data)

  const from = process.env.GOOGLE_SMTP_FROM || process.env.GOOGLE_SMTP_USER
  const user = process.env.GOOGLE_SMTP_USER
  const pass = process.env.GOOGLE_SMTP_PASS
  const dryRun = process.env.NOTIFICATIONS_DRY_RUN !== 'false'

  if (dryRun || !from || !user || !pass) {
    console.log('[KAKEEZ NOTIFICATION DRY RUN][email]', { to, from: from ?? 'missing', subject: rendered.subject })
    return `dry-run-email-${notification.id}`
  }

  const transporter = nodemailer.createTransport({
    host: process.env.GOOGLE_SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.GOOGLE_SMTP_PORT || 465),
    secure: process.env.GOOGLE_SMTP_SECURE !== 'false',
    auth: { user, pass },
  })

  const info = await transporter.sendMail({
    from: `Kakeez <${from}>`,
    to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  })
  return String(info.messageId || `smtp-${notification.id}`)
}

async function sendWhatsApp(admin: Admin, notification: NotificationRow): Promise<string> {
  const token = process.env.WHATSAPP_API_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const to = process.env.KAKEEZ_ADMIN_WHATSAPP_E164
  const dryRun = process.env.NOTIFICATIONS_DRY_RUN !== 'false'

  if (!to) throw new Error('No WhatsApp admin recipient configured')

  const data = await buildOrderEmailData(admin, notification)
  const body = [
    `New Kakeez order ${data.orderNumber}`,
    `${data.customerName} · ${data.customerPhone}`,
    `Total: ${formatPkr(data.totalMinor)}`,
  ].join('\n')

  if (dryRun || !token || !phoneNumberId) {
    console.log('[KAKEEZ NOTIFICATION DRY RUN][whatsapp]', { to, text: body })
    return `dry-run-whatsapp-${notification.id}`
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  })

  const payload = await response.json() as { messages?: { id?: string }[]; error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || 'WhatsApp send failed')
  return payload.messages?.[0]?.id || `whatsapp-${notification.id}`
}

// Authorize the caller. Fails CLOSED: if no secret is configured at all the
// endpoint refuses every request rather than draining the queue for anyone who
// can reach the URL. Accepts either NOTIFICATIONS_PROCESS_SECRET (manual /
// pg_cron callers set this Bearer explicitly) or CRON_SECRET (Vercel Cron sends
// this automatically on scheduled invocations).
function isAuthorized(request: NextRequest): boolean {
  const processSecret = process.env.NOTIFICATIONS_PROCESS_SECRET
  const cronSecret = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')

  if (!processSecret && !cronSecret) return false
  if (processSecret && provided === `Bearer ${processSecret}`) return true
  if (cronSecret && provided === `Bearer ${cronSecret}`) return true
  return false
}

async function drainQueue() {
  let admin: Admin
  try {
    admin = createAdminClient()
  } catch (err) {
    return NextResponse.json({
      ok: false,
      message: err instanceof Error ? err.message : 'Notification processor is not configured',
    }, { status: 500 })
  }

  const { data, error } = await admin
    .from('notifications')
    .select('id, order_id, user_id, audience, channel, template_key, payload')
    .eq('status', 'queued')
    .in('channel', ['email', 'wa_template'])
    .order('created_at', { ascending: true })
    .limit(25)

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  const rows = (data as NotificationRow[] | null) ?? []
  const results: { id: number; ok: boolean; providerId?: string; error?: string }[] = []

  for (const notification of rows) {
    try {
      const providerId = notification.channel === 'wa_template'
        ? await sendWhatsApp(admin, notification)
        : await sendEmail(admin, notification)
      await admin
        .from('notifications')
        .update({ status: 'sent', provider_id: providerId, sent_at: new Date().toISOString(), error: null })
        .eq('id', notification.id)
      results.push({ id: notification.id, ok: true, providerId })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown notification error'
      await admin
        .from('notifications')
        .update({ status: 'failed', error: message })
        .eq('id', notification.id)
      results.push({ id: notification.id, ok: false, error: message })
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}

// Vercel Cron invokes scheduled endpoints with GET, so the cron path lives
// here. POST is kept for manual drains and pg_cron/pg_net callers.
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }
  return drainQueue()
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }
  return drainQueue()
}
