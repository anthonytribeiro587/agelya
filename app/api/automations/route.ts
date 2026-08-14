import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSameOrigin } from '@/lib/request-security'
import { randomUUID } from 'crypto'

const EVENT_TYPES = new Set(['appointment_created', 'appointment_before', 'appointment_after', 'birthday', 'reactivation'])

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function ownedBusiness() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  return data
}

export async function GET() {
  const business = await ownedBusiness()
  if (!business) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = adminClient()
  const [{ data: rules, error }, { data: evolution }] = await Promise.all([
    admin.from('business_automation_rules').select('*').eq('business_id', business.id).order('sort_order').order('created_at'),
    admin.from('business_evolution_config').select('enabled, last_status, webhook_secret').eq('business_id', business.id).maybeSingle(),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    rules: rules ?? [],
    evolution: {
      enabled: Boolean(evolution?.enabled),
      connected: evolution?.last_status === 'open',
      webhookConfigured: Boolean(evolution?.webhook_secret),
    },
  })
}

export async function POST(req: NextRequest) {
  if (!hasSameOrigin(req)) return NextResponse.json({ error: 'Origem inválida' }, { status: 403 })
  const business = await ownedBusiness()
  if (!business) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? '').trim().slice(0, 100)
  const eventType = String(body.eventType ?? '')
  const offsetMinutes = Number(body.offsetMinutes ?? 0)
  const messageTemplate = String(body.messageTemplate ?? '').trim().slice(0, 4000)

  if (!name || !EVENT_TYPES.has(eventType) || !Number.isInteger(offsetMinutes) || offsetMinutes < 0 || offsetMinutes > 525600 || !messageTemplate) {
    return NextResponse.json({ error: 'Dados da automação inválidos' }, { status: 400 })
  }

  const admin = adminClient()
  const { data, error } = await admin
    .from('business_automation_rules')
    .insert({
      business_id: business.id,
      rule_key: `custom_${randomUUID()}`,
      name,
      event_type: eventType,
      offset_minutes: offsetMinutes,
      enabled: Boolean(body.enabled ?? true),
      message_template: messageTemplate,
      requires_reply_confirmation: false,
      is_system: false,
      sort_order: 100,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

export async function PATCH(req: NextRequest) {
  if (!hasSameOrigin(req)) return NextResponse.json({ error: 'Origem inválida' }, { status: 403 })
  const business = await ownedBusiness()
  if (!business) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  if (!id) return NextResponse.json({ error: 'Automação inválida' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 100)
  if (typeof body.messageTemplate === 'string' && body.messageTemplate.trim()) patch.message_template = body.messageTemplate.trim().slice(0, 4000)
  if (Number.isInteger(body.offsetMinutes) && body.offsetMinutes >= 0 && body.offsetMinutes <= 525600) patch.offset_minutes = body.offsetMinutes
  if (typeof body.requiresReplyConfirmation === 'boolean') patch.requires_reply_confirmation = body.requiresReplyConfirmation

  const admin = adminClient()
  const { data, error } = await admin
    .from('business_automation_rules')
    .update(patch)
    .eq('id', id)
    .eq('business_id', business.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

export async function DELETE(req: NextRequest) {
  if (!hasSameOrigin(req)) return NextResponse.json({ error: 'Origem inválida' }, { status: 403 })
  const business = await ownedBusiness()
  if (!business) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Automação inválida' }, { status: 400 })

  const admin = adminClient()
  const { error } = await admin
    .from('business_automation_rules')
    .delete()
    .eq('id', id)
    .eq('business_id', business.id)
    .eq('is_system', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
