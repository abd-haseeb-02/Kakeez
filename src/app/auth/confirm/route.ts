// Landing point for signup confirmation, magic link, email change and invite
// links. Password recovery has its own landing route — see
// src/app/auth/recover/route.ts for why it can't share this one's default.
//
// All the redemption logic lives in src/lib/auth/confirm.ts.

import { type NextRequest } from 'next/server'
import { redeemAuthLink } from '@/lib/auth/confirm'

export async function GET(request: NextRequest) {
  // '/' is only the fallback: these templates all carry their own `next`
  // (confirm-signup lands on the homepage, email-change and invite on the
  // profile), and an explicit one wins.
  return redeemAuthLink(request, { defaultNext: '/' })
}
