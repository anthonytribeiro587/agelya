'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CalendarDays, Clock, DollarSign, Pencil, Trash2, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, formatInBusinessTimezone } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'

interface Appointment {
  id: string
  starts_at: string
  ends_at: string
  status: string
  price: number | null
  services: { name: string } | null
  employees: { name: string } | null
}

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  birthday: string | null
  notes: string | null
  tags: string[]
  total_visits: number
  total_spent: number
  last_visit_at: string | null
  created_at: string
  whatsapp_number: string | null
}

interface Props {
  client: Client
  appointments: Appointment[]
  currency: string
  timezone: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  no_show: 'bg-gray-100 text-gray-500',
}

function phoneIsValid(phone: string) {
  if (!phone) return true
  if (!/^[\d\s+\-()]+$/.test(phone)) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

function birthdayIsValid(birthday: string) {
  if (!birthday) return true
  const date = new Date(`${birthday}T00:00:00`)
  return !Number.isNaN(date.getTime()) && date.getFullYear() >= 1900 && date <= new Date()
}

export function ClientDetailView({ client: initial, appointments, currency, timezone }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const t = useTranslations('clientDetail')
  const [client, setClient] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [errors, setErrors] = useState<{ phone?: string; whatsapp?: string; birthday?: string }>({})
  const [form, setForm] = useState({
    name: initial.name,
    phone: initial.phone ?? '',
    email: initial.email ?? '',
    birthday: initial.birthday ?? '',
    notes: initial.notes ?? '',
    tags: initial.tags.join(', '),
    whatsapp_number: initial.whatsapp_number ?? '',
  })

  async function save() {
    const nextErrors: typeof errors = {}
    if (!phoneIsValid(form.phone)) nextErrors.phone = t('phoneInvalid')
    if (!phoneIsValid(form.whatsapp_number)) nextErrors.whatsapp = t('phoneInvalid')
    if (!birthdayIsValid(form.birthday)) nextErrors.birthday = t('dateInvalid')
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setSaving(true)
    const tags = form.tags.split(',').map((value) => value.trim()).filter(Boolean)
    const { data } = await supabase
      .from('clients')
      .update({
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        birthday: form.birthday || null,
        notes: form.notes || null,
        tags,
        whatsapp_number: form.whatsapp_number || null,
      })
      .eq('id', client.id)
      .select()
      .single()

    if (data) setClient({ ...client, ...data })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  async function deleteClient() {
    await supabase.from('clients').delete().eq('id', client.id)
    window.location.href = '/crm'
  }

  const stats = [
    { label: t('stats.totalVisits'), value: String(client.total_visits), icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: t('stats.totalSpent'), value: formatCurrency(client.total_spent, currency), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: t('stats.lastVisit'), value: client.last_visit_at ? formatInBusinessTimezone(client.last_visit_at, timezone) : t('stats.never'), icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: t('stats.clientSince'), value: formatInBusinessTimezone(client.created_at, timezone), icon: UserCheck, color: 'text-orange-600', bg: 'bg-orange-50' },
  ]

  return (
    <div className="p-3 sm:p-6 max-w-4xl space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center mb-2`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div className="text-lg font-bold text-gray-900">{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base gap-3">
              <span className="truncate">{client.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                {!editing && (
                  <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                )}
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <button onClick={deleteClient} className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg">{t('deleteButton')}</button>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 border border-gray-200 rounded-lg">{t('cancelButton')}</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="p-1.5 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent>
            {editing ? (
              <div className="space-y-3">
                <Field label={t('fields.name')}>
                  <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} className="field-input" />
                </Field>
                <Field label={t('fields.phone')} error={errors.phone}>
                  <input type="tel" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} className="field-input" />
                </Field>
                <Field label={t('fields.whatsappNumber')} error={errors.whatsapp}>
                  <input type="tel" value={form.whatsapp_number} onChange={(e) => setForm((current) => ({ ...current, whatsapp_number: e.target.value }))} placeholder="+55 51 99999-9999" className="field-input" />
                </Field>
                <Field label={t('fields.email')}>
                  <input type="email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} className="field-input" />
                </Field>
                <Field label={t('fields.birthday')} error={errors.birthday}>
                  <div className="mt-1"><DatePicker value={form.birthday} onChange={(value) => setForm((current) => ({ ...current, birthday: value }))} /></div>
                </Field>
                <Field label={t('fields.tags')}>
                  <input value={form.tags} onChange={(e) => setForm((current) => ({ ...current, tags: e.target.value }))} placeholder={t('fields.tagsPlaceholder')} className="field-input" />
                </Field>
                <Field label={t('fields.notes')}>
                  <textarea value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} rows={3} placeholder={t('fields.notesPlaceholder')} className="field-input resize-none" />
                </Field>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>{t('cancelButton')}</Button>
                  <Button size="sm" onClick={save} disabled={saving || !form.name.trim()}>{saving ? '…' : t('saveButton')}</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {client.phone && <ContactRow label={t('fields.phone')}><a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">{client.phone}</a></ContactRow>}
                {client.whatsapp_number && (
                  <ContactRow label={t('fields.whatsappNumber')}>
                    <a href={`https://wa.me/${client.whatsapp_number.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline">{client.whatsapp_number}</a>
                  </ContactRow>
                )}
                {client.email && <ContactRow label={t('fields.email')}><a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">{client.email}</a></ContactRow>}
                {client.birthday && <ContactRow label={t('fields.birthday')}><span className="text-gray-700">{formatDate(client.birthday)}</span></ContactRow>}
                {client.tags.length > 0 && <div className="flex gap-2 flex-wrap pt-1">{client.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}
                {client.notes && <div className="mt-3 p-3 bg-gray-50 rounded-lg text-gray-600 text-xs leading-relaxed">{client.notes}</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">{t('appointments.heading')}</CardTitle></CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">{t('appointments.empty')}</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{appointment.services?.name ?? '—'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatInBusinessTimezone(appointment.starts_at, timezone)} · {formatInBusinessTimezone(appointment.starts_at, timezone, 'time')}
                        {appointment.employees?.name && ` · ${appointment.employees.name}`}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                      {appointment.price != null && <span className="text-sm font-semibold text-gray-900">{formatCurrency(appointment.price, currency)}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[appointment.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {t(`status.${appointment.status}` as any)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        :global(.field-input) {
          width: 100%;
          margin-top: 0.25rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        :global(.field-input:focus) {
          border-color: rgb(34 197 94);
          box-shadow: 0 0 0 2px rgb(34 197 94 / 0.15);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return <div><label className="text-xs font-medium text-gray-500">{label}</label>{children}{error && <p className="text-xs text-red-500 mt-1">{error}</p>}</div>
}

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">{label}</span>{children}</div>
}
