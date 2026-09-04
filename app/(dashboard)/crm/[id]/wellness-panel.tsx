'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { ClipboardList, FileCheck2, HeartPulse, PackageCheck, Plus, Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatInBusinessTimezone } from '@/lib/utils'

type Tab = 'packages' | 'intake' | 'notes' | 'consents'

export interface WellnessAppointment {
  id: string
  starts_at: string
  status: string
  services: { id: string; name: string } | null
  employees: { id: string; name: string } | null
}

interface Props {
  businessId: string
  clientId: string
  appointments: WellnessAppointment[]
  currency: string
  timezone: string
}

interface SessionPackage {
  id: string
  name: string
  total_sessions: number
  price_paid: number
  status: 'active' | 'completed' | 'expired' | 'cancelled'
  purchased_at: string
  expires_at: string | null
  notes: string | null
}

interface PackageUse {
  id: string
  package_id: string
  appointment_id: string
  used_at: string
}

interface IntakeForm {
  id: string
  answers: Record<string, unknown>
  version: string
  completed_at: string | null
  created_at: string
}

interface Consent {
  id: string
  consent_type: string
  version: string
  accepted_at: string
  revoked_at: string | null
}

interface SessionNote {
  id: string
  appointment_id: string | null
  employee_id: string | null
  pain_scale: number | null
  body_areas: string[]
  techniques: string[]
  evolution: string | null
  client_response: string | null
  recommendations: string | null
  created_at: string
  updated_at: string
}

const COPY = {
  pt: {
    title: 'Prontuário de massoterapia',
    subtitle: 'Pacotes, anamnese, consentimentos e evolução dos atendimentos em um só lugar.',
    packages: 'Pacotes',
    intake: 'Anamnese',
    notes: 'Evoluções',
    consents: 'Consentimentos',
    loading: 'Carregando prontuário…',
    loadError: 'Não foi possível carregar o prontuário.',
  },
  en: {
    title: 'Massage therapy record',
    subtitle: 'Packages, intake, consent and session progress in one place.',
    packages: 'Packages',
    intake: 'Intake',
    notes: 'Progress notes',
    consents: 'Consents',
    loading: 'Loading record…',
    loadError: 'Could not load the record.',
  },
}

