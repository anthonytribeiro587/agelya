import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import 'react-phone-number-input/style.css'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Agelya — Agenda e gestão para beleza e bem-estar',
  description:
    'Agenda, clientes, serviços, caixa e relacionamento para profissionais de beleza, bem-estar e terapias.',
  keywords: [
    'agenda online',
    'massoterapia',
    'gestão de clientes',
    'agendamento online',
    'estética',
    'beleza e bem-estar',
  ],
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Agelya',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Agelya — Agenda e gestão para beleza e bem-estar',
    description: 'Organize agenda, clientes, serviços e relacionamento em um só lugar.',
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agelya',
    description: 'Agenda e gestão para profissionais de beleza, bem-estar e terapias.',
  },
}

export const viewport: Viewport = {
  themeColor: '#245b3e',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
