// The one place that knows how to talk to Google SMTP.
//
// Shared by the queue drain (src/app/api/notifications/process/route.ts) and
// the credential check (src/app/api/notifications/test/route.ts) so there is a
// single answer to "are we configured, and what do we send as".
//
// Gmail / Google Workspace specifics worth knowing before debugging a bounce:
//
//   - GOOGLE_SMTP_PASS is an *app password*, not the account password. Generate
//     one at https://myaccount.google.com/apppasswords (needs 2-Step
//     Verification on). Google shows it with spaces; they are cosmetic and
//     stripped below, because pasting them through verbatim is a very common
//     way to get an unexplained 535 auth failure.
//   - Google rewrites the From header to the authenticated mailbox unless the
//     address is a verified alias on that account (Gmail → Settings → Accounts
//     → "Send mail as"). So GOOGLE_SMTP_FROM=orders@kakeez.com only survives if
//     orders@kakeez.com is verified for GOOGLE_SMTP_USER. If it isn't, mail
//     still goes out — just from the user's own address.
//   - kakeez.com publishes SPF `-all` and DMARC `p=quarantine`, so a From that
//     Google hasn't aligned with SPF/DKIM lands in spam. Worth one real test
//     send to a non-Gmail inbox before trusting it with customers.

import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'

export type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

// Timeouts matter here: the drain runs on a 60s cron budget
// (maxDuration in the process route) and works through up to 25 queued rows.
// Nodemailer waits indefinitely by default, so one unreachable SMTP host would
// otherwise hang the whole batch until the platform kills it mid-flight,
// leaving rows neither sent nor marked failed.
const TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
} as const

// Google displays app passwords in four space-separated groups. The spaces are
// presentation only and SMTP AUTH rejects them.
const normalizePassword = (raw: string) => raw.replace(/\s+/g, '')

export type SmtpStatus =
  | { configured: true; config: SmtpConfig; missing: [] }
  | { configured: false; config: null; missing: string[] }

export function readSmtpConfig(): SmtpStatus {
  const user = process.env.GOOGLE_SMTP_USER
  const pass = process.env.GOOGLE_SMTP_PASS
  const from = process.env.GOOGLE_SMTP_FROM || user

  const missing: string[] = []
  if (!user) missing.push('GOOGLE_SMTP_USER')
  if (!pass) missing.push('GOOGLE_SMTP_PASS')
  if (!from) missing.push('GOOGLE_SMTP_FROM')

  if (!user || !pass || !from) return { configured: false, config: null, missing }

  return {
    configured: true,
    missing: [],
    config: {
      host: process.env.GOOGLE_SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.GOOGLE_SMTP_PORT || 465),
      // Port 465 is implicit TLS; 587 is STARTTLS and wants secure=false.
      // Honour the explicit opt-out, otherwise infer from the port so a
      // half-configured 587 doesn't silently fail its handshake.
      secure: process.env.GOOGLE_SMTP_SECURE
        ? process.env.GOOGLE_SMTP_SECURE !== 'false'
        : Number(process.env.GOOGLE_SMTP_PORT || 465) === 465,
      user,
      pass: normalizePassword(pass),
      from,
    },
  }
}

// Dry run is the default and has to stay that way: an unset environment means a
// developer's machine or a fresh preview deploy, and neither should be able to
// mail real customers. Only the literal string 'false' turns sending on.
export function isDryRun(): boolean {
  return process.env.NOTIFICATIONS_DRY_RUN !== 'false'
}

export function adminEmail(): string | null {
  return process.env.KAKEEZ_ADMIN_EMAIL || process.env.GOOGLE_SMTP_FROM || null
}

// One transporter per lambda instance. Nodemailer pools nothing by default, but
// reusing the object lets it reuse the TLS session across a batch.
let cached: { transporter: Transporter; key: string } | null = null

function getTransporter(config: SmtpConfig): Transporter {
  const key = `${config.host}:${config.port}:${config.secure}:${config.user}`
  if (cached && cached.key === key) return cached.transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    ...TIMEOUTS,
  })
  cached = { transporter, key }
  return transporter
}

// Opens a connection and authenticates without sending anything. This is what
// turns "the emails aren't arriving" into a specific answer.
export async function verifySmtp(): Promise<{ ok: boolean; error?: string; missing?: string[] }> {
  const status = readSmtpConfig()
  if (!status.configured) return { ok: false, missing: status.missing, error: 'SMTP is not configured' }
  try {
    await getTransporter(status.config).verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SMTP verification failed' }
  }
}

export type OutgoingEmail = {
  to: string
  subject: string
  text: string
  html: string
}

export type SendResult = { messageId: string; dryRun: boolean }

// `label` only shows up in dry-run logging, to make the console readable when a
// batch drains without credentials.
export async function sendEmail(message: OutgoingEmail, label: string): Promise<SendResult> {
  const status = readSmtpConfig()

  if (isDryRun() || !status.configured) {
    console.log('[KAKEEZ NOTIFICATION DRY RUN][email]', {
      to: message.to,
      subject: message.subject,
      reason: isDryRun() ? 'NOTIFICATIONS_DRY_RUN is not "false"' : `missing ${status.missing.join(', ')}`,
    })
    return { messageId: `dry-run-email-${label}`, dryRun: true }
  }

  const info = await getTransporter(status.config).sendMail({
    from: `Kakeez <${status.config.from}>`,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  })

  return { messageId: String(info.messageId || `smtp-${label}`), dryRun: false }
}
