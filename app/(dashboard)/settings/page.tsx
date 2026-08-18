import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { getTranslations } from 'next-intl/server'
import { SettingsTabs } from './settings-tabs'

export default async function SettingsPage() {
  const supabase = createClient()
  const t = await getTranslations('settings')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, type, phone, email, address, timezone, currency, brand_color, notification_language')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!business) redirect('/onboarding')

  const [
    { data: services },
    { data: employees },
    { data: businessHours },
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, price, duration_min, category, is_active, capacity')
      .eq('business_id', business.id)
      .order('name'),
    supabase
      .from('employees')
      .select('id, name, role, email, phone, is_active')
      .eq('business_id', business.id)
      .order('name'),
    supabase
      .from('business_hours')
      .select('day_of_week, is_open, open_time, close_time')
      .eq('business_id', business.id)
      .order('day_of_week'),
  ])

  return (
    <>
      <Header title={t('title')} />
      <SettingsTabs
        business={business}
        services={services ?? []}
        employees={employees ?? []}
        workingHours={businessHours ?? []}
        userEmail={user.email ?? ''}
      />
    </>
  )
}
