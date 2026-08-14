import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // SaaS subdomain routing: rewrite tenant.example.com/book -> /book/tenant
  if (process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'saas' && pathname === '/book') {
    const hostname = request.headers.get('host') ?? ''
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'trypronto.app'
    const escapedRoot = rootDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = hostname.match(new RegExp(`^([a-z0-9-]+)\\.${escapedRoot}(?::\\d+)?$`))
    const tenantSlug = match?.[1]

    if (tenantSlug && tenantSlug !== 'www') {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = `/book/${tenantSlug}`
      return NextResponse.rewrite(rewriteUrl)
    }
  }

  // Preserve the current pathname for server layouts that need it.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Supabase email confirmation still enters through /?code=...
  const code = searchParams.get('code')
  if (code && pathname === '/') {
    const callbackUrl = request.nextUrl.clone()
    callbackUrl.pathname = '/auth/callback'
    return NextResponse.redirect(callbackUrl)
  }

  // Auth protection is intentionally handled in server layouts/pages.
  // Keeping Supabase out of Edge middleware avoids Node-only dependencies
  // being bundled into Vercel Routing Middleware.

  // Auto-detect dashboard locale on first visit.
  if (!request.cookies.get('dashboard_locale')?.value) {
    const acceptLang = request.headers.get('accept-language') ?? ''
    const lang = acceptLang.toLowerCase()
    const detected = lang.startsWith('pt')
      ? 'pt'
      : lang.startsWith('es')
        ? 'es'
        : lang.startsWith('it')
          ? 'it'
          : null

    if (detected) {
      response.cookies.set('dashboard_locale', detected, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      })
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
