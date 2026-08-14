'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function sanitizeText(value: string): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
}

export async function completeOnboarding(data: {
  bizType: string
  bizName?: string
  serviceName: string
  servicePrice: number
  serviceDuration: number
  slug?: string
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, slug')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) redirect('/login')

  const bizName = data.bizName ? sanitizeText(data.bizName).slice(0, 100) : undefined
  const serviceName = sanitizeText(data.serviceName).slice(0, 100)

  const finalSlug = data.slug ?? business.slug
  if (data.slug) {
    if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(data.slug)) {
      throw new Error('Invalid slug format')
    }
  }

  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      ...(data.bizType ? { type: data.bizType } : {}),
      ...(bizName ? { name: bizName } : {}),
      ...(data.slug ? { slug: data.slug } : {}),
      onboarding_completed: true,
    })
    .eq('id', business.id)

  if (updateError) {
    throw new Error(updateError.message)
  }

  if (serviceName && data.servicePrice) {
    const { error: serviceError } = await supabase.from('services').insert({
      business_id: business.id,
      name: serviceName,
      price: data.servicePrice,
      duration_min: data.serviceDuration || 60,
    })

    if (serviceError) {
      throw new Error(serviceError.message)
    }
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (rootDomain && finalSlug) {
    redirect(`https://${finalSlug}.${rootDomain}/dashboard`)
  }

  redirect('/dashboard')
}