function textAnswer(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function numberAnswer(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function splitList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export function WellnessPanel({ businessId, clientId, appointments, currency, timezone }: Props) {
  const c = COPY.pt
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])

  const [tab, setTab] = useState<Tab>('packages')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [packages, setPackages] = useState<SessionPackage[]>([])
  const [uses, setUses] = useState<PackageUse[]>([])
  const [intakes, setIntakes] = useState<IntakeForm[]>([])
  const [consents, setConsents] = useState<Consent[]>([])
  const [sessionNotes, setSessionNotes] = useState<SessionNote[]>([])
  const [packageAppointment, setPackageAppointment] = useState<Record<string, string>>({})

  const [packageForm, setPackageForm] = useState({
    name: '',
    totalSessions: '5',
    pricePaid: '',
    expiresAt: '',
    notes: '',
  })

  const [intakeForm, setIntakeForm] = useState({
    chiefComplaint: '',
    goals: '',
    painLocation: '',
    painIntensity: '',
    medicalConditions: '',
    medications: '',
    allergies: '',
    contraindications: '',
    surgeries: '',
    pregnancy: 'not_applicable',
    observations: '',
  })

  const [noteForm, setNoteForm] = useState({
    appointmentId: '',
    painScale: '',
    bodyAreas: '',
    techniques: '',
    evolution: '',
    clientResponse: '',
    recommendations: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [packageResult, usesResult, intakeResult, consentResult, notesResult] = await Promise.all([
      supabase
        .from('session_packages')
        .select('id,name,total_sessions,price_paid,status,purchased_at,expires_at,notes')
        .eq('business_id', businessId)
        .eq('client_id', clientId)
        .order('purchased_at', { ascending: false }),
      supabase
        .from('package_session_uses')
        .select('id,package_id,appointment_id,used_at')
        .eq('business_id', businessId)
        .order('used_at', { ascending: false }),
      supabase
        .from('client_intake_forms')
        .select('id,answers,version,completed_at,created_at')
        .eq('business_id', businessId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('client_consents')
        .select('id,consent_type,version,accepted_at,revoked_at')
        .eq('business_id', businessId)
        .eq('client_id', clientId)
        .order('accepted_at', { ascending: false }),
      supabase
        .from('session_notes')
        .select('id,appointment_id,employee_id,pain_scale,body_areas,techniques,evolution,client_response,recommendations,created_at,updated_at')
        .eq('business_id', businessId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ])

    const firstError = packageResult.error || usesResult.error || intakeResult.error || consentResult.error || notesResult.error
    if (firstError) {
      setError(firstError.message || c.loadError)
      setLoading(false)
      return
    }

    const nextPackages = (packageResult.data ?? []) as SessionPackage[]
    const nextUses = (usesResult.data ?? []) as PackageUse[]
    const nextIntakes = (intakeResult.data ?? []) as IntakeForm[]
    const nextConsents = (consentResult.data ?? []) as Consent[]
    const nextNotes = (notesResult.data ?? []) as SessionNote[]

    setPackages(nextPackages)
    setUses(nextUses)
    setIntakes(nextIntakes)
    setConsents(nextConsents)
    setSessionNotes(nextNotes)

    const latest = nextIntakes[0]
    if (latest?.answers) {
      setIntakeForm({
        chiefComplaint: textAnswer(latest.answers.chief_complaint),
        goals: textAnswer(latest.answers.goals),
        painLocation: textAnswer(latest.answers.pain_location),
        painIntensity: numberAnswer(latest.answers.pain_intensity),
        medicalConditions: textAnswer(latest.answers.medical_conditions),
        medications: textAnswer(latest.answers.medications),
        allergies: textAnswer(latest.answers.allergies),
        contraindications: textAnswer(latest.answers.contraindications),
        surgeries: textAnswer(latest.answers.surgeries),
        pregnancy: textAnswer(latest.answers.pregnancy) || 'not_applicable',
        observations: textAnswer(latest.answers.observations),
      })
    }

    setLoading(false)
  }, [businessId, clientId, supabase, c.loadError])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function packageUses(packageId: string) {
    return uses.filter((item) => item.package_id === packageId)
  }

  function remainingSessions(item: SessionPackage) {
    return Math.max(0, item.total_sessions - packageUses(item.id).length)
  }

  const unusedAppointments = useMemo(() => {
    const usedAppointmentIds = new Set(uses.map((item) => item.appointment_id))
    return appointments.filter((appointment) =>
      !usedAppointmentIds.has(appointment.id) &&
      ['completed', 'paid'].includes(appointment.status)
    )
  }, [appointments, uses])

  async function createPackage() {
    const total = Number.parseInt(packageForm.totalSessions, 10)
    const price = Number.parseFloat(packageForm.pricePaid.replace(',', '.')) || 0
    if (!packageForm.name.trim() || !Number.isFinite(total) || total <= 0) {
      setError('Informe o nome e uma quantidade válida de sessões.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    const { error: insertError } = await supabase.from('session_packages').insert({
      business_id: businessId,
      client_id: clientId,
      name: packageForm.name.trim(),
      total_sessions: total,
      price_paid: price,
      expires_at: packageForm.expiresAt ? new Date(packageForm.expiresAt + 'T23:59:59').toISOString() : null,
      notes: packageForm.notes.trim() || null,
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setPackageForm({ name: '', totalSessions: '5', pricePaid: '', expiresAt: '', notes: '' })
      setNotice('Pacote criado com sucesso.')
      await loadData()
    }
    setSaving(false)
  }

  async function consumeSession(item: SessionPackage) {
    const appointmentId = packageAppointment[item.id] || unusedAppointments[0]?.id
    if (!appointmentId) {
      setError('Conclua um atendimento antes de consumir uma sessão do pacote.')
      return
    }
    if (remainingSessions(item) <= 0) {
      setError('Este pacote não possui sessões disponíveis.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    const { error: useError } = await supabase.from('package_session_uses').insert({
      business_id: businessId,
      package_id: item.id,
      appointment_id: appointmentId,
    })

    if (useError) {
      setError(useError.code === '23505' ? 'Este atendimento já foi vinculado a um pacote.' : useError.message)
      setSaving(false)
      return
    }

    const newCount = packageUses(item.id).length + 1
    if (newCount >= item.total_sessions) {
      await supabase.from('session_packages').update({ status: 'completed' }).eq('id', item.id)
    }

    setNotice('Sessão consumida do pacote.')
    await loadData()
    setSaving(false)
  }

  async function saveIntake() {
    setSaving(true)
    setError(null)
    setNotice(null)
    const { data: authData } = await supabase.auth.getUser()
    const latestVersion = intakes.length > 0 ? Number.parseInt(intakes[0].version, 10) || intakes.length : 0

    const answers = {
      chief_complaint: intakeForm.chiefComplaint.trim(),
      goals: intakeForm.goals.trim(),
      pain_location: intakeForm.painLocation.trim(),
      pain_intensity: intakeForm.painIntensity ? Number.parseInt(intakeForm.painIntensity, 10) : null,
      medical_conditions: intakeForm.medicalConditions.trim(),
      medications: intakeForm.medications.trim(),
      allergies: intakeForm.allergies.trim(),
      contraindications: intakeForm.contraindications.trim(),
      surgeries: intakeForm.surgeries.trim(),
      pregnancy: intakeForm.pregnancy,
      observations: intakeForm.observations.trim(),
    }

    const { error: intakeError } = await supabase.from('client_intake_forms').insert({
      business_id: businessId,
      client_id: clientId,
      answers,
      version: String(latestVersion + 1),
      completed_at: new Date().toISOString(),
      created_by: authData.user?.id ?? null,
    })

    if (intakeError) setError(intakeError.message)
    else {
      setNotice('Anamnese salva e versionada no histórico.')
      await loadData()
    }
    setSaving(false)
  }

  async function saveSessionNote() {
    if (!noteForm.evolution.trim()) {
      setError('Descreva a evolução do atendimento.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    const appointment = appointments.find((item) => item.id === noteForm.appointmentId)
    const existing = noteForm.appointmentId
      ? sessionNotes.find((item) => item.appointment_id === noteForm.appointmentId)
      : undefined

    const payload = {
      business_id: businessId,
      client_id: clientId,
      appointment_id: noteForm.appointmentId || null,
      employee_id: appointment?.employees?.id ?? null,
      pain_scale: noteForm.painScale ? Number.parseInt(noteForm.painScale, 10) : null,
      body_areas: splitList(noteForm.bodyAreas),
      techniques: splitList(noteForm.techniques),
      evolution: noteForm.evolution.trim(),
      client_response: noteForm.clientResponse.trim() || null,
      recommendations: noteForm.recommendations.trim() || null,
      updated_at: new Date().toISOString(),
    }

    const result = existing
      ? await supabase.from('session_notes').update(payload).eq('id', existing.id)
      : await supabase.from('session_notes').insert(payload)

    if (result.error) {
      setError(result.error.message)
    } else {
      setNoteForm({
        appointmentId: '',
        painScale: '',
        bodyAreas: '',
        techniques: '',
        evolution: '',
        clientResponse: '',
        recommendations: '',
      })
      setNotice(existing ? 'Evolução atualizada.' : 'Evolução registrada.')
      await loadData()
    }
    setSaving(false)
  }

  async function acceptConsent(type: string) {
    setSaving(true)
    setError(null)
    setNotice(null)
    const { error: consentError } = await supabase.from('client_consents').insert({
      business_id: businessId,
      client_id: clientId,
      consent_type: type,
      version: '1',
      accepted_at: new Date().toISOString(),
    })
    if (consentError) setError(consentError.message)
    else {
      setNotice('Consentimento registrado.')
      await loadData()
    }
    setSaving(false)
  }

  async function revokeConsent(consent: Consent) {
    setSaving(true)
    setError(null)
    setNotice(null)
    const { error: consentError } = await supabase
      .from('client_consents')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', consent.id)
    if (consentError) setError(consentError.message)
    else {
      setNotice('Consentimento revogado.')
      await loadData()
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-gray-500">{c.loading}</CardContent>
      </Card>
    )
  }

  const tabs: Array<{ id: Tab; label: string; icon: typeof PackageCheck }> = [
    { id: 'packages', label: c.packages, icon: PackageCheck },
    { id: 'intake', label: c.intake, icon: ClipboardList },
    { id: 'notes', label: c.notes, icon: HeartPulse },
    { id: 'consents', label: c.consents, icon: ShieldCheck },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <HeartPulse className="w-5 h-5" />
          </div>
          <div>
            <div>{c.title}</div>
            <p className="text-xs font-normal text-gray-500 mt-1">{c.subtitle}</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id); setError(null); setNotice(null) }}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                tab === item.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {notice && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div>}

        {tab === 'packages' && (
          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-3">
              {packages.length === 0 ? (
                <div className="md:col-span-2 rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">
                  Nenhum pacote cadastrado para este cliente.
                </div>
              ) : packages.map((item) => {
                const used = packageUses(item.id).length
                const remaining = remainingSessions(item)
                return (
                  <div key={item.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {used}/{item.total_sessions} sessões utilizadas · {remaining} restantes
                        </div>
                      </div>
                      <Badge variant="secondary">{item.status === 'active' ? 'ativo' : item.status}</Badge>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (used / item.total_sessions) * 100)}%` }} />
                    </div>
                    <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Valor: {formatCurrency(Number(item.price_paid), currency)}</span>
                      {item.expires_at && <span>Validade: {formatInBusinessTimezone(item.expires_at, timezone)}</span>}
                    </div>
                    {item.notes && <p className="mt-2 text-xs text-gray-500">{item.notes}</p>}
                    {item.status === 'active' && remaining > 0 && (
                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <select
                          value={packageAppointment[item.id] ?? ''}
                          onChange={(event) => setPackageAppointment((current) => ({ ...current, [item.id]: event.target.value }))}
                          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-xs"
                        >
                          <option value="">Selecionar atendimento concluído</option>
                          {unusedAppointments.map((appointment) => (
                            <option key={appointment.id} value={appointment.id}>
                              {formatInBusinessTimezone(appointment.starts_at, timezone)} · {appointment.services?.name ?? 'Atendimento'}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" onClick={() => void consumeSession(item)} disabled={saving || unusedAppointments.length === 0}>
                          Consumir sessão
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Plus className="w-4 h-4" /> Novo pacote</h4>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                <Field label="Nome do pacote">
                  <input value={packageForm.name} onChange={(e) => setPackageForm((f) => ({ ...f, name: e.target.value }))} className="wellness-input" placeholder="Ex.: 10 sessões relaxantes" />
                </Field>
                <Field label="Sessões">
                  <input type="number" min="1" value={packageForm.totalSessions} onChange={(e) => setPackageForm((f) => ({ ...f, totalSessions: e.target.value }))} className="wellness-input" />
                </Field>
                <Field label="Valor pago">
                  <input inputMode="decimal" value={packageForm.pricePaid} onChange={(e) => setPackageForm((f) => ({ ...f, pricePaid: e.target.value }))} className="wellness-input" placeholder="0,00" />
                </Field>
                <Field label="Validade">
                  <input type="date" value={packageForm.expiresAt} onChange={(e) => setPackageForm((f) => ({ ...f, expiresAt: e.target.value }))} className="wellness-input" />
                </Field>
              </div>
              <Field label="Observações">
                <textarea rows={2} value={packageForm.notes} onChange={(e) => setPackageForm((f) => ({ ...f, notes: e.target.value }))} className="wellness-input resize-none" />
              </Field>
              <Button size="sm" className="mt-3 gap-1.5" onClick={() => void createPackage()} disabled={saving}>
                <PackageCheck className="w-4 h-4" /> Criar pacote
              </Button>
            </div>
          </div>
        )}

        {tab === 'intake' && (
          <div className="space-y-4">
            {intakes[0] && (
              <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                Última versão: {intakes[0].version} · {formatInBusinessTimezone(intakes[0].completed_at ?? intakes[0].created_at, timezone)}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Queixa principal"><textarea rows={2} className="wellness-input resize-none" value={intakeForm.chiefComplaint} onChange={(e) => setIntakeForm((f) => ({ ...f, chiefComplaint: e.target.value }))} /></Field>
              <Field label="Objetivo do atendimento"><textarea rows={2} className="wellness-input resize-none" value={intakeForm.goals} onChange={(e) => setIntakeForm((f) => ({ ...f, goals: e.target.value }))} /></Field>
              <Field label="Local da dor/desconforto"><input className="wellness-input" value={intakeForm.painLocation} onChange={(e) => setIntakeForm((f) => ({ ...f, painLocation: e.target.value }))} /></Field>
              <Field label="Intensidade da dor (0–10)"><input type="number" min="0" max="10" className="wellness-input" value={intakeForm.painIntensity} onChange={(e) => setIntakeForm((f) => ({ ...f, painIntensity: e.target.value }))} /></Field>
              <Field label="Condições de saúde"><textarea rows={2} className="wellness-input resize-none" value={intakeForm.medicalConditions} onChange={(e) => setIntakeForm((f) => ({ ...f, medicalConditions: e.target.value }))} /></Field>
              <Field label="Medicamentos em uso"><textarea rows={2} className="wellness-input resize-none" value={intakeForm.medications} onChange={(e) => setIntakeForm((f) => ({ ...f, medications: e.target.value }))} /></Field>
              <Field label="Alergias"><textarea rows={2} className="wellness-input resize-none" value={intakeForm.allergies} onChange={(e) => setIntakeForm((f) => ({ ...f, allergies: e.target.value }))} /></Field>
              <Field label="Contraindicações/cuidados"><textarea rows={2} className="wellness-input resize-none" value={intakeForm.contraindications} onChange={(e) => setIntakeForm((f) => ({ ...f, contraindications: e.target.value }))} /></Field>
              <Field label="Cirurgias/procedimentos prévios"><textarea rows={2} className="wellness-input resize-none" value={intakeForm.surgeries} onChange={(e) => setIntakeForm((f) => ({ ...f, surgeries: e.target.value }))} /></Field>
              <Field label="Gestação">
                <select className="wellness-input" value={intakeForm.pregnancy} onChange={(e) => setIntakeForm((f) => ({ ...f, pregnancy: e.target.value }))}>
                  <option value="not_applicable">Não se aplica / não informado</option>
                  <option value="no">Não</option>
                  <option value="yes">Sim</option>
                </select>
              </Field>
            </div>
            <Field label="Observações gerais"><textarea rows={3} className="wellness-input resize-none" value={intakeForm.observations} onChange={(e) => setIntakeForm((f) => ({ ...f, observations: e.target.value }))} /></Field>
            <Button size="sm" className="gap-1.5" onClick={() => void saveIntake()} disabled={saving}><Save className="w-4 h-4" /> Salvar nova versão</Button>
            {intakes.length > 1 && (
              <div className="pt-2">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Histórico</div>
                <div className="space-y-2">
                  {intakes.slice(1, 6).map((item) => (
                    <div key={item.id} className="text-xs text-gray-500 border-l-2 border-gray-200 pl-3">
                      Versão {item.version} · {formatInBusinessTimezone(item.completed_at ?? item.created_at, timezone)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'notes' && (
          <div className="space-y-5">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3">Registrar evolução</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Atendimento">
                  <select className="wellness-input" value={noteForm.appointmentId} onChange={(e) => setNoteForm((f) => ({ ...f, appointmentId: e.target.value }))}>
                    <option value="">Sem vínculo com agendamento</option>
                    {appointments.map((appointment) => (
                      <option key={appointment.id} value={appointment.id}>
                        {formatInBusinessTimezone(appointment.starts_at, timezone)} · {appointment.services?.name ?? 'Atendimento'}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Escala de dor (0–10)"><input type="number" min="0" max="10" className="wellness-input" value={noteForm.painScale} onChange={(e) => setNoteForm((f) => ({ ...f, painScale: e.target.value }))} /></Field>
                <Field label="Regiões trabalhadas"><input className="wellness-input" placeholder="lombar, cervical, trapézio" value={noteForm.bodyAreas} onChange={(e) => setNoteForm((f) => ({ ...f, bodyAreas: e.target.value }))} /></Field>
                <Field label="Técnicas utilizadas"><input className="wellness-input" placeholder="liberação, deslizamento, pressão" value={noteForm.techniques} onChange={(e) => setNoteForm((f) => ({ ...f, techniques: e.target.value }))} /></Field>
              </div>
              <Field label="Evolução do atendimento"><textarea rows={3} className="wellness-input resize-none" value={noteForm.evolution} onChange={(e) => setNoteForm((f) => ({ ...f, evolution: e.target.value }))} /></Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Resposta do cliente"><textarea rows={2} className="wellness-input resize-none" value={noteForm.clientResponse} onChange={(e) => setNoteForm((f) => ({ ...f, clientResponse: e.target.value }))} /></Field>
                <Field label="Recomendações"><textarea rows={2} className="wellness-input resize-none" value={noteForm.recommendations} onChange={(e) => setNoteForm((f) => ({ ...f, recommendations: e.target.value }))} /></Field>
              </div>
              <Button size="sm" className="mt-3 gap-1.5" onClick={() => void saveSessionNote()} disabled={saving}><Save className="w-4 h-4" /> Salvar evolução</Button>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Histórico de evoluções</div>
              {sessionNotes.length === 0 ? (
                <div className="text-sm text-gray-400 py-4 text-center">Nenhuma evolução registrada.</div>
              ) : (
                <div className="space-y-3">
                  {sessionNotes.map((note) => {
                    const appointment = appointments.find((item) => item.id === note.appointment_id)
                    return (
                      <div key={note.id} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="text-sm font-medium text-gray-900">
                            {appointment?.services?.name ?? 'Evolução clínica'}
                          </div>
                          <div className="text-xs text-gray-400">{formatInBusinessTimezone(note.created_at, timezone)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {note.pain_scale != null && <Badge variant="secondary">Dor: {note.pain_scale}/10</Badge>}
                          {note.body_areas.map((area) => <Badge key={area} variant="secondary">{area}</Badge>)}
                        </div>
                        {note.techniques.length > 0 && <p className="text-xs text-gray-500 mb-2"><strong>Técnicas:</strong> {note.techniques.join(', ')}</p>}
                        {note.evolution && <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.evolution}</p>}
                        {note.client_response && <p className="text-xs text-gray-500 mt-2"><strong>Resposta:</strong> {note.client_response}</p>}
                        {note.recommendations && <p className="text-xs text-gray-500 mt-1"><strong>Recomendações:</strong> {note.recommendations}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'consents' && (
          <div className="space-y-3">
            {[
              { type: 'massage_therapy_treatment', title: 'Consentimento para massoterapia', description: 'Registra que o cliente foi informado sobre o atendimento e concordou com a realização da sessão.' },
              { type: 'sensitive_data_processing', title: 'Tratamento de dados sensíveis', description: 'Registra a autorização para armazenar as informações de anamnese e evolução necessárias ao atendimento.' },
            ].map((definition) => {
              const active = consents.find((item) => item.consent_type === definition.type && !item.revoked_at)
              return (
                <div key={definition.type} className="rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-emerald-600" /> {definition.title}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 max-w-2xl">{definition.description}</p>
                    {active && <p className="text-xs text-emerald-600 mt-2">Aceito em {formatInBusinessTimezone(active.accepted_at, timezone)}</p>}
                  </div>
                  {active ? (
                    <Button variant="outline" size="sm" onClick={() => void revokeConsent(active)} disabled={saving}>Revogar</Button>
                  ) : (
                    <Button size="sm" onClick={() => void acceptConsent(definition.type)} disabled={saving}>Registrar aceite</Button>
                  )}
                </div>
              )
            })}
            <p className="text-xs text-gray-400 pt-2">
              O Agelya registra o aceite no prontuário. O conteúdo jurídico do termo deve ser definido pelo profissional conforme sua atividade e orientação aplicável.
            </p>
          </div>
        )}
      </CardContent>

      <style jsx>{`
        :global(.wellness-input) {
          width: 100%;
          margin-top: 0.25rem;
          border: 1px solid rgb(229 231 235);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
          background: white;
        }
        :global(.wellness-input:focus) {
          border-color: rgb(16 185 129);
          box-shadow: 0 0 0 2px rgb(16 185 129 / 0.12);
        }
      `}</style>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}
