// Branded transactional email rendering for Kakeez order notifications.
//
// Pure functions: given typed order data, return { subject, text, html }.
// HTML uses inline styles only (email clients strip <style>/external CSS) and
// a table-based layout for Outlook/Gmail compatibility. Every email also ships
// a plain-text alternative so text-only clients and spam filters stay happy.

import { formatPkr } from '@/lib/money'

const BROWN = '#936939'
const CREAM = '#fffdf7'
const GREEN = '#e1eab4'
const INK = '#262729'

export type OrderEmailLine = {
  name: string
  variation?: string | null
  quantity: number
  unitMinor: number
  lineMinor: number
}

export type OrderEmailAddress = {
  recipient?: string | null
  line1?: string | null
  line2?: string | null
  area?: string | null
  city?: string | null
  instructions?: string | null
}

export type OrderEmailData = {
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  status?: string
  previousStatus?: string | null
  subtotalMinor: number
  discountMinor: number
  taxMinor: number
  deliveryMinor: number
  totalMinor: number
  isGift: boolean
  deliverySlotDate?: string | null
  deliverySlotWindow?: string | null
  address: OrderEmailAddress
  items: OrderEmailLine[]
}

export type RenderedEmail = { subject: string; text: string; html: string }

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slotLine(d: OrderEmailData): string {
  return [d.deliverySlotDate, d.deliverySlotWindow].filter(Boolean).join(' ')
}

function addressLines(a: OrderEmailAddress): string[] {
  return [
    a.recipient,
    a.line1,
    a.line2,
    [a.area, a.city].filter(Boolean).join(', ') || null,
  ].filter((v): v is string => Boolean(v && v.trim()))
}

// ── Shared HTML chrome ──────────────────────────────────────────────────────
function shell(inner: string, preheader: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${GREEN};font-family:Georgia,'Times New Roman',serif;color:${INK};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GREEN};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${CREAM};border-radius:16px;overflow:hidden;border:1px solid rgba(147,105,57,0.18);">
<tr><td style="background:${BROWN};padding:22px 28px;text-align:center;">
<div style="color:#fff;font-size:26px;letter-spacing:2px;font-weight:bold;">KAKEEZ</div>
<div style="color:#f3e9da;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-top:4px;">Every Bite Matters</div>
</td></tr>
<tr><td style="padding:28px;">${inner}</td></tr>
<tr><td style="padding:18px 28px;background:#f4efe6;border-top:1px solid rgba(147,105,57,0.15);text-align:center;color:#8a7c68;font-size:12px;">
Kakeez Bakeshop · Johar Town, Lahore · <a href="mailto:hello@kakeez.com" style="color:${BROWN};">hello@kakeez.com</a><br>
This is an automated message about your order.
</td></tr>
</table></td></tr></table></body></html>`
}

function receiptTable(d: OrderEmailData): string {
  const rows = d.items.map((it) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid rgba(147,105,57,0.12);">
        <div style="font-size:15px;color:${INK};">${esc(it.name)}</div>
        ${it.variation ? `<div style="font-size:12px;color:#8a7c68;">${esc(it.variation)}</div>` : ''}
        <div style="font-size:12px;color:#8a7c68;">${it.quantity} × ${esc(formatPkr(it.unitMinor))}</div>
      </td>
      <td align="right" style="padding:8px 0;border-bottom:1px solid rgba(147,105,57,0.12);font-size:15px;color:${INK};white-space:nowrap;">
        ${d.isGift ? '—' : esc(formatPkr(it.lineMinor))}
      </td>
    </tr>`).join('')

  const money = (label: string, minor: number, opts: { accent?: string; bold?: boolean; neg?: boolean } = {}) => `
    <tr>
      <td style="padding:3px 0;font-size:${opts.bold ? '16px' : '14px'};color:${opts.accent || (opts.bold ? INK : '#6f6656')};${opts.bold ? 'font-weight:bold;padding-top:8px;' : ''}">${esc(label)}</td>
      <td align="right" style="padding:3px 0;font-size:${opts.bold ? '16px' : '14px'};color:${opts.accent || (opts.bold ? INK : '#6f6656')};${opts.bold ? 'font-weight:bold;padding-top:8px;' : ''}white-space:nowrap;">${opts.neg ? '− ' : ''}${esc(formatPkr(Math.abs(minor)))}</td>
    </tr>`

  const totals = d.isGift
    ? `<tr><td colspan="2" style="padding-top:10px;font-size:13px;color:#8a7c68;font-style:italic;">Prices are hidden on this gift order's receipt.</td></tr>`
    : `${money('Subtotal', d.subtotalMinor)}
       ${d.discountMinor > 0 ? money('Discount', d.discountMinor, { accent: '#3f7d43', neg: true }) : ''}
       ${money('Delivery', d.deliveryMinor)}
       ${d.taxMinor > 0 ? money('Tax', d.taxMinor) : ''}
       ${money('Total', d.totalMinor, { bold: true })}`

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
      ${rows}
      ${totals}
    </table>`
}

function detailBlocks(d: OrderEmailData): string {
  const addr = addressLines(d.address)
  const slot = slotLine(d)
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
    <tr>
      <td width="50%" valign="top" style="padding-right:8px;">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${BROWN};margin-bottom:6px;">Deliver to</div>
        <div style="font-size:14px;line-height:1.5;color:${INK};">
          ${addr.length ? addr.map((l) => esc(l)).join('<br>') : '—'}
          ${slot ? `<br><span style="color:#8a7c68;">${esc(slot)}</span>` : ''}
        </div>
      </td>
      <td width="50%" valign="top" style="padding-left:8px;">
        <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${BROWN};margin-bottom:6px;">Payment</div>
        <div style="font-size:14px;line-height:1.5;color:${INK};">Cash on Delivery${d.isGift ? '<br><span style="color:#8a7c68;">Gift order</span>' : ''}</div>
      </td>
    </tr>
    ${d.address.instructions ? `<tr><td colspan="2" style="padding-top:12px;font-size:13px;color:#8a7c68;font-style:italic;">“${esc(d.address.instructions)}”</td></tr>` : ''}
  </table>`
}

