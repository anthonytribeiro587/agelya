import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { normalizeEvolutionPhone } from '@/lib/evolution'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function ownedBusinessId() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return business?.id ?? null
}

export async function GET() {
  const businessId = await ownedBusinessId()
  if (!businessId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await adminClient()
    .from('businesses')
    .select('phone, owner_whatsapp, confirmation_summary_enabled, confirmation_summary_time')
    .eq('id', businessId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    enabled: data.confirmation_summary_enabled ?? true,
    time: String(data.confirmation_summary_time ?? '19:00').slice(0, 5),
    ownerWhatsapp: data.owner_whatsapp ?? data.phone ?? '',
    usingBusinessPhoneAsSuggestion: !data.owner_whatsapp && Boolean(data.phone),
  })
}

export async function POST(req: NextRequest) {
  const businessId = await ownedBusinessId()
  if (!businessId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const enabled = Boolean(body.enabled)
  const time = String(body.time ?? '19:00').trim()
  const digits = normalizeEvolutionPhone(String(body.ownerWhatsapp ?? ''))

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return NextResponse.json({ error: 'Informe um horário válido.' }, { status: 400 })
  }
  if (digits.length < 10 || digits.length > 15) {
    return NextResponse.json({ error: 'Informe o WhatsApp da profissional com DDD e código do país.' }, { status: 400 })
  }

  const { error } = await adminClient()
    .from('businesses')
    .update({
      owner_whatsapp: `+${digits}`,
      confirmation_summary_enabled: enabled,
      confirmation_summary_time: `${time}:00`,
    })
    .eq('id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
