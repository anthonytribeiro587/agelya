import 'server-only'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { normalizeEvolutionPhone, sendEvolutionText } from '@/lib/evolution'

type SummaryOptions = {
  force?: boolean
  now?: Date
}

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function localDateParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return { year: get('year'), month: get('month'), day: get('day') }
}

function localClockMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

function wallclockToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string) {
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(noonUtc)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const localNoonMs = Date.UTC(
    get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')
  )
  const offsetMs = localNoonMs - noonUtc.getTime()
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMs)
}

function tomorrowLocal(now: Date, timezone: string) {
  const today = localDateParts(now, timezone)
  const next = new Date(Date.UTC(today.year, today.month - 1, today.day + 1))
  const year = next.getUTCFullYear()
  const month = next.getUTCMonth() + 1
  const day = next.getUTCDate()
  const start = wallclockToUtc(year, month, day, 0, 0, timezone)
  const after = new Date(Date.UTC(year, month - 1, day + 1))
  const end = wallclockToUtc(after.getUTCFullYear(), after.getUTCMonth() + 1, after.getUTCDate(), 0, 0, timezone)
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return { year, month, day, key, start, end }
}

function summaryTimeMinutes(value: string | null | undefined) {
  const [hour, minute] = String(value ?? '19:00').split(':').map(Number)
  return (Number.isFinite(hour) ? hour : 19) * 60 + (Number.isFinite(minute) ? minute : 0)
}

function timeLabel(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

export async function sendBusinessConfirmationSummary(businessId: string, options: SummaryOptions = {}) {
  const supabase = adminClient()
  const now = options.now ?? new Date()

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id, name, timezone, owner_whatsapp, confirmation_summary_enabled, confirmation_summary_time')
    .eq('id', businessId)
    .maybeSingle()

  if (businessError || !business) return { sent: false, reason: 'business_not_found' }
  if (!business.confirmation_summary_enabled && !options.force) return { sent: false, reason: 'disabled' }
  if (!business.owner_whatsapp) return { sent: false, reason: 'owner_phone_missing' }

  const timezone = business.timezone ?? 'America/Sao_Paulo'
  const dueAt = summaryTimeMinutes(business.confirmation_summary_time)
  if (!options.force && localClockMinutes(now, timezone) < dueAt) {
    return { sent: false, reason: 'not_due' }
  }

  const tomorrow = tomorrowLocal(now, timezone)
  const refId = `confirmation_summary_${businessId}_${tomorrow.key}`

  if (!options.force) {
    const { data: alreadySent } = await supabase
      .from('notification_log')
      .select('id')
      .eq('business_id', businessId)
      .eq('ref_id', refId)
      .eq('type', 'daily_confirmation_summary')
      .eq('channel', 'whatsapp')
      .maybeSingle()
    if (alreadySent) return { sent: false, reason: 'already_sent' }
  }

  const [{ data: evolution }, { data: appointments, error: appointmentError }] = await Promise.all([
    supabase
      .from('business_evolution_config')
      .select('api_url, api_key, instance_name, enabled')
      .eq('business_id', businessId)
      .maybeSingle(),
    supabase
      .from('appointments')
      .select('id, starts_at, status, client_confirmed_at, client_declined_at, clients(name), services(name)')
      .eq('business_id', businessId)
      .gte('starts_at', tomorrow.start.toISOString())
      .lt('starts_at', tomorrow.end.toISOString())
      .in('status', ['pending', 'confirmed', 'cancelled'])
      .order('starts_at', { ascending: true }),
  ])

  if (appointmentError) return { sent: false, reason: 'appointments_unavailable' }
  if (!evolution?.enabled || !evolution.api_url || !evolution.api_key || !evolution.instance_name) {
    return { sent: false, reason: 'evolution_disabled' }
  }

  const rows = (appointments ?? []).map((appointment: any) => ({
    time: timeLabel(appointment.starts_at, timezone),
    client: appointment.clients?.name ?? 'Cliente',
    service: appointment.services?.name ?? 'Atendimento',
    confirmed: Boolean(appointment.client_confirmed_at),
    declined: Boolean(appointment.client_declined_at) || appointment.status === 'cancelled',
  }))

  const confirmed = rows.filter((row) => row.confirmed && !row.declined)
  const declined = rows.filter((row) => row.declined)
  const waiting = rows.filter((row) => !row.confirmed && !row.declined)

  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(tomorrow.start)

  const lines: string[] = [
    `📋 *Agenda de amanhã — ${dateLabel}*`,
    '',
    `✅ *Confirmados pelo cliente (${confirmed.length})*`,
    ...(confirmed.length ? confirmed.map((row) => `${row.time} — ${row.client} — ${row.service}`) : ['Nenhum ainda.']),
    '',
    `⏳ *Aguardando resposta (${waiting.length})*`,
    ...(waiting.length ? waiting.map((row) => `${row.time} — ${row.client} — ${row.service}`) : ['Nenhum.']),
    '',
    `❌ *Cancelados (${declined.length})*`,
    ...(declined.length ? declined.map((row) => `${row.time} — ${row.client} — ${row.service}`) : ['Nenhum.']),
    '',
    `Total de horários: ${rows.length}`,
    `— Agelya`,
  ]

  await sendEvolutionText(
    { apiUrl: evolution.api_url, apiKey: evolution.api_key, instance: evolution.instance_name },
    normalizeEvolutionPhone(business.owner_whatsapp),
    lines.join('\n')
  )

  if (!options.force) {
    const { error: logError } = await supabase.from('notification_log').insert({
      business_id: businessId,
      ref_id: refId,
      type: 'daily_confirmation_summary',
      channel: 'whatsapp',
    })
    if (logError && logError.code !== '23505') {
      console.error('[confirmation summary] notification log:', logError.message)
    }
  }

  return {
    sent: true,
    reason: 'sent',
    date: tomorrow.key,
    total: rows.length,
    confirmed: confirmed.length,
    waiting: waiting.length,
    cancelled: declined.length,
  }
}

export async function sendDueDailyConfirmationSummaries(now = new Date()) {
  const supabase = adminClient()
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('confirmation_summary_enabled', true)
    .not('owner_whatsapp', 'is', null)

  if (error) {
    console.error('[confirmation summary] businesses:', error.message)
    return { checked: 0, sent: 0 }
  }

  let sent = 0
  for (const business of businesses ?? []) {
    try {
      const result = await sendBusinessConfirmationSummary(business.id, { now })
      if (result.sent) sent += 1
    } catch (err) {
      console.error(`[confirmation summary] ${business.id}:`, err)
    }
  }

  return { checked: businesses?.length ?? 0, sent }
}