// ── Templates ───────────────────────────────────────────────────────────────
export function renderOrderConfirmed(d: OrderEmailData): RenderedEmail {
  const subject = `Kakeez order ${d.orderNumber} received`
  const heading = `Thanks, ${d.customerName.split(' ')[0] || 'friend'} — we've got your order`
  const html = shell(`
    <div style="font-size:22px;color:${BROWN};margin-bottom:6px;">${esc(heading)}</div>
    <div style="font-size:14px;color:#6f6656;line-height:1.6;">Order <strong style="color:${INK};">${esc(d.orderNumber)}</strong> is in. We'll confirm it and start baking shortly — you'll get another note when it's on the way.</div>
    ${receiptTable(d)}
    ${detailBlocks(d)}
  `, `Order ${d.orderNumber} received — ${formatPkr(d.totalMinor)}`)

  const text = [
    `Hi ${d.customerName},`,
    '',
    `We received your order ${d.orderNumber}.`,
    '',
    ...d.items.map((it) => `  ${it.quantity} x ${it.name}${it.variation ? ` (${it.variation})` : ''}${d.isGift ? '' : ` — ${formatPkr(it.lineMinor)}`}`),
    '',
    ...(d.isGift ? ['Gift order — prices hidden.'] : [
      `Subtotal: ${formatPkr(d.subtotalMinor)}`,
      d.discountMinor > 0 ? `Discount: -${formatPkr(d.discountMinor)}` : '',
      `Delivery: ${formatPkr(d.deliveryMinor)}`,
      d.taxMinor > 0 ? `Tax: ${formatPkr(d.taxMinor)}` : '',
      `Total: ${formatPkr(d.totalMinor)}`,
    ]),
    slotLine(d) ? `Delivery slot: ${slotLine(d)}` : '',
    '',
    'Payment: Cash on Delivery.',
    'Kakeez will confirm and start preparing it shortly.',
  ].filter((l) => l !== '').join('\n')

  return { subject, text, html }
}

