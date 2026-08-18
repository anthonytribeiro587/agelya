'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { EvolutionSettings } from './evolution-settings'

interface Business {
  id: string
  name: string
  slug: string
  type: string | null
  phone: string | null
  email: string | null
  address: string | null
  timezone: string
  currency: string
  brand_color: string | null
  notification_language: string | null
}

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration_min: number
  category: string | null
  is_active: boolean
  capacity: number
}

interface Employee {
  id: string
  name: string
  role: string
  email: string | null
  phone: string | null
  is_active: boolean
}

interface DayHours {
  day_of_week: number
  is_open: boolean
  open_time: string
  close_time: string
}

interface Props {
  business: Business
  services: Service[]
  employees: Employee[]
  workingHours: DayHours[]
  userEmail: string
}

type Tab = 'general' | 'services' | 'employees' | 'notifications' | 'account'

const DEFAULT_HOURS: DayHours[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day_of_week: day,
  is_open: day >= 1 && day <= 5,
  open_time: '09:00',
  close_time: '19:00',
}))

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2)
  const minute = i % 2 === 0 ? '00' : '30'
  return `${String(hour).padStart(2, '0')}:${minute}`
})

const CURRENCIES = [
  { value: 'BRL', label: '🇧🇷 BRL — R$' },
  { value: 'AUD', label: '🇦🇺 AUD — A$' },
  { value: 'USD', label: '🇺🇸 USD — US$' },
  { value: 'EUR', label: '🇪🇺 EUR — €' },
  { value: 'GBP', label: '🇬🇧 GBP — £' },
]

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: '🇧🇷 São Paulo (UTC−3)' },
  { value: 'Australia/Brisbane', label: '🇦🇺 Brisbane / Gold Coast (UTC+10)' },
  { value: 'Australia/Sydney', label: '🇦🇺 Sydney' },
  { value: 'Australia/Melbourne', label: '🇦🇺 Melbourne' },
  { value: 'Europe/Lisbon', label: '🇵🇹 Lisboa' },
  { value: 'Europe/London', label: '🇬🇧 London' },
  { value: 'America/New_York', label: '🇺🇸 New York' },
  { value: 'UTC', label: 'UTC' },
]

const clean = (value: string | null | undefined, max = 500) => value?.trim().slice(0, max) ?? ''

