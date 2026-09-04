import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, slug, plan')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!business) redirect('/onboarding')

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  if (rootDomain && business?.slug) {
    const headersList = headers()
    const host = headersList.get('host') ?? ''
    if (host === rootDomain || host === `www.${rootDomain}`) {
      const pathname = headersList.get('x-pathname') ?? '/dashboard'
      redirect(`https://${business.slug}.${rootDomain}${pathname}`)
    }
  }

  return (
    <div className="agelya-app fixed inset-0 flex overflow-hidden">
      <Sidebar businessName={business.name} />
      <div className="agelya-content flex-1 flex flex-col min-w-0 overflow-y-auto pt-14 pb-20 md:pt-0 md:pb-0">
        {children}
      </div>
    </div>
  )
}
