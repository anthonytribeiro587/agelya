const INTERNAL_ORIGIN = 'https://agelya.internal'

/**
 * Accept only paths inside this application.
 * Reject protocol-relative URLs (//evil.example), absolute URLs, backslashes,
 * control characters and malformed values.
 */
export function safeInternalPath(value: unknown, fallback = '/dashboard') {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()

  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return fallback
  }

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN)
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
