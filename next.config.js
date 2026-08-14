const createNextIntlPlugin = require('next-intl/plugin')

// next-pwa relies on Node-specific globals during its generated runtime bundle.
// On Vercel, middleware runs on the Edge Runtime, where globals such as
// __dirname are not available. Keep PWA enabled for normal self-hosted/Docker
// production builds, but disable it automatically on Vercel and whenever
// DISABLE_PWA=true is explicitly provided.
const disablePWA =
  process.env.NODE_ENV === 'development' ||
  process.env.VERCEL === '1' ||
  process.env.DISABLE_PWA === 'true'

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: disablePWA,
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    // Do not cache Supabase REST/auth responses. They can contain tenant or
    // client data and should always be obtained from the authenticated network.
  ],
})

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
const appHost = appUrl ? appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : null
const allowedOrigins = ['localhost:3000', '*.trypronto.app']
if (appHost && !allowedOrigins.includes(appHost)) {
  allowedOrigins.push(appHost)
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  async redirects() {
    const domain = process.env.APP_DOMAIN
    if (!domain) return []
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: `www.${domain}` }],
        destination: `https://${domain}/:path*`,
        permanent: true,
      },
    ]
  },
}

module.exports = withPWA(withNextIntl(nextConfig))
