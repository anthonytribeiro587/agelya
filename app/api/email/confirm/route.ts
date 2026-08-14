import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { renderAutomationMessage } from '@/lib/automation-message'
import { sendEvolutionText } from '@/lib/evolution'

// Legacy route name kept so the public booking flow does not break. Agelya now
// uses this endpoint exclusively for the appointment-created WhatsApp automation.

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const expectedSecret = process.env.INTERNAL_API_SECRET
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { appointmentId } = await req.json()
    if (!appointmentId) return NextResponse.json({ error: 'missing appointmentId' }, { status: 400 })

    const supabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: appt } = await supabase
      .from('appointments')
      .select('id, starts_at, business_id, services(name), employees(name), clients(name, whatsapp_number)')
      .eq('id', appointmentId)
      .single()

    if (!appt) return NextResponse.json({ error: 'not found' }, { status: 404 })

    const client = appt.clients as unknown as { name: string; whatsapp_number: string | null } | null
    const service = appt.services as unknown as { name: string } | null
    const employee = appt.employees as unknown as { name: string } | null
    if (!client?.whatsapp_number) return NextResponse.json({ sent: true, whatsapp: 'skipped: no phone' })

    const [{ data: biz }, { data: evolution }, { data: rule }] = await Promise.all([
      supabase.from('businesses').select('name, address, timezone').eq('id', appt.business_id).single(),
      supabase.from('business_evolution_config').select('api_url, api_key, instance_name, enabled').eq('business_id', appt.business_id).maybeSingle(),
      supabase.from('business_automation_rules').select('enabled, message_template').eq('business_id', appt.business_id).eq('rule_key', 'confirmation_request').maybeSingle(),
    ])

    if (!rule?.enabled) return NextResponse.json({ sent: true, whatsapp: 'skipped: automation disabled' })
    if (!evolution?.enabled || !evolution.api_url || !evolution.api_key || !evolution.instance_name) {
      return NextResponse.json({ sent: true, whatsapp: 'skipped: Evolution disabled' })
    }

    const { data: alreadySent } = await supabase
      .from('notification_log')
      .select('id')
      .eq('business_id', appt.business_id)
      .eq('ref_id', appt.id)
      .eq('type', 'automation_confirmation_request')
      .eq('channel', 'whatsapp')
      .maybeSingle()

    if (alreadySent) return NextResponse.json({ sent: true, whatsapp: 'skipped: already sent' })

    const message = renderAutomationMessage(rule.message_template, {
      clientName: client.name,
      serviceName: service?.name,
      businessName: biz?.name ?? 'Agelya',
      employeeName: employee?.name,
      address: biz?.address,
      startsAt: appt.starts_at,
      timezone: biz?.timezone,
    })

    await sendEvolutionText(
      { apiUrl: evolution.api_url, apiKey: evolution.api_key, instance: evolution.instance_name },
      client.whatsapp_number,
      message
    )

    await supabase.from('notification_log').insert({
      business_id: appt.business_id,
      ref_id: appt.id,
      type: 'automation_confirmation_request',
      channel: 'whatsapp',
    })

    return NextResponse.json({ sent: true, whatsapp: 'sent' })
  } catch (err) {
    console.error('[booking/confirm]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
