import { NextResponse, type NextRequest } from 'next/server'
import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPkr } from '@/lib/money'

type NotificationRow = {
  id: number
  order_id: string | null
  user_id: string | null
  audience: 'user' | 'admin'
  channel: 'email' | 'wa_click' | 'wa_template' | 'sms' | 'in_app'
  template_key: string
  payload: Record<string, unknown>
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function moneyValue(value: unknown): string {
  return formatPkr(typeof value === 'number' ? value : Number(value) || 0)
}

function renderMessage(notification: NotificationRow): { subject: string; text: string } {
  const p = notification.payload
  const orderNumber = textValue(p.order_number) || 'new order'
  const customerName = textValue(p.customer_name) || 'Customer'
  const status = textValue(p.status).replace(/_/g, ' ')
  const total = moneyValue(p.total_minor)
  const slot = [textValue(p.delivery_slot_date), textValue(p.delivery_slot_window)].filter(Boolean).join(' ')

  if (notification.template_key === 'admin_new_order') {
    return {
      subject: `New Kakeez order ${orderNumber}`,
      text: [
        `New order ${orderNumber}`,
        `Customer: ${customerName}`,
        `Phone: ${textValue(p.customer_phone)}`,
        `Email: ${textValue(p.customer_email)}`,
        `Total: ${total}`,
        slot ? `Delivery slot: ${slot}` : '',
        '',
        'Please confirm the order and move it to preparing in the admin panel.',
      ].filter(Boolean).join('\n'),
    }
  }

  if (notification.template_key === 'order_confirmed') {
    return {
      subject: `Kakeez order ${orderNumber} received`,
      text: [
        `Hi ${customerName},`,
        '',
        `We received your order ${orderNumber}.`,
        `Total: ${total}`,
        slot ? `Delivery slot: ${slot}` : '',
        '',
        'Kakeez will confirm and start preparing it shortly.',
      ].filter(Boolean).join('\n'),
    }
  }

  return {
    subject: `Kakeez order ${orderNumber} update`,
    text: `Order ${orderNumber} status changed to ${status || 'updated'}.`,
  }
}

function adminEmail(): string | null {
  return process.env.KAKEEZ_ADMIN_EMAIL || process.env.GOOGLE_SMTP_FROM || null
}

function customerEmail(notification: NotificationRow): string | null {
  return textValue(notification.payload.customer_email) || null
}

async function sendEmail(notification: NotificationRow): Promise<string> {
  const to = notification.audience === 'admin' ? adminEmail() : customerEmail(notification)
  if (!to) throw new Error('No email recipient configured')

  const from = process.env.GOOGLE_SMTP_FROM || process.env.GOOGLE_SMTP_USER
  const user = process.env.GOOGLE_SMTP_USER
  const pass = process.env.GOOGLE_SMTP_PASS
  const dryRun = process.env.NOTIFICATIONS_DRY_RUN !== 'false'
  const message = renderMessage(notification)

  if (dryRun || !from || !user || !pass) {
    console.log('[KAKEEZ NOTIFICATION DRY RUN][email]', { to, from: from ?? 'missing', ...message })
    return `dry-run-email-${notification.id}`
  }

  const transporter = nodemailer.createTransport({
    host: process.env.GOOGLE_SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.GOOGLE_SMTP_PORT || 465),
    secure: process.env.GOOGLE_SMTP_SECURE !== 'false',
    auth: { user, pass },
  })

  const info = await transporter.sendMail({ from, to, subject: message.subject, text: message.text })
  return String(info.messageId || `smtp-${notification.id}`)
}

async function sendWhatsApp(notification: NotificationRow): Promise<string> {
  const token = process.env.WHATSAPP_API_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const to = process.env.KAKEEZ_ADMIN_WHATSAPP_E164
  const dryRun = process.env.NOTIFICATIONS_DRY_RUN !== 'false'
  const message = renderMessage(notification)

  if (!to) throw new Error('No WhatsApp admin recipient configured')

  if (dryRun || !token || !phoneNumberId) {
    console.log('[KAKEEZ NOTIFICATION DRY RUN][whatsapp]', { to, text: message.text })
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
      text: { preview_url: false, body: message.text },
    }),
  })

  const data = await response.json() as { messages?: { id?: string }[]; error?: { message?: string } }
  if (!response.ok) throw new Error(data.error?.message || 'WhatsApp send failed')
  return data.messages?.[0]?.id || `whatsapp-${notification.id}`
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.NOTIFICATIONS_PROCESS_SECRET
  if (expectedSecret && request.headers.get('authorization') !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }

  let admin: ReturnType<typeof createAdminClient>
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
        ? await sendWhatsApp(notification)
        : await sendEmail(notification)
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
