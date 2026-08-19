import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBusinessConfirmationSummary } from '@/lib/daily-confirmation-summary'

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

export async function POST() {
  const businessId = await ownedBusinessId()
  if (!businessId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const result = await sendBusinessConfirmationSummary(businessId, { force: true })
    if (!result.sent) {
      const messages: Record<string, string> = {
        owner_phone_missing: 'Informe o WhatsApp da profissional antes de testar.',
        evolution_disabled: 'Ative a Evolution API antes de testar.',
        business_not_found: 'Negócio não encontrado.',
        appointments_unavailable: 'Não foi possível consultar os atendimentos de amanhã.',
      }
      return NextResponse.json(
        { error: messages[result.reason] ?? 'Não foi possível enviar o resumo.' },
        { status: 400 }
      )
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('[summary test]', error)
    return NextResponse.json({ error: 'Falha ao enviar o resumo de teste.' }, { status: 500 })
  }
}
