'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronRight, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { completeOnboarding } from './actions'

type Step = 0 | 1 | 2
type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
}

interface Props {
  initialSlug: string
  initialName: string
  isSaas: boolean
  rootDomain: string
}

export function OnboardingWizard({ initialSlug, initialName, isSaas, rootDomain }: Props) {
  const t = useTranslations('onboarding')
  const [step, setStep] = useState<Step>(0)
  const [businessName, setBusinessName] = useState(initialName)
  const [businessType, setBusinessType] = useState('massage')
  const [service, setService] = useState({ name: '', price: '', duration_min: '60' })
  const [slug, setSlug] = useState(initialSlug)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>(isSaas && SLUG_RE.test(initialSlug) ? 'checking' : 'idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const businessTypes = [
    { value: 'massage', label: t('businessTypes.massage') },
    { value: 'salon', label: t('businessTypes.salon') },
    { value: 'other', label: t('businessTypes.other') },
  ]

  const steps = [t('steps.businessType'), t('steps.firstService'), t('steps.notifications')]

  useEffect(() => {
    if (!isSaas) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!slug) {
      setSlugStatus('idle')
      return
    }
    if (!SLUG_RE.test(slug)) {
      setSlugStatus('invalid')
      return
    }

    setSlugStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/check-slug?slug=${encodeURIComponent(slug)}`)
        const data = await response.json()
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [slug, isSaas])

  const canContinue = Boolean(businessName.trim()) && (!isSaas || slugStatus === 'available')

  function changeBusinessName(value: string) {
    setBusinessName(value)
    if (isSaas && !slugManuallyEdited) setSlug(normalizeSlug(value))
  }

  async function finish() {
    setSaving(true)
    setError('')
    try {
      await completeOnboarding({
        bizType: businessType,
        bizName: businessName.trim() || undefined,
        serviceName: service.name,
        servicePrice: Number(service.price),
        serviceDuration: Number(service.duration_min) || 60,
        ...(isSaas ? { slug } : {}),
      })
    } catch {
      setError(t('step2.error'))
      setSaving(false)
    }
  }

  const slugStatusText = {
    idle: '',
    checking: t('step0.slugChecking'),
    available: t('step0.slugAvailable'),
    taken: t('step0.slugTaken'),
    invalid: t('step0.slugInvalid'),
  }[slugStatus]

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold text-gray-900 mb-1">Agelya<span className="text-green-600">.</span></div>
          <p className="text-sm text-gray-500">{t('intro')}</p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-8">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                index < step ? 'bg-green-500 text-white' : index === step ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {index < step ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${index === step ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
              {index < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
          {step === 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('step0.heading')}</h2>
              <p className="text-sm text-gray-500 mb-6">{t('step0.subheading')}</p>

              <label className="text-xs font-medium text-gray-500 block mb-1">{t('step0.bizNameLabel')}</label>
              <input
                value={businessName}
                onChange={(e) => changeBusinessName(e.target.value)}
                placeholder={t('step0.bizNamePlaceholder')}
                maxLength={80}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              <p className="text-xs font-medium text-gray-500 mt-6 mb-3">{t('step0.businessTypeLabel')}</p>
              <div className="grid gap-3">
                {businessTypes.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setBusinessType(item.value)}
                    className={`p-4 rounded-xl border text-sm text-left transition-colors ${
                      businessType === item.value ? 'border-green-500 bg-green-50 text-green-700 font-medium' : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {isSaas && (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <label className="text-xs font-medium text-gray-500 block mb-1">{t('step0.slugLabel')}</label>
                  <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-green-500">
                    <span className="px-3 py-2.5 bg-gray-50 text-sm text-gray-400 border-r border-gray-200">{rootDomain}/</span>
                    <input
                      value={slug}
                      onChange={(e) => { setSlugManuallyEdited(true); setSlug(normalizeSlug(e.target.value)) }}
                      maxLength={30}
                      placeholder="meu-negocio"
                      className="flex-1 min-w-0 px-3 py-2.5 text-sm focus:outline-none"
                    />
                    {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-gray-400 animate-spin mr-3" />}
                  </div>
                  <p className={`mt-1.5 text-xs ${slugStatus === 'available' ? 'text-green-600' : ['taken', 'invalid'].includes(slugStatus) ? 'text-red-500' : 'text-gray-400'}`}>
                    {slugStatusText || t('step0.slugHint')}
                  </p>
                </div>
              )}

              <Button className="w-full mt-6" onClick={() => setStep(1)} disabled={!canContinue}>{t('step0.continue')}</Button>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('step1.heading')}</h2>
              <p className="text-sm text-gray-500 mb-6">{t('step1.subheading')}</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">{t('step1.serviceNameLabel')}</label>
                  <input value={service.name} onChange={(e) => setService((current) => ({ ...current, name: e.target.value }))} placeholder={t('step1.serviceNamePlaceholder')} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">{t('step1.priceLabel')}</label>
                    <input type="number" min={0} value={service.price} onChange={(e) => setService((current) => ({ ...current, price: e.target.value }))} placeholder="0" className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">{t('step1.durationLabel')}</label>
                    <input type="number" min={5} step={5} value={service.duration_min} onChange={(e) => setService((current) => ({ ...current, duration_min: e.target.value }))} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setStep(0)}>{t('step1.back')}</Button>
                <Button variant="ghost" onClick={() => setStep(2)}>{t('step1.skip')}</Button>
                <Button className="flex-1" onClick={() => setStep(2)} disabled={!service.name || !service.price}>{t('step1.continue')}</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{t('step2.heading')}</h2>
              <p className="text-sm text-gray-500 mb-6">{t('step2.subheading')}</p>
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 flex items-start gap-3">
                <div className="text-2xl">💬</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{t('step2.messengerChannel')}</div>
                  <div className="text-xs text-gray-600 mt-1">{t('step2.messengerChannelSub')}</div>
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">{t('step2.messengerChannelStatus')}</span>
              </div>

              {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>{t('step2.back')}</Button>
                <Button className="flex-1" onClick={finish} disabled={saving}>
                  {saving ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('step2.settingUp')}</span> : t('step2.submit')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
