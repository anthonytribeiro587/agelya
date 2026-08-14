import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getEvolutionConnectionState } from '@/lib/evolution'

export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!business) return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: config, error } = await admin
    .from('business_evolution_config')
    .select('api_url, api_key, instance_name')
    .eq('business_id', business.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const credentials = {
    apiUrl: config?.api_url || process.env.EVOLUTION_API_URL || '',
    apiKey: config?.api_key || process.env.EVOLUTION_API_KEY || '',
    instance: config?.instance_name || process.env.EVOLUTION_INSTANCE || '',
  }

  if (!credentials.apiUrl || !credentials.apiKey || !credentials.instance) {
    return NextResponse.json({ error: 'Salve a configuração da Evolution primeiro.' }, { status: 400 })
  }

  try {
    const result = await getEvolutionConnectionState(credentials)
    await admin
      .from('business_evolution_config')
      .update({
        last_status: result.state,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', business.id)

    return NextResponse.json({ ok: true, state: result.state })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao conectar com a Evolution API'
    await admin
      .from('business_evolution_config')
      .update({
        last_status: 'error',
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('business_id', business.id)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
