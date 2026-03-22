import { NextResponse } from 'next/server'
import { getRegistrationPolicy } from '@/lib/auth-policy'

export async function GET() {
  const policy = getRegistrationPolicy()

  return NextResponse.json({
    registrationEnabled: policy.enabled,
    hasAllowlist: policy.allowedEmails.size > 0 || policy.allowedDomains.size > 0,
  })
}
