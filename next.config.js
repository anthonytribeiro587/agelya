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
  // Prevent caching Next.js internal manifests (causes build errors with App Router)
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
  // Offline fallback: serve /offline when a navigation request fails
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    // Cache Google Fonts
    {
      urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    // Cache static assets (JS, CSS, images)
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    // Cache Supabase API responses (stale-while-revalidate for freshness)
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-data',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
  ],
})

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

// Build the list of allowed origins for Server Actions.
// Always includes localhost (dev) and trypronto.app (SaaS).
// Self-hosted: NEXT_PUBLIC_APP_URL is added automatically so server
// actions work when the app is deployed on a custom domain.
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
const appHost = appUrl ? appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : null
const allowedOrigins = ['localhost:3000', '*.trypronto.app']
if (appHost && !allowedOrigins.includes(appHost)) {
  allowedOrigins.push(appHost)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // required for Docker multi-stage build
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
  async redirects() {
    const domain = process.env.APP_DOMAIN
    if (!domain) return []
    // Redirect www → non-www (301 permanent) to fix Soft 404 in Google Search Console
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
