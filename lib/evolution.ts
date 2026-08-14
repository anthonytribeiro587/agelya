export interface EvolutionCredentials {
  apiUrl: string
  apiKey: string
  instance: string
}

export function normalizeEvolutionPhone(value: string) {
  return String(value ?? '').replace(/\D/g, '')
}

export function normalizeEvolutionUrl(value: string) {
  return value.trim().replace(/\/+$/, '')
}

export function isAllowedEvolutionUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return false
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false
    const m = host.match(/^172\.(\d+)\./)
    if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return false
    if (/^169\.254\./.test(host)) return false
    return true
  } catch {
    return false
  }
}

function headers(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    apikey: apiKey,
  }
}

export async function getEvolutionConnectionState(credentials: EvolutionCredentials) {
  const apiUrl = normalizeEvolutionUrl(credentials.apiUrl)
  const response = await fetch(
    `${apiUrl}/instance/connectionState/${encodeURIComponent(credentials.instance)}`,
    {
      method: 'GET',
      headers: headers(credentials.apiKey),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    }
  )

  const raw = await response.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = null }

  if (!response.ok) {
    throw new Error(`Evolution API ${response.status}: ${raw.slice(0, 300) || response.statusText}`)
  }

  return {
    state: String(data?.instance?.state ?? data?.state ?? 'unknown'),
    data,
  }
}

export async function sendEvolutionText(
  credentials: EvolutionCredentials,
  number: string,
  text: string
) {
  const apiUrl = normalizeEvolutionUrl(credentials.apiUrl)
  const recipient = normalizeEvolutionPhone(number)
  if (recipient.length < 10) throw new Error('Número de WhatsApp inválido')

  const endpoint = `${apiUrl}/message/sendText/${encodeURIComponent(credentials.instance)}`
  const request = async (body: unknown) => fetch(endpoint, {
    method: 'POST',
    headers: headers(credentials.apiKey),
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  // Current Evolution API payload.
  let response = await request({
    number: recipient,
    textMessage: { text },
  })

  // Compatibility with older Evolution API installations used by previous
  // Agelya/Agenda projects, which accepted { number, text }.
  if (response.status === 400 || response.status === 422) {
    response = await request({ number: recipient, text })
  }

  if (!response.ok) {
    const details = (await response.text().catch(() => '')).slice(0, 300)
    throw new Error(`Evolution API ${response.status}: ${details || response.statusText}`)
  }

  return true
}