export function SettingsTabs({
  business: initialBusiness,
  services: initialServices,
  employees: initialEmployees,
  workingHours: initialHours,
  userEmail,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('settings')

  const requestedTab = searchParams.get('tab')
  const initialTab: Tab = ['general', 'services', 'employees', 'notifications', 'account'].includes(requestedTab ?? '')
    ? requestedTab as Tab
    : 'general'

  const [tab, setTab] = useState<Tab>(initialTab)
  const [business, setBusiness] = useState(initialBusiness)
  const [services, setServices] = useState(initialServices)
  const [employees, setEmployees] = useState(initialEmployees)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [origin, setOrigin] = useState('')

  const [serviceForm, setServiceForm] = useState<Partial<Service>>({ duration_min: 60, capacity: 1 })
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null)

  const [employeeForm, setEmployeeForm] = useState<Partial<Employee>>({ role: 'professional' })
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null)

  const [hours, setHours] = useState<DayHours[]>(() => DEFAULT_HOURS.map((fallback) => (
    initialHours.find((item) => item.day_of_week === fallback.day_of_week) ?? fallback
  )))
  const [savingHours, setSavingHours] = useState(false)
  const [hoursSaved, setHoursSaved] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [emailMessage, setEmailMessage] = useState('')
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [passwordMessage, setPasswordMessage] = useState('')

  useEffect(() => setOrigin(window.location.origin), [])

  const bookingUrl = useMemo(
    () => origin ? `${origin}/book/${business.slug}` : `/book/${business.slug}`,
    [origin, business.slug]
  )

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: t('tabs.general') },
    { key: 'services', label: t('tabs.services') },
    { key: 'employees', label: t('tabs.employees') },
    { key: 'notifications', label: t('tabs.notifications') },
    { key: 'account', label: t('tabs.account') },
  ]

  function normalizeSlug(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
  }

  async function saveBusiness() {
    setSaving(true)
    const next = {
      name: clean(business.name, 100),
      slug: normalizeSlug(business.slug),
      type: business.type,
      phone: clean(business.phone, 30) || null,
      email: clean(business.email, 160) || null,
      address: clean(business.address, 240) || null,
      timezone: business.timezone || 'America/Sao_Paulo',
      currency: business.currency || 'BRL',
      brand_color: business.brand_color || '#16a34a',
      notification_language: business.notification_language || 'pt',
    }

    const { error } = await supabase.from('businesses').update(next).eq('id', business.id)
    setSaving(false)
    if (!error) {
      setBusiness((current) => ({ ...current, ...next }))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1800)
      router.refresh()
    }
  }

  function updateDay(day: number, patch: Partial<DayHours>) {
    setHours((current) => current.map((item) => item.day_of_week === day ? { ...item, ...patch } : item))
  }

  async function saveWorkingHours() {
    setSavingHours(true)
    const rows = hours.map((item) => ({ ...item, business_id: business.id }))
    const { error } = await supabase.from('business_hours').upsert(rows, { onConflict: 'business_id,day_of_week' })
    setSavingHours(false)
    if (!error) {
      setHoursSaved(true)
      window.setTimeout(() => setHoursSaved(false), 1800)
    }
  }

  function resetServiceForm() {
    setServiceForm({ duration_min: 60, capacity: 1 })
    setEditingServiceId(null)
  }

  async function saveService() {
    const name = clean(serviceForm.name, 100)
    if (!name || serviceForm.price == null) return

    const payload = {
      name,
      description: clean(serviceForm.description, 500) || null,
      price: Number(serviceForm.price),
      duration_min: Math.max(5, Number(serviceForm.duration_min) || 60),
      category: clean(serviceForm.category, 100) || null,
      capacity: Math.max(1, Number(serviceForm.capacity) || 1),
      is_active: serviceForm.is_active ?? true,
    }

    if (editingServiceId) {
      const { data } = await supabase.from('services').update(payload).eq('id', editingServiceId).select().single()
      if (data) setServices((current) => current.map((item) => item.id === editingServiceId ? data as Service : item))
    } else {
      const { data } = await supabase.from('services').insert({ business_id: business.id, ...payload }).select().single()
      if (data) setServices((current) => [...current, data as Service])
    }

    resetServiceForm()
    router.refresh()
  }

  function editService(service: Service) {
    setEditingServiceId(service.id)
    setServiceForm(service)
  }

  async function deleteService(id: string) {
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (!error) setServices((current) => current.filter((item) => item.id !== id))
    setDeleteServiceId(null)
    router.refresh()
  }

  function resetEmployeeForm() {
    setEmployeeForm({ role: 'professional' })
    setEditingEmployeeId(null)
  }

  async function saveEmployee() {
    const name = clean(employeeForm.name, 100)
    if (!name) return

    const payload = {
      name,
      role: clean(employeeForm.role, 80) || 'professional',
      email: clean(employeeForm.email, 160) || null,
      phone: clean(employeeForm.phone, 30) || null,
      is_active: employeeForm.is_active ?? true,
    }

    if (editingEmployeeId) {
      const { data } = await supabase.from('employees').update(payload).eq('id', editingEmployeeId).select().single()
      if (data) setEmployees((current) => current.map((item) => item.id === editingEmployeeId ? data as Employee : item))
    } else {
      const { data } = await supabase.from('employees').insert({ business_id: business.id, ...payload }).select().single()
      if (data) setEmployees((current) => [...current, data as Employee])
    }

    resetEmployeeForm()
    router.refresh()
  }

  function editEmployee(employee: Employee) {
    setEditingEmployeeId(employee.id)
    setEmployeeForm(employee)
  }

  async function deleteEmployee(id: string) {
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (!error) setEmployees((current) => current.filter((item) => item.id !== id))
    setDeleteEmployeeId(null)
    router.refresh()
  }

  async function changeEmail() {
    if (!newEmail.includes('@')) {
      setEmailStatus('error')
      setEmailMessage(t('account.emailInvalid'))
      return
    }

    setEmailStatus('loading')
    setEmailMessage('')
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      setEmailStatus('error')
      setEmailMessage(error.message)
      return
    }

    setEmailStatus('ok')
    setEmailMessage(t('account.emailConfirmSent', { email: newEmail }))
    setNewEmail('')
  }

  async function changePassword() {
    if (passwordForm.password.length < 8) {
      setPasswordStatus('error')
      setPasswordMessage(t('account.pwMinLength'))
      return
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordStatus('error')
      setPasswordMessage(t('account.pwNoMatch'))
      return
    }

    setPasswordStatus('loading')
    setPasswordMessage('')
    const { error } = await supabase.auth.updateUser({ password: passwordForm.password })
    if (error) {
      setPasswordStatus('error')
      setPasswordMessage(error.message)
      return
    }

    setPasswordStatus('ok')
    setPasswordMessage(t('account.pwSuccess'))
    setPasswordForm({ password: '', confirm: '' })
  }

  return (
    <div className="p-3 sm:p-6 max-w-4xl">
      <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap gap-1 bg-gray-100 p-1 rounded-lg mb-6 [&::-webkit-scrollbar]:hidden">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === item.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4">{t('general.heading')}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('general.fields.name')}>
                <input value={business.name} onChange={(e) => setBusiness((current) => ({ ...current, name: e.target.value }))} className="input" />
              </Field>
              <Field label={t('general.typeLabel')}>
                <select value={business.type ?? ''} onChange={(e) => setBusiness((current) => ({ ...current, type: e.target.value || null }))} className="input">
                  <option value="">{t('general.typeDefault')}</option>
                  <option value="massage">{t('general.types.massage')}</option>
                  <option value="salon">{t('general.types.salon')}</option>
                  <option value="other">{t('general.types.other')}</option>
                </select>
              </Field>
              <Field label={t('general.fields.phone')}>
                <input type="tel" value={business.phone ?? ''} onChange={(e) => setBusiness((current) => ({ ...current, phone: e.target.value }))} className="input" />
              </Field>
              <Field label={t('general.fields.email')}>
                <input type="email" value={business.email ?? ''} onChange={(e) => setBusiness((current) => ({ ...current, email: e.target.value }))} className="input" />
              </Field>
              <Field label={t('general.fields.address')} className="sm:col-span-2">
                <input value={business.address ?? ''} onChange={(e) => setBusiness((current) => ({ ...current, address: e.target.value }))} className="input" />
              </Field>
              <Field label={t('general.fields.timezone')}>
                <select value={business.timezone || 'America/Sao_Paulo'} onChange={(e) => setBusiness((current) => ({ ...current, timezone: e.target.value }))} className="input">
                  {TIMEZONES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              <Field label={t('general.fields.currency')}>
                <select value={business.currency || 'BRL'} onChange={(e) => setBusiness((current) => ({ ...current, currency: e.target.value }))} className="input">
                  {CURRENCIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              <Field label={t('general.notificationLanguageLabel')}>
                <select value={business.notification_language || 'pt'} onChange={(e) => setBusiness((current) => ({ ...current, notification_language: e.target.value }))} className="input">
                  <option value="pt">Português</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">{t('general.notificationLanguageHint')}</p>
              </Field>
              <Field label={t('general.brandColorLabel')}>
                <div className="flex gap-2 mt-1">
                  <input type="color" value={business.brand_color || '#16a34a'} onChange={(e) => setBusiness((current) => ({ ...current, brand_color: e.target.value }))} className="h-10 w-12 rounded border border-gray-200 bg-white p-1" />
                  <input value={business.brand_color || '#16a34a'} onChange={(e) => setBusiness((current) => ({ ...current, brand_color: e.target.value }))} className="input mt-0 flex-1" />
                </div>
              </Field>
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100">
              <label className="text-xs font-medium text-gray-500">{t('general.bookingUrlLabel')}</label>
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <div className="flex-1 flex rounded-lg border border-gray-200 overflow-hidden">
                  <span className="px-3 py-2 bg-gray-50 text-sm text-gray-400 border-r border-gray-200">/book/</span>
                  <input value={business.slug} onChange={(e) => setBusiness((current) => ({ ...current, slug: normalizeSlug(e.target.value) }))} className="flex-1 min-w-0 px-3 py-2 text-sm outline-none" />
                </div>
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 text-center">
                  {t('general.logoUploadArea') === 'Upload area' ? 'Open' : 'Abrir'}
                </a>
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('general.slugHint')}</p>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button onClick={saveBusiness} disabled={saving || !business.name || !business.slug}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {saved ? t('general.saved') : t('general.saveButton')}
              </Button>
              {saved && <Check className="w-4 h-4 text-green-600" />}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4">{t('workingHours.heading')}</h2>
            <div className="space-y-3">
              {hours.map((item) => (
                <div key={item.day_of_week} className="grid grid-cols-[58px_1fr] sm:grid-cols-[70px_90px_1fr] items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{t.raw('workingHours.dayNames')[item.day_of_week]}</span>
                  <label className="flex items-center gap-2 text-xs text-gray-500">
                    <input type="checkbox" checked={item.is_open} onChange={(e) => updateDay(item.day_of_week, { is_open: e.target.checked })} />
                    {item.is_open ? t('workingHours.from') : t('workingHours.closed')}
                  </label>
                  {item.is_open && (
                    <div className="flex items-center gap-2 col-span-2 sm:col-span-1 ml-[70px] sm:ml-0">
                      <select value={item.open_time.slice(0, 5)} onChange={(e) => updateDay(item.day_of_week, { open_time: e.target.value })} className="input mt-0 py-1.5">
                        {TIME_OPTIONS.map((time) => <option key={time}>{time}</option>)}
                      </select>
                      <span className="text-xs text-gray-400">{t('workingHours.to')}</span>
                      <select value={item.close_time.slice(0, 5)} onChange={(e) => updateDay(item.day_of_week, { close_time: e.target.value })} className="input mt-0 py-1.5">
                        {TIME_OPTIONS.map((time) => <option key={time}>{time}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-5" onClick={saveWorkingHours} disabled={savingHours}>
              {savingHours && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {hoursSaved ? t('workingHours.saved') : t('workingHours.saveButton')}
            </Button>
          </section>
        </div>
      )}

      {tab === 'services' && (
        <section className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {services.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">{t('services.empty')}</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {services.map((service) => (
                  <div key={service.id} className="p-4 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-gray-900">{service.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {service.duration_min} min · {new Intl.NumberFormat(undefined, { style: 'currency', currency: business.currency || 'BRL' }).format(service.price)}
                      </div>
                    </div>
                    <button onClick={() => editService(service)} className="p-2 rounded-lg hover:bg-gray-100"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    {deleteServiceId === service.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteService(service.id)} className="text-xs px-2 py-1 rounded bg-red-600 text-white">{t('services.deleteYes')}</button>
                        <button onClick={() => setDeleteServiceId(null)} className="text-xs px-2 py-1 rounded border">{t('services.deleteNo')}</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteServiceId(service.id)} className="p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4">{editingServiceId ? t('services.editHeading') : t('services.addHeading')}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('services.fields.name')}>
                <input value={serviceForm.name ?? ''} onChange={(e) => setServiceForm((current) => ({ ...current, name: e.target.value }))} className="input" />
              </Field>
              <Field label={t('services.fields.category')}>
                <input value={serviceForm.category ?? ''} onChange={(e) => setServiceForm((current) => ({ ...current, category: e.target.value }))} className="input" />
              </Field>
              <Field label={t('services.fields.price')}>
                <input type="number" min="0" step="0.01" value={serviceForm.price ?? ''} onChange={(e) => setServiceForm((current) => ({ ...current, price: Number(e.target.value) }))} className="input" />
              </Field>
              <Field label={t('services.fields.duration')}>
                <input type="number" min="5" step="5" value={serviceForm.duration_min ?? 60} onChange={(e) => setServiceForm((current) => ({ ...current, duration_min: Number(e.target.value) }))} className="input" />
              </Field>
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={saveService} disabled={!serviceForm.name || serviceForm.price == null}>
                <Plus className="w-4 h-4 mr-2" />{editingServiceId ? t('services.updateButton') : t('services.addButton')}
              </Button>
              {editingServiceId && <Button variant="outline" onClick={resetServiceForm}>{t('services.cancelButton')}</Button>}
            </div>
          </div>
        </section>
      )}

      {tab === 'employees' && (
        <section className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {employees.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">{t('employees.empty')}</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {employees.map((employee) => (
                  <div key={employee.id} className="p-4 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-gray-900">{employee.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{employee.role}{employee.phone ? ` · ${employee.phone}` : ''}</div>
                    </div>
                    <button onClick={() => editEmployee(employee)} className="p-2 rounded-lg hover:bg-gray-100"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    {deleteEmployeeId === employee.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => deleteEmployee(employee.id)} className="text-xs px-2 py-1 rounded bg-red-600 text-white">{t('employees.deleteYes')}</button>
                        <button onClick={() => setDeleteEmployeeId(null)} className="text-xs px-2 py-1 rounded border">{t('employees.deleteNo')}</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteEmployeeId(employee.id)} className="p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4">{editingEmployeeId ? t('employees.editHeading') : t('employees.addHeading')}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('employees.fields.name')}>
                <input value={employeeForm.name ?? ''} onChange={(e) => setEmployeeForm((current) => ({ ...current, name: e.target.value }))} className="input" />
              </Field>
              <Field label={t('employees.fields.role')}>
                <input value={employeeForm.role ?? ''} onChange={(e) => setEmployeeForm((current) => ({ ...current, role: e.target.value }))} className="input" />
              </Field>
              <Field label={t('employees.fields.email')}>
                <input type="email" value={employeeForm.email ?? ''} onChange={(e) => setEmployeeForm((current) => ({ ...current, email: e.target.value }))} className="input" />
              </Field>
              <Field label={t('employees.fields.phone')}>
                <input type="tel" value={employeeForm.phone ?? ''} onChange={(e) => setEmployeeForm((current) => ({ ...current, phone: e.target.value }))} className="input" />
              </Field>
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={saveEmployee} disabled={!employeeForm.name}>
                <Plus className="w-4 h-4 mr-2" />{editingEmployeeId ? t('employees.updateButton') : t('employees.addButton')}
              </Button>
              {editingEmployeeId && <Button variant="outline" onClick={resetEmployeeForm}>{t('employees.cancelButton')}</Button>}
            </div>
          </div>
        </section>
      )}

      {tab === 'notifications' && <EvolutionSettings />}

      {tab === 'account' && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4">{t('account.heading')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('account.currentEmailLabel')}: <strong className="text-gray-700">{userEmail}</strong></p>
            <Field label={t('account.newEmailLabel')}>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t('account.newEmailPlaceholder')} className="input" />
            </Field>
            <Button className="mt-3" variant="outline" onClick={changeEmail} disabled={emailStatus === 'loading' || !newEmail}>
              {emailStatus === 'loading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('account.changeEmailButton')}
            </Button>
            {emailMessage && <StatusMessage status={emailStatus} text={emailMessage} />}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
            <h2 className="font-semibold text-gray-900 mb-4">{t('account.passwordHeading')}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label={t('account.newPasswordLabel')}>
                <div className="relative mt-1">
                  <input type={showPassword ? 'text' : 'password'} value={passwordForm.password} onChange={(e) => setPasswordForm((current) => ({ ...current, password: e.target.value }))} className="input mt-0 pr-10" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
              <Field label={t('account.confirmPasswordLabel')}>
                <input type={showPassword ? 'text' : 'password'} value={passwordForm.confirm} onChange={(e) => setPasswordForm((current) => ({ ...current, confirm: e.target.value }))} placeholder={t('account.confirmPasswordPlaceholder')} className="input" />
              </Field>
            </div>
            <Button className="mt-3" onClick={changePassword} disabled={passwordStatus === 'loading' || !passwordForm.password || !passwordForm.confirm}>
              {passwordStatus === 'loading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('account.changePasswordButton')}
            </Button>
            {passwordMessage && <StatusMessage status={passwordStatus} text={passwordMessage} />}
          </section>
        </div>
      )}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          margin-top: 0.25rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          background: white;
          outline: none;
        }
        :global(.input:focus) {
          border-color: rgb(34 197 94);
          box-shadow: 0 0 0 2px rgb(34 197 94 / 0.15);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function StatusMessage({ status, text }: { status: 'idle' | 'loading' | 'ok' | 'error'; text: string }) {
  return (
    <p className={`text-sm mt-3 ${status === 'error' ? 'text-red-600' : status === 'ok' ? 'text-green-600' : 'text-gray-500'}`}>
      {text}
    </p>
  )
}
