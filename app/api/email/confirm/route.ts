import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEvolutionText } from '@/lib/evolution'

// Legacy route name kept so the public booking flow does not break. Agelya now
// uses this endpoint exclusively for WhatsApp via Evolution API.

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

function bookingConfirmationMessage(opts: {
  clientName: string
  serviceName: string
  date: string
  time: string
  businessName: string
  employeeName?: string
  address?: string
}) {
  const lines = [
    '✅ *Agendamento confirmado!*',
    '',
    `Olá, ${opts.clientName}! Seu horário foi agendado com sucesso.`,
    '',
    `📋 Serviço: ${opts.serviceName}`,
    `📅 Data: ${opts.date}`,
    `🕐 Horário: ${opts.time}`,
  ]
  if (opts.employeeName) lines.push(`👤 Profissional: ${opts.employeeName}`)
  if (opts.address) lines.push(`📍 ${opts.address}`)
  lines.push('', `Até lá! — ${opts.businessName}`)
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const expectedSecret = process.env.INTERNAL_API_SECRET
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    if (!expectedSecret) {
      console.warn('[booking/confirm] INTERNAL_API_SECRET is not set.')
    }

    const { appointmentId } = await req.json()
    if (!appointmentId) {
      return NextResponse.json({ error: 'missing appointmentId' }, { status: 400 })
    }

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .select('id, starts_at, business_id, services(name), employees(name), clients(name, whatsapp_number)')
      .eq('id', appointmentId)
      .single()

    if (apptErr) console.error('[booking/confirm] appointment fetch:', apptErr.message)
    if (!appt) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const client = appt.clients as unknown as { name: string; whatsapp_number: string | null } | null
    const service = appt.services as unknown as { name: string } | null
    const employee = appt.employees as unknown as { name: string } | null

    if (!client?.whatsapp_number) {
      return NextResponse.json({ sent: true, whatsapp: 'skipped: no phone' })
    }

    const [{ data: biz }, { data: evolution }] = await Promise.all([
      supabase
        .from('businesses')
        .select('name, address, timezone')
        .eq('id', appt.business_id)
        .single(),
      supabase
        .from('business_evolution_config')
        .select('api_url, api_key, instance_name, enabled')
        .eq('business_id', appt.business_id)
        .maybeSingle(),
    ])

    if (!evolution?.enabled || !evolution.api_url || !evolution.api_key || !evolution.instance_name) {
      return NextResponse.json({ sent: true, whatsapp: 'skipped: Evolution disabled' })
    }

    const { data: alreadySent } = await supabase
      .from('notification_log')
      .select('id')
      .eq('business_id', appt.business_id)
      .eq('ref_id', appt.id)
      .eq('type', 'confirm')
      .eq('channel', 'whatsapp')
      .maybeSingle()

    if (alreadySent) {
      return NextResponse.json({ sent: true, whatsapp: 'skipped: already sent' })
    }

    const timezone = biz?.timezone ?? 'America/Sao_Paulo'
    const message = bookingConfirmationMessage({
      clientName: client.name,
      serviceName: service?.name ?? 'Atendimento',
      date: formatDate(appt.starts_at, timezone),
      time: formatTime(appt.starts_at, timezone),
      businessName: biz?.name ?? 'Agelya',
      employeeName: employee?.name ?? undefined,
      address: biz?.address ?? undefined,
    })

    await sendEvolutionText(
      {
        apiUrl: evolution.api_url,
        apiKey: evolution.api_key,
        instance: evolution.instance_name,
      },
      client.whatsapp_number,
      message
    )

    const { error: logErr } = await supabase.from('notification_log').insert({
      business_id: appt.business_id,
      ref_id: appt.id,
      type: 'confirm',
      channel: 'whatsapp',
    })
    if (logErr && logErr.code !== '23505') {
      console.error('[booking/confirm] notification log:', logErr.message)
    }

    return NextResponse.json({ sent: true, whatsapp: 'sent' })
  } catch (err) {
    console.error('[booking/confirm]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
