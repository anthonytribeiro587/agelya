'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronRight, Loader2, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { AgelyaBrand } from '@/components/brand/agelya-brand'
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
    <div className="agelya-auth min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[.72fr_1.28fr] lg:items-center">
        <aside className="hidden lg:block">
          <AgelyaBrand />
          <p className="mt-10 text-xs font-semibold uppercase tracking-[.2em] text-[#839087]">Primeiros passos</p>
          <h1 className="agelya-serif mt-4 text-[52px] leading-[.98] tracking-[-.04em] text-[#17452f]">
            Prepare seu espaço
            <br />
            para cuidar melhor.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-7 text-[#718078]">
            Em poucos minutos você deixa serviços, agenda e comunicação preparados para começar.
          </p>

          <div className="mt-8 space-y-3">
            {steps.map((label, index) => (
              <div key={label} className="flex items-center gap-3">
                <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${index <= step ? 'bg-[#245b3e] text-[#f8f4eb]' : 'bg-[#e7e1d8] text-[#90958f]'}`}>
                  {index < step ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                </div>
                <span className={`text-sm ${index === step ? 'font-semibold text-[#315744]' : 'text-[#899089]'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <section className="w-full max-w-xl mx-auto">
          <div className="lg:hidden text-center mb-7">
            <AgelyaBrand className="justify-center" />
            <p className="text-sm text-[#7b867f] mt-3">{t('intro')}</p>
          </div>

          <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
            {steps.map((label, index) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${index < step ? 'bg-[#4b7558] text-white' : index === step ? 'bg-[#245b3e] text-white' : 'bg-[#e4ddd3] text-[#9b9c96]'}`}>
                  {index < step ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                </div>
                {index < steps.length - 1 && <ChevronRight className="w-4 h-4 text-[#c8c0b5]" />}
              </div>
            ))}
          </div>

          <div className="agelya-auth-card rounded-[30px] p-6 sm:p-8">
            {step === 0 && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#879188]">Passo 1</p>
                    <h2 className="agelya-serif mt-2 text-[34px] leading-none font-semibold tracking-[-.035em] text-[#17452f]">{t('step0.heading')}</h2>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e1eadf] text-[#376349]">
                    <Sparkles className="h-5 w-5" />
                  </span>
                </div>
                <p className="text-sm text-[#768179] mt-3 mb-7">{t('step0.subheading')}</p>

                <label className="text-xs font-semibold text-[#607268] block mb-1.5">{t('step0.bizNameLabel')}</label>
                <input
                  value={businessName}
                  onChange={(e) => changeBusinessName(e.target.value)}
                  placeholder={t('step0.bizNamePlaceholder')}
                  maxLength={80}
                  className="w-full border border-[#dfd5c9] bg-[#fffdf9] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7d9d84]/30"
                />

                <p className="text-xs font-semibold text-[#607268] mt-6 mb-3">{t('step0.businessTypeLabel')}</p>
                <div className="grid gap-3">
                  {businessTypes.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setBusinessType(item.value)}
                      className={`p-4 rounded-2xl border text-sm text-left transition-all ${businessType === item.value ? 'border-[#9ab19c] bg-[#edf4eb] text-[#2d5d42] font-semibold shadow-[0_8px_24px_rgba(49,88,64,.06)]' : 'border-[#e3d9cd] bg-[#fffdf9] hover:border-[#cfc2b3] text-[#53675d]'}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {isSaas && (
                  <div className="mt-6 pt-5 border-t border-[#ece4da]">
                    <label className="text-xs font-semibold text-[#607268] block mb-1.5">{t('step0.slugLabel')}</label>
                    <div className="flex items-center rounded-xl border border-[#dfd5c9] overflow-hidden focus-within:ring-2 focus-within:ring-[#7d9d84]/30 bg-[#fffdf9]">
                      <span className="px-3 py-3 bg-[#f3eee7] text-sm text-[#969b96] border-r border-[#e3d9cd]">{rootDomain}/</span>
                      <input
                        value={slug}
                        onChange={(e) => { setSlugManuallyEdited(true); setSlug(normalizeSlug(e.target.value)) }}
                        maxLength={30}
                        placeholder="meu-negocio"
                        className="flex-1 min-w-0 px-3 py-3 text-sm focus:outline-none bg-transparent"
                      />
                      {slugStatus === 'checking' && <Loader2 className="w-4 h-4 text-[#899188] animate-spin mr-3" />}
                    </div>
                    <p className={`mt-1.5 text-xs ${slugStatus === 'available' ? 'text-[#3b734f]' : ['taken', 'invalid'].includes(slugStatus) ? 'text-[#a64f48]' : 'text-[#9a9b96]'}`}>
                      {slugStatusText || t('step0.slugHint')}
                    </p>
                  </div>
                )}

                <Button size="lg" className="w-full mt-7" onClick={() => setStep(1)} disabled={!canContinue}>{t('step0.continue')}</Button>
              </div>
            )}

            {step === 1 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#879188]">Passo 2</p>
                <h2 className="agelya-serif mt-2 text-[34px] leading-none font-semibold tracking-[-.035em] text-[#17452f]">{t('step1.heading')}</h2>
                <p className="text-sm text-[#768179] mt-3 mb-7">{t('step1.subheading')}</p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-[#607268]">{t('step1.serviceNameLabel')}</label>
                    <input value={service.name} onChange={(e) => setService((current) => ({ ...current, name: e.target.value }))} placeholder={t('step1.serviceNamePlaceholder')} className="w-full mt-1.5 border border-[#dfd5c9] bg-[#fffdf9] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7d9d84]/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[#607268]">{t('step1.priceLabel')}</label>
                      <input type="number" min={0} value={service.price} onChange={(e) => setService((current) => ({ ...current, price: e.target.value }))} placeholder="0" className="w-full mt-1.5 border border-[#dfd5c9] bg-[#fffdf9] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7d9d84]/30" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#607268]">{t('step1.durationLabel')}</label>
                      <input type="number" min={5} step={5} value={service.duration_min} onChange={(e) => setService((current) => ({ ...current, duration_min: e.target.value }))} className="w-full mt-1.5 border border-[#dfd5c9] bg-[#fffdf9] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7d9d84]/30" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-7">
                  <Button variant="outline" onClick={() => setStep(0)}>{t('step1.back')}</Button>
                  <Button variant="ghost" onClick={() => setStep(2)}>{t('step1.skip')}</Button>
                  <Button className="flex-1" onClick={() => setStep(2)} disabled={!service.name || !service.price}>{t('step1.continue')}</Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#879188]">Passo 3</p>
                <h2 className="agelya-serif mt-2 text-[34px] leading-none font-semibold tracking-[-.035em] text-[#17452f]">{t('step2.heading')}</h2>
                <p className="text-sm text-[#768179] mt-3 mb-7">{t('step2.subheading')}</p>

                <div className="p-4 rounded-2xl bg-[#edf4eb] border border-[#d8e5d6] flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#dce8da] text-xl">💬</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[#315641]">{t('step2.messengerChannel')}</div>
                    <div className="text-xs text-[#68786f] mt-1 leading-5">{t('step2.messengerChannelSub')}</div>
                  </div>
                  <span className="text-xs text-[#728078] whitespace-nowrap">{t('step2.messengerChannelStatus')}</span>
                </div>

                {error && <div className="mt-4 bg-[#f8e8e5] border border-[#ebcbc7] text-[#8a4842] text-sm rounded-xl px-4 py-3">{error}</div>}

                <div className="flex gap-3 mt-7">
                  <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>{t('step2.back')}</Button>
                  <Button className="flex-1" onClick={finish} disabled={saving}>
                    {saving ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('step2.settingUp')}</span> : t('step2.submit')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
