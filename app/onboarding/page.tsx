import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { OnboardingWizard } from './OnboardingWizard'
import { slugify } from '@/lib/utils'
import { insertOwnerAsEmployee } from '@/lib/create-business'

export default async function OnboardingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: business } = await supabase
    .from('businesses')
    .select('id, slug, name, onboarding_completed')
    .eq('owner_id', user.id)
    .maybeSingle()

  // Recovery path for users created before the business row existed.
  if (!business) {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const businessName =
      (user.user_metadata?.business_name as string) ||
      (user.user_metadata?.full_name as string) ||
      (user.email?.split('@')[0] ?? 'Meu negócio')

    const baseSlug = slugify(businessName) || `negocio-${user.id.slice(0, 8)}`
    let slug = baseSlug
    let attempt = 0

    while (true) {
      const { data: taken } = await admin
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      if (!taken) break
      attempt += 1
      slug = `${baseSlug}-${attempt}`
    }

    const { data: createdBusiness, error: createError } = await admin
      .from('businesses')
      .insert({
        owner_id: user.id,
        name: businessName,
        slug,
      })
      .select('id, slug, name, onboarding_completed')
      .single()

    if (createError || !createdBusiness) {
      console.error('[onboarding] failed to recover missing business:', createError?.message)
      redirect('/login?error=Não+foi+possível+preparar+seu+negócio.+Tente+novamente+em+instantes.')
    }

    await insertOwnerAsEmployee(admin, createdBusiness.id, user)
    business = createdBusiness
  }

  if (business.onboarding_completed) {
    const isSaas = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'saas'
    if (isSaas && business.slug) {
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'trypronto.app'
      redirect(`https://${business.slug}.${rootDomain}/dashboard`)
    }
    redirect('/dashboard')
  }

  const isSaas = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE === 'saas'

  return (
    <OnboardingWizard
      initialSlug={business.slug ?? ''}
      initialName={business.name ?? ''}
      isSaas={isSaas}
      rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'trypronto.app'}
    />
  )
}
