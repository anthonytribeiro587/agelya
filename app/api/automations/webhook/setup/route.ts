import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSameOrigin } from '@/lib/request-security'
import { setEvolutionWebhook } from '@/lib/evolution'

export async function POST(req: NextRequest) {
  if (!hasSameOrigin(req)) return NextResponse.json({ error: 'Origem inválida' }, { status: 403 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!business) return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: config, error } = await admin
    .from('business_evolution_config')
    .select('api_url, api_key, instance_name, enabled, webhook_secret')
    .eq('business_id', business.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!config?.enabled || !config.api_url || !config.api_key || !config.instance_name) {
    return NextResponse.json({ error: 'Ative e salve a Evolution API em Configurações → Notificações primeiro.' }, { status: 400 })
  }

  const secret = config.webhook_secret || randomBytes(32).toString('hex')
  const appOrigin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const webhookUrl = `${appOrigin}/api/evolution/webhook/${business.id}`

  try {
    await setEvolutionWebhook(
      { apiUrl: config.api_url, apiKey: config.api_key, instance: config.instance_name },
      webhookUrl,
      secret
    )

    const { error: updateError } = await admin
      .from('business_evolution_config')
      .update({ webhook_secret: secret, updated_at: new Date().toISOString() })
      .eq('business_id', business.id)

    if (updateError) throw updateError
    return NextResponse.json({ ok: true, webhookUrl })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Não foi possível configurar o webhook da Evolution.' },
      { status: 502 }
    )
  }
}
