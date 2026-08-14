import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAllowedEvolutionUrl, normalizeEvolutionUrl } from '@/lib/evolution'

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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

  const admin = adminClient()
  const { data, error } = await admin
    .from('business_evolution_config')
    .select('api_url, instance_name, enabled, last_status, last_checked_at, api_key')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    apiUrl: data?.api_url ?? process.env.EVOLUTION_API_URL ?? '',
    instance: data?.instance_name ?? process.env.EVOLUTION_INSTANCE ?? '',
    enabled: data?.enabled ?? false,
    hasApiKey: Boolean(data?.api_key || process.env.EVOLUTION_API_KEY),
    lastStatus: data?.last_status ?? null,
    lastCheckedAt: data?.last_checked_at ?? null,
  })
}

export async function POST(req: NextRequest) {
  const businessId = await ownedBusinessId()
  if (!businessId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const apiUrl = normalizeEvolutionUrl(String(body.apiUrl ?? ''))
  const instance = String(body.instance ?? '').trim()
  const newApiKey = String(body.apiKey ?? '').trim()
  const enabled = Boolean(body.enabled)

  if (!apiUrl || !isAllowedEvolutionUrl(apiUrl)) {
    return NextResponse.json({ error: 'Informe uma URL pública válida da Evolution API.' }, { status: 400 })
  }
  if (!instance || instance.length > 100) {
    return NextResponse.json({ error: 'Informe o nome da instância.' }, { status: 400 })
  }

  const admin = adminClient()
  const { data: current } = await admin
    .from('business_evolution_config')
    .select('api_key')
    .eq('business_id', businessId)
    .maybeSingle()

  const apiKey = newApiKey || current?.api_key || process.env.EVOLUTION_API_KEY || ''
  if (!apiKey) {
    return NextResponse.json({ error: 'Informe a API Key da Evolution.' }, { status: 400 })
  }

  const { error } = await admin
    .from('business_evolution_config')
    .upsert({
      business_id: businessId,
      api_url: apiUrl,
      api_key: apiKey,
      instance_name: instance,
      enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'business_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, hasApiKey: true })
}