export function renderAdminNewOrder(d: OrderEmailData): RenderedEmail {
  const subject = `New Kakeez order ${d.orderNumber} — ${formatPkr(d.totalMinor)}`
  const html = shell(`
    <div style="font-size:22px;color:${BROWN};margin-bottom:6px;">New order ${esc(d.orderNumber)}</div>
    <div style="font-size:14px;color:#6f6656;line-height:1.6;">
      <strong style="color:${INK};">${esc(d.customerName)}</strong> · ${esc(d.customerPhone)} · ${esc(d.customerEmail)}
    </div>
    ${receiptTable({ ...d, isGift: false })}
    ${detailBlocks(d)}
    <div style="margin-top:22px;text-align:center;">
      <a href="https://www.kakeez.com/admin/orders" style="display:inline-block;background:${BROWN};color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-size:15px;">Open in admin</a>
    </div>
    <div style="margin-top:10px;font-size:12px;color:#8a7c68;text-align:center;">Confirm the order and move it to preparing.</div>
  `, `New order ${d.orderNumber} from ${d.customerName} — ${formatPkr(d.totalMinor)}`)

  const text = [
    `New order ${d.orderNumber}`,
    `Customer: ${d.customerName}`,
    `Phone: ${d.customerPhone}`,
    `Email: ${d.customerEmail}`,
    '',
    ...d.items.map((it) => `  ${it.quantity} x ${it.name}${it.variation ? ` (${it.variation})` : ''} — ${formatPkr(it.lineMinor)}`),
    '',
    `Subtotal: ${formatPkr(d.subtotalMinor)}`,
    d.discountMinor > 0 ? `Discount: -${formatPkr(d.discountMinor)}` : '',
    `Delivery: ${formatPkr(d.deliveryMinor)}`,
    d.taxMinor > 0 ? `Tax: ${formatPkr(d.taxMinor)}` : '',
    `Total: ${formatPkr(d.totalMinor)}`,
    slotLine(d) ? `Delivery slot: ${slotLine(d)}` : '',
    '',
    'Confirm the order and move it to preparing: https://www.kakeez.com/admin/orders',
  ].filter((l) => l !== '').join('\n')

  return { subject, text, html }
}

const STATUS_COPY: Record<string, { title: string; line: string }> = {
  confirmed: { title: 'Your order is confirmed', line: 'is confirmed and heading into our kitchen.' },
  preparing: { title: 'We’re baking your order', line: 'is being freshly prepared right now.' },
  ready_for_dispatch: { title: 'Your order is ready', line: 'is packed and ready for dispatch.' },
  out_for_delivery: { title: 'Your order is on the way', line: 'is out for delivery — keep your phone handy.' },
  delivered: { title: 'Delivered — enjoy!', line: 'has been delivered. We hope every bite matters.' },
  cancelled: { title: 'Your order was cancelled', line: 'has been cancelled. Any COD amount is voided; reach out if this looks wrong.' },
  failed_delivery: { title: 'Delivery didn’t go through', line: 'could not be delivered. Our team will be in touch to reschedule.' },
}

export function renderStatusChange(d: OrderEmailData): RenderedEmail {
  const status = d.status || 'updated'
  const copy = STATUS_COPY[status] || { title: 'Order update', line: `has been updated to “${status.replace(/_/g, ' ')}”.` }
  const subject = `Kakeez order ${d.orderNumber} — ${copy.title.toLowerCase()}`
  const html = shell(`
    <div style="font-size:22px;color:${BROWN};margin-bottom:6px;">${esc(copy.title)}</div>
    <div style="font-size:15px;color:#6f6656;line-height:1.6;">Hi ${esc(d.customerName.split(' ')[0] || 'there')}, your order <strong style="color:${INK};">${esc(d.orderNumber)}</strong> ${esc(copy.line)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
      <tr><td style="font-size:14px;color:#6f6656;">Order total</td><td align="right" style="font-size:15px;color:${INK};font-weight:bold;">${esc(formatPkr(d.totalMinor))}</td></tr>
      ${slotLine(d) ? `<tr><td style="font-size:14px;color:#6f6656;">Delivery slot</td><td align="right" style="font-size:14px;color:${INK};">${esc(slotLine(d))}</td></tr>` : ''}
    </table>
    <div style="margin-top:20px;text-align:center;">
      <a href="https://www.kakeez.com/account/orders" style="display:inline-block;background:${BROWN};color:#fff;text-decoration:none;padding:12px 26px;border-radius:10px;font-size:15px;">View your order</a>
    </div>
  `, `Order ${d.orderNumber}: ${copy.title}`)

  const text = [
    `Hi ${d.customerName},`,
    '',
    `Your order ${d.orderNumber} ${copy.line}`,
    `Order total: ${formatPkr(d.totalMinor)}`,
    slotLine(d) ? `Delivery slot: ${slotLine(d)}` : '',
    '',
    'View your order: https://www.kakeez.com/account/orders',
  ].filter((l) => l !== '').join('\n')

  return { subject, text, html }
}

export function renderOrderEmail(templateKey: string, audience: 'user' | 'admin', d: OrderEmailData): RenderedEmail {
  if (templateKey === 'admin_new_order') return renderAdminNewOrder(d)
  if (templateKey === 'order_confirmed') return renderOrderConfirmed(d)
  return renderStatusChange(d)
}
