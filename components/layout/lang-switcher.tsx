'use client'

import { useLocale } from 'next-intl'
import { useState } from 'react'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'it', label: 'IT' },
  { code: 'pt', label: 'PT' },
]

export function LangSwitcher() {
  const locale = useLocale()
  const [loading, setLoading] = useState(false)

  async function switchLocale(code: string) {
    if (code === locale || loading) return
    setLoading(true)
    await fetch('/api/user/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: code }),
    })
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <Globe className="w-3.5 h-3.5 text-[#92a098] shrink-0 mr-0.5" />
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          disabled={loading}
          className={cn(
            'text-[11px] font-semibold px-1.5 py-1 rounded-lg transition-colors',
            code === locale
              ? 'text-[#245b3e] bg-[#dfe8db]'
              : 'text-[#98a098] hover:text-[#4f685b] hover:bg-white/60'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
