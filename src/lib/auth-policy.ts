type RegistrationAccessResult = {
  allowed: boolean
  reason: 'allowed' | 'disabled' | 'not_allowlisted'
}

type RegistrationPolicy = {
  enabled: boolean
  allowedEmails: Set<string>
  allowedDomains: Set<string>
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function getRegistrationPolicy(): RegistrationPolicy {
  const enabled = process.env.AUTH_REGISTRATION_ENABLED === 'true'
  const allowedEmails = new Set(parseCsv(process.env.AUTH_ALLOWED_EMAILS))
  const allowedDomains = new Set(parseCsv(process.env.AUTH_ALLOWED_DOMAINS))

  return {
    enabled,
    allowedEmails,
    allowedDomains,
  }
}

export function checkRegistrationAccess(rawEmail: string): RegistrationAccessResult {
  const email = rawEmail.trim().toLowerCase()
  const policy = getRegistrationPolicy()

  if (!policy.enabled) {
    return { allowed: false, reason: 'disabled' }
  }

  if (policy.allowedEmails.size === 0 && policy.allowedDomains.size === 0) {
    return { allowed: true, reason: 'allowed' }
  }

  if (policy.allowedEmails.has(email)) {
    return { allowed: true, reason: 'allowed' }
  }

  const domain = email.split('@')[1]?.toLowerCase() || ''
  if (domain && policy.allowedDomains.has(domain)) {
    return { allowed: true, reason: 'allowed' }
  }

  return { allowed: false, reason: 'not_allowlisted' }
}

export function isRegistrationEnabledForUi(): boolean {
  const policy = getRegistrationPolicy()
  return policy.enabled
}
