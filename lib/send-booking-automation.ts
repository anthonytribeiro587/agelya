import 'server-only'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { renderAutomationMessage } from '@/lib/automation-message'
import { sendEvolutionText } from '@/lib/evolution'

export async function sendBookingCreatedAutomation(appointmentId: string) {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: appt, error: apptError } = await supabase
    .from('appointments')
    .select('id, starts_at, business_id, services(name), employees(name), clients(name, whatsapp_number)')
    .eq('id', appointmentId)
    .single()

  if (apptError || !appt) return { sent: false, reason: 'appointment_not_found' }

  const client = appt.clients as unknown as { name: string; whatsapp_number: string | null } | null
  const service = appt.services as unknown as { name: string } | null
  const employee = appt.employees as unknown as { name: string } | null
  if (!client?.whatsapp_number) return { sent: false, reason: 'no_phone' }

  const [{ data: biz }, { data: evolution }, { data: rule }] = await Promise.all([
    supabase.from('businesses').select('name, address, timezone').eq('id', appt.business_id).single(),
    supabase.from('business_evolution_config').select('api_url, api_key, instance_name, enabled').eq('business_id', appt.business_id).maybeSingle(),
    supabase.from('business_automation_rules').select('id, enabled, message_template').eq('business_id', appt.business_id).eq('rule_key', 'confirmation_request').maybeSingle(),
  ])

  if (!rule?.enabled) return { sent: false, reason: 'automation_disabled' }
  if (!evolution?.enabled || !evolution.api_url || !evolution.api_key || !evolution.instance_name) {
    return { sent: false, reason: 'evolution_disabled' }
  }

  const type = `automation_${rule.id}`
  const { data: alreadySent } = await supabase
    .from('notification_log')
    .select('id')
    .eq('business_id', appt.business_id)
    .eq('ref_id', appt.id)
    .eq('type', type)
    .eq('channel', 'whatsapp')
    .maybeSingle()

  if (alreadySent) return { sent: false, reason: 'already_sent' }

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

  const { error: logError } = await supabase.from('notification_log').insert({
    business_id: appt.business_id,
    ref_id: appt.id,
    type,
    channel: 'whatsapp',
  })
  if (logError && logError.code !== '23505') {
    console.error('[booking automation] notification log:', logError.message)
  }

  return { sent: true, reason: 'sent' }
}
