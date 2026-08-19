'use client'

import { useEffect, useState } from 'react'
import { BellRing, Loader2, Send, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export function DailySummarySettings() {
  const t = useTranslations('automations')
  const [enabled, setEnabled] = useState(true)
  const [time, setTime] = useState('19:00')
  const [ownerWhatsapp, setOwnerWhatsapp] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/automations/summary', { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t('summaryLoadError'))
        setEnabled(data.enabled)
        setTime(data.time || '19:00')
        setOwnerWhatsapp(data.ownerWhatsapp || '')
      } catch (err) {
        setMessage({ ok: false, text: err instanceof Error ? err.message : t('summaryLoadError') })
      } finally {
        setLoading(false)
      }
    })()
  }, [t])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/automations/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, time, ownerWhatsapp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('summarySaveError'))
      setMessage({ ok: true, text: t('summarySaved') })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : t('summarySaveError') })
    } finally {
      setSaving(false)
    }
  }

  async function test() {
    setTesting(true)
    setMessage(null)
    try {
      const saveRes = await fetch('/api/automations/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, time, ownerWhatsapp }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || t('summarySaveError'))

      const res = await fetch('/api/automations/summary/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('summaryTestError'))
      setMessage({
        ok: true,
        text: t('summaryTestSuccess', {
          confirmed: data.confirmed ?? 0,
          waiting: data.waiting ?? 0,
          cancelled: data.cancelled ?? 0,
        }),
      })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : t('summaryTestError') })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Loader2 className="w-4 h-4 animate-spin" /> {t('summaryLoading')}
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-5">
      <div className="p-5 border-b border-gray-100 flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <BellRing className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">{t('summaryTitle')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('summaryDescription')}</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">{t('summaryEnable')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('summaryEnableHint')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((value) => !value)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-green-600' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600">{t('summaryPhone')}</label>
            <input
              type="tel"
              value={ownerWhatsapp}
              onChange={(e) => setOwnerWhatsapp(e.target.value)}
              placeholder="+55 51 99999-9999"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">{t('summaryPhoneHint')}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">{t('summaryTime')}</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">{t('summaryTimeHint')}</p>
          </div>
        </div>

        {message && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${message.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {message.text}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={save} disabled={saving || testing}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? t('summarySaving') : t('summarySave')}
          </Button>
          <Button variant="outline" onClick={test} disabled={saving || testing || !ownerWhatsapp}>
            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {testing ? t('summaryTesting') : t('summaryTest')}
          </Button>
        </div>
      </div>
    </section>
  )
}
