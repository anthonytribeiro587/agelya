/**
 * GET /api/cron/notify
 *
 * Agelya notification engine. All automated customer notifications are sent
 * exclusively through WhatsApp using each business' Evolution API instance.
 *
 * Events:
 *  1. Appointment reminder ~24h before
 *  2. Appointment reminder ~1h before
 *  3. Post-appointment thank-you
 *  4. 30-day reactivation
 *  5. Birthday greeting
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEvolutionText } from '@/lib/evolution'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

type EvolutionCredentials = { apiUrl: string; apiKey: string; instance: string }
type BusinessInfo = {
  name: string
  slug: string | null
  address: string | null
  timezone: string | null
}

function formatDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

function formatTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function reminderMessage(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  businessName: string
  address?: string
  oneHour?: boolean
}) {
  const lines = [
    opts.oneHour ? '⏰ *Seu atendimento é daqui a cerca de 1 hora*' : '📅 *Lembrete do seu agendamento*',
    '',
    `Olá, ${opts.clientName}!`,
    opts.oneHour ? 'Passando para lembrar que seu horário está chegando.' : 'Passando para lembrar do seu horário de amanhã.',
    '',
    `📋 Serviço: ${opts.serviceName}`,
    `📅 Data: ${opts.date}`,
    `🕐 Horário: ${opts.time}`,
  ]
  if (opts.address) lines.push(`📍 ${opts.address}`)
  lines.push('', `Até lá! — ${opts.businessName}`)
  return lines.join('\n')
}

function thankYouMessage(opts: {
  clientName: string
  serviceName: string
  businessName: string
  bookingUrl?: string
}) {
  const lines = [
    '💚 *Obrigado pela visita!*',
    '',
    `Olá, ${opts.clientName}! Foi um prazer receber você para ${opts.serviceName}.`,
    'Esperamos que tenha sido uma ótima experiência.',
  ]
  if (opts.bookingUrl) lines.push('', 'Para agendar novamente:', opts.bookingUrl)
  lines.push('', `— ${opts.businessName}`)
  return lines.join('\n')
}

function reactivationMessage(opts: {
  clientName: string
  businessName: string
  bookingUrl?: string
}) {
  const lines = [
    `👋 *Olá, ${opts.clientName}!*`,
    '',
    `Já faz um tempinho desde seu último atendimento na ${opts.businessName}.`,
    'Quando quiser voltar, estaremos por aqui. 💚',
  ]
  if (opts.bookingUrl) lines.push('', 'Agende seu próximo horário:', opts.bookingUrl)
  return lines.join('\n')
}

function birthdayMessage(opts: {
  clientName: string
  businessName: string
  bookingUrl?: string
}) {
  const lines = [
    `🎂 *Feliz aniversário, ${opts.clientName}!*`,
    '',
    `A ${opts.businessName} deseja um dia maravilhoso para você! ✨`,
  ]
  if (opts.bookingUrl) lines.push('', 'Quando quiser se cuidar, agende por aqui:', opts.bookingUrl)
  return lines.join('\n')
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const secret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const results: string[] = []
  const debug: Record<string, unknown> = { now: now.toISOString() }
  const evolutionCache = new Map<string, EvolutionCredentials | null>()
  const businessCache = new Map<string, BusinessInfo | null>()

  async function getEvolutionConfig(businessId: string): Promise<EvolutionCredentials | null> {
    if (evolutionCache.has(businessId)) return evolutionCache.get(businessId) ?? null

    const { data, error } = await supabase
      .from('business_evolution_config')
      .select('api_url, api_key, instance_name, enabled')
      .eq('business_id', businessId)
      .maybeSingle()

    if (error) console.error('[cron/notify] Evolution config:', error.message)

    const config = data?.enabled && data.api_url && data.api_key && data.instance_name
      ? { apiUrl: data.api_url, apiKey: data.api_key, instance: data.instance_name }
      : null

    evolutionCache.set(businessId, config)
    return config
  }

  async function getBusiness(businessId: string): Promise<BusinessInfo | null> {
    if (businessCache.has(businessId)) return businessCache.get(businessId) ?? null

    const { data, error } = await supabase
      .from('businesses')
      .select('name, slug, address, timezone')
      .eq('id', businessId)
      .maybeSingle()

    if (error) console.error('[cron/notify] business:', error.message)
    const business = data as BusinessInfo | null
    businessCache.set(businessId, business)
    return business
  }

  async function alreadySent(businessId: string, refId: string, type: string) {
    const { data } = await supabase
      .from('notification_log')
      .select('id')
      .eq('business_id', businessId)
      .eq('ref_id', refId)
      .eq('type', type)
      .eq('channel', 'whatsapp')
      .maybeSingle()
    return Boolean(data)
  }

  async function markSent(businessId: string, refId: string, type: string) {
    const { error } = await supabase.from('notification_log').insert({
      business_id: businessId,
      ref_id: refId,
      type,
      channel: 'whatsapp',
    })
    if (error && error.code !== '23505') {
      console.error('[cron/notify] notification_log:', error.message)
    }
  }

  async function sendOnce(opts: {
    businessId: string
    refId: string
    type: string
    phone: string
    message: string
  }) {
    if (await alreadySent(opts.businessId, opts.refId, opts.type)) return false
    const credentials = await getEvolutionConfig(opts.businessId)
    if (!credentials) return false

    try {
      await sendEvolutionText(credentials, opts.phone, opts.message)
      await markSent(opts.businessId, opts.refId, opts.type)
      results.push(`${opts.type}:${opts.refId}`)
      return true
    } catch (err) {
      console.error(`[cron/notify] ${opts.type} Evolution error:`, err)
      return false
    }
  }

  async function processReminders(from: Date, to: Date, type: 'reminder_24h' | 'reminder_1h') {
    const { data, error } = await supabase
      .from('appointments')
      .select('id, starts_at, business_id, services(name), clients(name, whatsapp_number)')
      .gte('starts_at', from.toISOString())
      .lte('starts_at', to.toISOString())
      .eq('status', 'confirmed')

    debug[type] = { count: data?.length ?? 0, error: error?.message ?? null }

    for (const appointment of data ?? []) {
      const client = appointment.clients as unknown as { name: string; whatsapp_number: string | null } | null
      const service = appointment.services as unknown as { name: string } | null
      if (!client?.whatsapp_number) continue

      const business = await getBusiness(appointment.business_id)
      if (!business) continue
      const timezone = business.timezone ?? 'America/Sao_Paulo'

      await sendOnce({
        businessId: appointment.business_id,
        refId: appointment.id,
        type,
        phone: client.whatsapp_number,
        message: reminderMessage({
          clientName: client.name,
          serviceName: service?.name ?? 'Atendimento',
          date: formatDate(appointment.starts_at, timezone),
          time: formatTime(appointment.starts_at, timezone),
          businessName: business.name,
          address: business.address ?? undefined,
          oneHour: type === 'reminder_1h',
        }),
      })
    }
  }

  const from24 = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const to24 = new Date(now.getTime() + 25 * 60 * 60 * 1000)
  await processReminders(from24, to24, 'reminder_24h')

  const from1h = new Date(now.getTime() + 45 * 60 * 1000)
  const to1h = new Date(now.getTime() + 75 * 60 * 1000)
  await processReminders(from1h, to1h, 'reminder_1h')

  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
  const { data: completed, error: completedError } = await supabase
    .from('appointments')
    .select('id, business_id, services(name), clients(name, whatsapp_number)')
    .eq('status', 'completed')
    .gte('ends_at', twoHoursAgo.toISOString())
    .lte('ends_at', now.toISOString())

  debug.thankyou = { count: completed?.length ?? 0, error: completedError?.message ?? null }

  for (const appointment of completed ?? []) {
    const client = appointment.clients as unknown as { name: string; whatsapp_number: string | null } | null
    const service = appointment.services as unknown as { name: string } | null
    if (!client?.whatsapp_number) continue

    const business = await getBusiness(appointment.business_id)
    if (!business) continue
    const bookingUrl = business.slug ? `${APP_URL}/book/${business.slug}` : undefined

    await sendOnce({
      businessId: appointment.business_id,
      refId: appointment.id,
      type: 'thankyou',
      phone: client.whatsapp_number,
      message: thankYouMessage({
        clientName: client.name,
        serviceName: service?.name ?? 'atendimento',
        businessName: business.name,
        bookingUrl,
      }),
    })
  }

  const reactivationStart = new Date(now)
  reactivationStart.setDate(reactivationStart.getDate() - 30)
  reactivationStart.setHours(0, 0, 0, 0)
  const reactivationEnd = new Date(reactivationStart)
  reactivationEnd.setHours(23, 59, 59, 999)

  const { data: dormant, error: dormantError } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number, business_id')
    .gte('last_visit_at', reactivationStart.toISOString())
    .lte('last_visit_at', reactivationEnd.toISOString())

  debug.reactivation = { count: dormant?.length ?? 0, error: dormantError?.message ?? null }

  for (const client of dormant ?? []) {
    if (!client.whatsapp_number) continue
    const business = await getBusiness(client.business_id)
    if (!business) continue
    const bookingUrl = business.slug ? `${APP_URL}/book/${business.slug}` : undefined

    await sendOnce({
      businessId: client.business_id,
      refId: client.id,
      type: 'reactivation',
      phone: client.whatsapp_number,
      message: reactivationMessage({
        clientName: client.name,
        businessName: business.name,
        bookingUrl,
      }),
    })
  }

  const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const { data: birthdayClients, error: birthdayError } = await supabase
    .from('clients')
    .select('id, name, whatsapp_number, birthday, business_id')
    .not('birthday', 'is', null)

  const birthdays = (birthdayClients ?? []).filter(
    (client) => typeof client.birthday === 'string' && client.birthday.slice(5) === todayMD
  )
  debug.birthday = { count: birthdays.length, error: birthdayError?.message ?? null }

  for (const client of birthdays) {
    if (!client.whatsapp_number) continue
    const business = await getBusiness(client.business_id)
    if (!business) continue
    const bookingUrl = business.slug ? `${APP_URL}/book/${business.slug}` : undefined
    const refId = `${client.id}_bday_${now.getFullYear()}`

    await sendOnce({
      businessId: client.business_id,
      refId,
      type: 'birthday',
      phone: client.whatsapp_number,
      message: birthdayMessage({
        clientName: client.name,
        businessName: business.name,
        bookingUrl,
      }),
    })
  }

  return NextResponse.json({ ok: true, sent: results.length, results, debug })
}
