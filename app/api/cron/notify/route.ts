/**
 * GET /api/cron/notify
 *
 * Agelya rule-driven WhatsApp automation engine.
 * The scheduler calls this route periodically; business_automation_rules decides
 * what is sent and when. Messages are delivered exclusively via Evolution API.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderAutomationMessage } from '@/lib/automation-message'
import { sendEvolutionText } from '@/lib/evolution'

type Rule = {
  id: string
  business_id: string
  rule_key: string
  event_type: 'appointment_created' | 'appointment_before' | 'appointment_after' | 'birthday' | 'reactivation'
  offset_minutes: number
  message_template: string
}

type EvolutionCredentials = { apiUrl: string; apiKey: string; instance: string }
type BusinessInfo = {
  name: string
  address: string | null
  timezone: string | null
}

type ClientInfo = {
  id: string
  name: string
  whatsapp_number: string | null
  birthday?: string | null
  last_visit_at?: string | null
  business_id?: string
}

const WINDOW_MINUTES = 12

function withinMinutes(base: Date, offsetMinutes: number) {
  const target = new Date(base.getTime() + offsetMinutes * 60_000)
  return {
    from: new Date(target.getTime() - WINDOW_MINUTES * 60_000),
    to: new Date(target.getTime() + WINDOW_MINUTES * 60_000),
  }
}

function localMonthDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${month}-${day}`
}

function localYear(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric' }).format(date)
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const secret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const expected = process.env.CRON_SECRET

  if (!expected || !secret || secret !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const now = new Date()
  const sent: string[] = []
  const failures: string[] = []
  const evolutionCache = new Map<string, EvolutionCredentials | null>()
  const businessCache = new Map<string, BusinessInfo | null>()

  async function getEvolution(businessId: string) {
    if (evolutionCache.has(businessId)) return evolutionCache.get(businessId) ?? null
    const { data } = await supabase
      .from('business_evolution_config')
      .select('api_url, api_key, instance_name, enabled')
      .eq('business_id', businessId)
      .maybeSingle()

    const value = data?.enabled && data.api_url && data.api_key && data.instance_name
      ? { apiUrl: data.api_url, apiKey: data.api_key, instance: data.instance_name }
      : null
    evolutionCache.set(businessId, value)
    return value
  }

  async function getBusiness(businessId: string) {
    if (businessCache.has(businessId)) return businessCache.get(businessId) ?? null
    const { data } = await supabase
      .from('businesses')
      .select('name, address, timezone')
      .eq('id', businessId)
      .maybeSingle()
    const value = data as BusinessInfo | null
    businessCache.set(businessId, value)
    return value
  }

  async function alreadySent(rule: Rule, refId: string) {
    const { data } = await supabase
      .from('notification_log')
      .select('id')
      .eq('business_id', rule.business_id)
      .eq('ref_id', refId)
      .eq('type', `automation_${rule.id}`)
      .eq('channel', 'whatsapp')
      .maybeSingle()
    return Boolean(data)
  }

  async function deliver(rule: Rule, refId: string, client: ClientInfo, context: {
    serviceName?: string | null
    employeeName?: string | null
    startsAt?: string | null
  }) {
    if (!client.whatsapp_number || await alreadySent(rule, refId)) return

    const [business, evolution] = await Promise.all([
      getBusiness(rule.business_id),
      getEvolution(rule.business_id),
    ])
    if (!business || !evolution) return

    const message = renderAutomationMessage(rule.message_template, {
      clientName: client.name,
      serviceName: context.serviceName,
      employeeName: context.employeeName,
      businessName: business.name,
      address: business.address,
      startsAt: context.startsAt,
      timezone: business.timezone,
    })

    try {
      await sendEvolutionText(evolution, client.whatsapp_number, message)
      const { error } = await supabase.from('notification_log').insert({
        business_id: rule.business_id,
        ref_id: refId,
        type: `automation_${rule.id}`,
        channel: 'whatsapp',
      })
      if (error && error.code !== '23505') console.error('[cron/notify] log:', error.message)
      sent.push(`${rule.rule_key}:${refId}`)
    } catch (err) {
      console.error(`[cron/notify] ${rule.rule_key}:`, err)
      failures.push(`${rule.rule_key}:${refId}`)
    }
  }

  const { data: rules, error: rulesError } = await supabase
    .from('business_automation_rules')
    .select('id, business_id, rule_key, event_type, offset_minutes, message_template')
    .eq('enabled', true)
    .neq('event_type', 'appointment_created')
    .order('sort_order')

  if (rulesError) {
    console.error('[cron/notify] rules:', rulesError.message)
    return NextResponse.json({ error: 'rules_unavailable' }, { status: 500 })
  }

  for (const rawRule of (rules ?? []) as Rule[]) {
    const rule = rawRule as Rule

    if (rule.event_type === 'appointment_before') {
      const { from, to } = withinMinutes(now, rule.offset_minutes)
      const { data } = await supabase
        .from('appointments')
        .select('id, starts_at, services(name), employees(name), clients(id, name, whatsapp_number)')
        .eq('business_id', rule.business_id)
        .in('status', ['pending', 'confirmed'])
        .gte('starts_at', from.toISOString())
        .lte('starts_at', to.toISOString())

      for (const appointment of data ?? []) {
        const client = appointment.clients as unknown as ClientInfo | null
        const service = appointment.services as unknown as { name: string } | null
        const employee = appointment.employees as unknown as { name: string } | null
        if (!client) continue
        await deliver(rule, appointment.id, client, {
          serviceName: service?.name,
          employeeName: employee?.name,
          startsAt: appointment.starts_at,
        })
      }
      continue
    }

    if (rule.event_type === 'appointment_after') {
      const { from, to } = withinMinutes(now, -rule.offset_minutes)
      const { data } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, services(name), employees(name), clients(id, name, whatsapp_number)')
        .eq('business_id', rule.business_id)
        .in('status', ['completed', 'paid'])
        .gte('ends_at', from.toISOString())
        .lte('ends_at', to.toISOString())

      for (const appointment of data ?? []) {
        const client = appointment.clients as unknown as ClientInfo | null
        const service = appointment.services as unknown as { name: string } | null
        const employee = appointment.employees as unknown as { name: string } | null
        if (!client) continue
        await deliver(rule, appointment.id, client, {
          serviceName: service?.name,
          employeeName: employee?.name,
          startsAt: appointment.starts_at,
        })
      }
      continue
    }

    if (rule.event_type === 'reactivation') {
      const { from, to } = withinMinutes(now, -rule.offset_minutes)
      const { data } = await supabase
        .from('clients')
        .select('id, name, whatsapp_number, last_visit_at')
        .eq('business_id', rule.business_id)
        .not('last_visit_at', 'is', null)
        .gte('last_visit_at', from.toISOString())
        .lte('last_visit_at', to.toISOString())

      for (const client of (data ?? []) as ClientInfo[]) {
        await deliver(rule, client.id, client, {})
      }
      continue
    }

    if (rule.event_type === 'birthday') {
      const business = await getBusiness(rule.business_id)
      if (!business) continue
      const timezone = business.timezone ?? 'America/Sao_Paulo'
      const monthDay = localMonthDay(now, timezone)
      const year = localYear(now, timezone)
      const { data } = await supabase
        .from('clients')
        .select('id, name, whatsapp_number, birthday')
        .eq('business_id', rule.business_id)
        .not('birthday', 'is', null)

      for (const client of (data ?? []) as ClientInfo[]) {
        if (!client.birthday || client.birthday.slice(5) !== monthDay) continue
        await deliver(rule, `${client.id}_birthday_${year}`, client, {})
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checkedAt: now.toISOString(),
    rules: rules?.length ?? 0,
    sent: sent.length,
    failures: failures.length,
    results: sent,
  })
}
