import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizeEvolutionPhone, sendEvolutionText } from '@/lib/evolution'

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}

function normalizedWord(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractText(payload: any) {
  const data = payload?.data ?? payload
  const message = data?.message ?? {}
  return String(
    message?.conversation ??
    message?.extendedTextMessage?.text ??
    message?.buttonsResponseMessage?.selectedDisplayText ??
    message?.listResponseMessage?.title ??
    message?.templateButtonReplyMessage?.selectedDisplayText ??
    data?.body ??
    ''
  ).trim()
}

function extractPhone(payload: any) {
  const data = payload?.data ?? payload
  const values = [
    data?.key?.remoteJid,
    data?.key?.remoteJidAlt,
    data?.sender,
    payload?.sender,
  ]
  for (const value of values) {
    const digits = normalizeEvolutionPhone(String(value ?? '').split('@')[0])
    if (digits.length >= 10) return digits
  }
  return ''
}

export async function POST(req: NextRequest, { params }: { params: { businessId: string } }) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: config } = await admin
    .from('business_evolution_config')
    .select('api_url, api_key, instance_name, enabled, webhook_secret')
    .eq('business_id', params.businessId)
    .maybeSingle()

  const suppliedSecret = req.headers.get('x-agelya-webhook-secret') ?? ''
  if (!config?.webhook_secret || !suppliedSecret || !safeEqual(config.webhook_secret, suppliedSecret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await req.json().catch(() => null)
  if (!payload) return NextResponse.json({ ok: true })

  const event = String(payload?.event ?? payload?.type ?? '').toUpperCase().replaceAll('.', '_')
  if (event && event !== 'MESSAGES_UPSERT') return NextResponse.json({ ok: true, ignored: 'event' })

  const data = payload?.data ?? payload
  if (data?.key?.fromMe === true || data?.fromMe === true) {
    return NextResponse.json({ ok: true, ignored: 'fromMe' })
  }

  const text = extractText(payload)
  const phone = extractPhone(payload)
  if (!text || !phone) return NextResponse.json({ ok: true, ignored: 'empty' })

  const { data: rule } = await admin
    .from('business_automation_rules')
    .select('enabled, requires_reply_confirmation, confirmation_keywords')
    .eq('business_id', params.businessId)
    .eq('rule_key', 'confirmation_request')
    .maybeSingle()

  if (!rule?.enabled || !rule.requires_reply_confirmation) {
    return NextResponse.json({ ok: true, ignored: 'confirmation-disabled' })
  }

  const received = normalizedWord(text)
  const keywords = (rule.confirmation_keywords ?? ['sim', 'confirmo', 'confirmado']).map((v: string) => normalizedWord(v))
  const isConfirmation = keywords.some((keyword: string) => received === keyword || received.startsWith(`${keyword} `))
  if (!isConfirmation) return NextResponse.json({ ok: true, ignored: 'not-confirmation' })

  const { data: clients } = await admin
    .from('clients')
    .select('id, name, whatsapp_number, phone')
    .eq('business_id', params.businessId)
    .limit(500)

  const client = (clients ?? []).find((item: any) => {
    const numbers = [item.whatsapp_number, item.phone]
      .map((value) => normalizeEvolutionPhone(value ?? ''))
      .filter(Boolean)
    return numbers.includes(phone)
  })

  if (!client) return NextResponse.json({ ok: true, ignored: 'client-not-found' })

  const now = new Date().toISOString()
  const horizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: appointment } = await admin
    .from('appointments')
    .select('id, starts_at, client_confirmed_at')
    .eq('business_id', params.businessId)
    .eq('client_id', client.id)
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', now)
    .lte('starts_at', horizon)
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!appointment || appointment.client_confirmed_at) {
    return NextResponse.json({ ok: true, ignored: 'appointment-not-found' })
  }

  const confirmedAt = new Date().toISOString()
  const { error: updateError } = await admin
    .from('appointments')
    .update({
      status: 'confirmed',
      client_confirmed_at: confirmedAt,
      client_confirmation_text: text.slice(0, 500),
      updated_at: confirmedAt,
    })
    .eq('id', appointment.id)
    .eq('business_id', params.businessId)
    .is('client_confirmed_at', null)

  if (updateError) return NextResponse.json({ error: 'update_failed' }, { status: 500 })

  await admin.from('notification_log').insert({
    business_id: params.businessId,
    ref_id: appointment.id,
    type: 'confirmation_received',
    channel: 'whatsapp',
  }).then(() => undefined).catch(() => undefined)

  if (config.enabled && config.api_url && config.api_key && config.instance_name) {
    await sendEvolutionText(
      { apiUrl: config.api_url, apiKey: config.api_key, instance: config.instance_name },
      phone,
      `✅ Perfeito, ${client.name}! Seu horário está confirmado. Obrigado pela resposta!`
    ).catch((err) => console.error('[evolution/webhook] confirmation acknowledgement:', err))
  }

  return NextResponse.json({ ok: true, confirmed: true })
}
