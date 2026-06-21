'use server'

import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const OTP_TTL_MINUTES = 10
const OTP_PEPPER = process.env.PHONE_OTP_PEPPER || 'dev-phone-otp-pepper-change-me'

type DevOtpEntry = {
  phone: string
  otpHash: string
  attempts: number
  expiresAt: number
}

const devOtpStore = globalThis as typeof globalThis & {
  __kakeezDevPhoneOtps?: Map<string, DevOtpEntry>
}

function getDevOtpStore(): Map<string, DevOtpEntry> {
  devOtpStore.__kakeezDevPhoneOtps ??= new Map<string, DevOtpEntry>()
  return devOtpStore.__kakeezDevPhoneOtps
}

function canUseAdminClient(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function shouldShowOtpInUi(): boolean {
  return process.env.NODE_ENV !== 'production'
}

function otpSentMessage(otp: string): string {
  return shouldShowOtpInUi()
    ? `Verification code sent. Test OTP: ${otp}`
    : 'Verification code sent.'
}

function normalizePhone(phone: string): string {
  return phone.trim().replace(/[^\d+]/g, '')
}

function hashOtp(userId: string, phone: string, otp: string): string {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${phone}:${otp}:${OTP_PEPPER}`)
    .digest('hex')
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export type PhoneOtpResult =
  | { ok: true; message: string }
  | { ok: false; message: string }

export async function requestPhoneOtp(phoneInput: string): Promise<PhoneOtpResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Please sign in first.' }

  const phone = normalizePhone(phoneInput)
  if (!phone || phone.length < 10) {
    return { ok: false, message: 'Enter a valid phone number first.' }
  }

  const otp = generateOtp()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()
  const otpHash = hashOtp(user.id, phone, otp)

  if (!canUseAdminClient()) {
    getDevOtpStore().set(user.id, {
      phone,
      otpHash,
      attempts: 0,
      expiresAt: Date.now() + OTP_TTL_MINUTES * 60 * 1000,
    })
    await supabase.from('profiles').update({ phone_e164: phone }).eq('id', user.id)
    console.log(`[KAKEEZ TEST OTP - LOCAL MEMORY] user=${user.id} phone=${phone} otp=${otp}`)
    return { ok: true, message: otpSentMessage(otp) }
  }

  const admin = createAdminClient()

  await admin
    .from('phone_verification_otps')
    .update({ consumed_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('consumed_at', null)

  const { error } = await admin.from('phone_verification_otps').insert({
    user_id: user.id,
    phone_e164: phone,
    otp_hash: otpHash,
    expires_at: expiresAt,
  })
  if (error) return { ok: false, message: 'Could not create verification code.' }

  await admin.from('profiles').update({ phone_e164: phone }).eq('id', user.id)

  console.log(`[KAKEEZ TEST OTP] user=${user.id} phone=${phone} otp=${otp}`)
  return { ok: true, message: otpSentMessage(otp) }
}

export async function verifyPhoneOtp(phoneInput: string, otpInput: string): Promise<PhoneOtpResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Please sign in first.' }

  const phone = normalizePhone(phoneInput)
  const otp = otpInput.trim()
  if (!phone || !/^\d{6}$/.test(otp)) {
    return { ok: false, message: 'Enter the 6-digit code.' }
  }

  if (!canUseAdminClient()) {
    const store = getDevOtpStore()
    const row = store.get(user.id)

    if (!row || row.phone !== phone) return { ok: false, message: 'Request a new verification code.' }
    if (row.expiresAt < Date.now()) {
      store.delete(user.id)
      return { ok: false, message: 'That code expired. Request a new one.' }
    }
    if (row.attempts >= 5) {
      store.delete(user.id)
      return { ok: false, message: 'Too many attempts. Request a new code.' }
    }

    const expected = hashOtp(user.id, phone, otp)
    if (expected !== row.otpHash) {
      row.attempts += 1
      store.set(user.id, row)
      return { ok: false, message: 'Incorrect code.' }
    }

    store.delete(user.id)
    const now = new Date().toISOString()
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ phone_e164: phone, phone_verified_at: now })
      .eq('id', user.id)

    if (profileError) return { ok: false, message: 'Could not mark phone as verified.' }
    return { ok: true, message: 'Phone verified.' }
  }

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('phone_verification_otps')
    .select('id, otp_hash, attempts, expires_at, consumed_at')
    .eq('user_id', user.id)
    .eq('phone_e164', phone)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error || !rows?.[0]) return { ok: false, message: 'Request a new verification code.' }

  const row = rows[0] as { id: string; otp_hash: string; attempts: number; expires_at: string; consumed_at: string | null }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, message: 'That code expired. Request a new one.' }
  }
  if (row.attempts >= 5) {
    return { ok: false, message: 'Too many attempts. Request a new code.' }
  }

  const expected = hashOtp(user.id, phone, otp)
  if (expected !== row.otp_hash) {
    await admin.from('phone_verification_otps').update({ attempts: row.attempts + 1 }).eq('id', row.id)
    return { ok: false, message: 'Incorrect code.' }
  }

  const now = new Date().toISOString()
  await admin.from('phone_verification_otps').update({ consumed_at: now }).eq('id', row.id)
  const { error: profileError } = await admin
    .from('profiles')
    .update({ phone_e164: phone, phone_verified_at: now })
    .eq('id', user.id)

  if (profileError) return { ok: false, message: 'Could not mark phone as verified.' }
  return { ok: true, message: 'Phone verified.' }
}
