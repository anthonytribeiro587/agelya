export function hasSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true // Non-browser/internal calls may omit Origin.

  try {
    const requestUrl = new URL(request.url)
    const originUrl = new URL(origin)
    return requestUrl.origin === originUrl.origin
  } catch {
    return false
  }
}
