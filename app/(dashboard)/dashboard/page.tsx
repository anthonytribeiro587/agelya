import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatInBusinessTimezone } from '@/lib/utils'
import {
  Users,
  Package,
  CalendarDays,
  TrendingUp,
  ArrowUpRight,
  CalendarPlus,
  UserPlus,
  Zap,
  Clock3,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { OnboardingChecklist } from '@/components/onboarding-checklist'

const STATUS_STRIPE: Record<string, string> = {
  pending: '#b49a64',
  confirmed: '#4f7d60',
  completed: '#6c846d',
  paid: '#8a7448',
  cancelled: '#b85b5b',
  no_show: '#9d7b64',
}

export default async function DashboardPage() {
  const supabase = createClient()
  const t = await getTranslations('dashboard')
  const { data: { user } } = await supabase.auth.getUser()

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, currency, timezone, onboarding_completed, enabled_modules')
    .eq('owner_id', user!.id)
    .maybeSingle()

  if (!business) return null
  if (!business.onboarding_completed) redirect('/onboarding')

  const todayStr = new Date().toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)

  const [
    { count: clientCount },
    { data: apptToday },
    { data: recentTransactions },
    { data: upcomingAppointments },
    { data: todayRevenue },
    { data: inventoryItems },
    { data: sparklineRaw },
  ] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('appointments').select('id, status')
      .eq('business_id', business.id)
      .gte('starts_at', todayStr)
      .lt('starts_at', new Date(Date.now() + 86400000).toISOString().slice(0, 10)),
    supabase.from('transactions').select('id, amount, payment_method, created_at, clients(name)')
      .eq('business_id', business.id).eq('status', 'completed')
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('appointments')
      .select('id, starts_at, status, clients(name), services(name)')
      .eq('business_id', business.id)
      .gte('starts_at', new Date().toISOString())
      .in('status', ['pending', 'confirmed'])
      .order('starts_at', { ascending: true }).limit(5),
    supabase.from('transactions').select('amount')
      .eq('business_id', business.id).eq('status', 'completed')
      .gte('created_at', todayStr),
    supabase.from('inventory_items')
      .select('quantity, low_stock_threshold')
      .eq('business_id', business.id),
    supabase.from('transactions').select('amount, created_at')
      .eq('business_id', business.id).eq('status', 'completed')
      .gte('created_at', sevenDaysAgo),
  ])

  const revenueToday = todayRevenue?.reduce((sum, tx) => sum + tx.amount, 0) ?? 0
  const lowStock = (inventoryItems ?? []).filter(
    (item) => Number(item.quantity) <= Number(item.low_stock_threshold)
  ).length

  const sparklineDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000)
    return d.toISOString().slice(0, 10)
  })
  const sparklineByDay: Record<string, number> = {}
  for (const day of sparklineDays) sparklineByDay[day] = 0
  for (const tx of sparklineRaw ?? []) {
    const day = tx.created_at.slice(0, 10)
    if (day in sparklineByDay) sparklineByDay[day] += tx.amount
  }
  const sparklineValues = sparklineDays.map((d) => sparklineByDay[d])
  const sparklineMax = Math.max(...sparklineValues, 1)

  const apptTodayCount = apptToday?.length ?? 0
  const statusBreakdown: Record<string, number> = {}
  for (const a of apptToday ?? []) {
    statusBreakdown[a.status] = (statusBreakdown[a.status] ?? 0) + 1
  }
  const breakdownParts = (['confirmed', 'pending', 'completed'] as const)
    .filter((s) => (statusBreakdown[s] ?? 0) > 0)
    .map((s) => `${statusBreakdown[s]} ${t(`appointmentStatus.${s}` as any)}`)

  const statusColors: Record<string, string> = {
    pending: 'bg-[#f4ead3] text-[#816d43]',
    confirmed: 'bg-[#dce8dd] text-[#315b42]',
    completed: 'bg-[#e5eadf] text-[#53664e]',
    paid: 'bg-[#ece3cd] text-[#745f35]',
    cancelled: 'bg-[#f5dfdc] text-[#8c4a45]',
    no_show: 'bg-[#eee6df] text-[#766b63]',
  }

  const nextAppointment = upcomingAppointments?.[0]

  return (
    <>
      <Header title={t('title')} />
      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1500px] w-full mx-auto">
        <OnboardingChecklist
          businessId={business.id}
          enabledModules={business.enabled_modules ?? ['bookings', 'pos', 'crm', 'inventory', 'notifications']}
        />

        <section className="flex flex-col gap-1">
          <p className="text-sm font-medium text-[#6f7d74]">Olá, {business.name} 🌿</p>
          <h2 className="agelya-serif text-[34px] sm:text-[42px] leading-[1.04] tracking-[-0.035em] text-[#173f2d]">
            Seu dia começa com bem-estar.
          </h2>
        </section>

        <section className="grid xl:grid-cols-[1.25fr_.75fr] gap-5">
          <div className="wellness-dark-card p-5 sm:p-7 relative overflow-hidden min-h-[260px]">
            <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full border border-white/10" />
            <div className="absolute -right-4 -top-4 h-36 w-36 rounded-full border border-white/10" />

            <div className="relative z-10 flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[.18em] text-white/55">Próximo atendimento</p>
                  <h3 className="agelya-serif mt-2 text-[30px] sm:text-[38px] leading-none text-white">
                    {nextAppointment
                      ? (nextAppointment.services as { name: string } | null)?.name ?? 'Atendimento'
                      : 'Agenda tranquila'}
                  </h3>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 border border-white/10">
                  <CalendarDays className="h-5 w-5 text-[#dbe6d5]" />
                </div>
              </div>

              {nextAppointment ? (
                <div className="mt-auto pt-10">
                  <div className="text-white/90 text-base font-medium">
                    {(nextAppointment.clients as { name: string } | null)?.name ?? t('upcomingAppointments.walkIn')}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/60">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-4 w-4" />
                      {formatInBusinessTimezone(nextAppointment.starts_at, business.timezone)}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${nextAppointment.status === 'confirmed' ? 'bg-[#dce8dd] text-[#315b42]' : 'bg-white/10 text-white/80'}`}>
                      {t(`appointmentStatus.${nextAppointment.status}` as any)}
                    </span>
                  </div>
                  <Link
                    href="/booking"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
                  >
                    Abrir agenda
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="mt-auto pt-10">
                  <p className="max-w-md text-sm leading-6 text-white/65">
                    Nenhum atendimento próximo. Aproveite para organizar clientes, pacotes e automações.
                  </p>
                  <Link
                    href="/booking"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#f6f1e7] px-4 py-2.5 text-sm font-semibold text-[#24553b]"
                  >
                    Criar agendamento
                    <CalendarPlus className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          <Card className="p-1">
            <CardHeader className="pb-2">
              <CardTitle>Atalhos rápidos</CardTitle>
              <p className="text-sm text-[#7c837e]">As ações mais usadas no dia a dia.</p>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 xl:grid-cols-1 gap-3">
              <Link href="/booking" className="group rounded-2xl border border-[#e3d9cd] bg-[#faf7f1] p-4 hover:bg-[#f2f4ec] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#dfe8db] text-[#2a5b41]">
                    <CalendarPlus className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[#234a37]">Novo agendamento</div>
                    <div className="text-xs text-[#879088] mt-0.5">Reserve um horário</div>
                  </div>
                </div>
              </Link>

              <Link href="/crm/new" className="group rounded-2xl border border-[#e3d9cd] bg-[#faf7f1] p-4 hover:bg-[#f2f4ec] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#ebe4d5] text-[#755f3e]">
                    <UserPlus className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[#234a37]">Novo cliente</div>
                    <div className="text-xs text-[#879088] mt-0.5">Abra o prontuário</div>
                  </div>
                </div>
              </Link>

              <Link href="/automations" className="group rounded-2xl border border-[#e3d9cd] bg-[#faf7f1] p-4 hover:bg-[#f2f4ec] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e1e9df] text-[#355f45]">
                    <Zap className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[#234a37]">Automações</div>
                    <div className="text-xs text-[#879088] mt-0.5">WhatsApp e confirmações</div>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <Link href="/pos/history">
            <Card className="h-full hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(44,65,53,.09)] transition-all">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#dfe8db]">
                    <TrendingUp className="w-[18px] h-[18px] text-[#2d6647]" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#9b9b94]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#173d2d]">{formatCurrency(revenueToday, business.currency)}</div>
                <div className="text-xs sm:text-sm text-[#7b827d] mt-1">{t('stats.revenueToday')}</div>
                <div className="flex items-end gap-[3px] mt-3 h-6">
                  {sparklineValues.map((val, i) => {
                    const barH = Math.max(4, Math.round((val / sparklineMax) * 24))
                    return (
                      <div
                        key={i}
                        style={{
                          width: 6,
                          height: barH,
                          backgroundColor: i === 6 ? '#315f44' : '#c9d8c7',
                          borderRadius: 999,
                          flexShrink: 0,
                        }}
                      />
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/booking">
            <Card className="h-full hover:-translate-y-0.5 transition-all">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e8e2d3]">
                    <CalendarDays className="w-[18px] h-[18px] text-[#735f3e]" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#9b9b94]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#173d2d]">{apptTodayCount}</div>
                <div className="text-xs sm:text-sm text-[#7b827d] mt-1">{t('stats.appointmentsToday')}</div>
                {breakdownParts.length > 0 && (
                  <div className="mt-2 text-[#9b9c96] truncate text-[11px]">
                    {breakdownParts.join(' · ')}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link href="/crm">
            <Card className="h-full hover:-translate-y-0.5 transition-all">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e4e9df]">
                    <Users className="w-[18px] h-[18px] text-[#4f6757]" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#9b9b94]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#173d2d]">{String(clientCount ?? 0)}</div>
                <div className="text-xs sm:text-sm text-[#7b827d] mt-1">{t('stats.totalClients')}</div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/inventory">
            <Card className="h-full hover:-translate-y-0.5 transition-all">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className={`grid h-10 w-10 place-items-center rounded-2xl ${lowStock > 0 ? 'bg-[#f0e1d6]' : 'bg-[#dfe8db]'}`}>
                    <Package className={`w-[18px] h-[18px] ${lowStock > 0 ? 'text-[#9a6544]' : 'text-[#3e684e]'}`} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#9b9b94]" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[#173d2d]">{lowStock > 0 ? String(lowStock) : t('stats.lowStockOk')}</div>
                <div className="text-xs sm:text-sm text-[#7b827d] mt-1">{t('stats.lowStock')}</div>
              </CardContent>
            </Card>
          </Link>
        </section>

        <section className="grid lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{t('upcomingAppointments.heading')}</span>
                <Link href="/booking" className="text-xs font-sans font-semibold text-[#376349] hover:underline">
                  {t('upcomingAppointments.viewAll')}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingAppointments?.length === 0 ? (
                <div className="text-sm text-[#7b827d] py-8 text-center">
                  {t('upcomingAppointments.empty')}{' '}
                  <Link href="/booking" className="text-[#2c6847] hover:underline">{t('upcomingAppointments.addOne')}</Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {upcomingAppointments?.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 py-3 border-b border-[#eee6dc] last:border-0 pl-4 relative">
                      <span
                        className="absolute left-0 top-3 bottom-3"
                        style={{ width: 3, borderRadius: 999, backgroundColor: STATUS_STRIPE[a.status] ?? STATUS_STRIPE.pending }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#244637] truncate">
                          {(a.clients as { name: string } | null)?.name ?? t('upcomingAppointments.walkIn')}
                        </div>
                        <div className="text-xs text-[#879088] mt-1 truncate">
                          {(a.services as { name: string } | null)?.name} · {formatInBusinessTimezone(a.starts_at, business.timezone)}
                        </div>
                      </div>
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0 ${statusColors[a.status]}`}>
                        {t(`appointmentStatus.${a.status}` as any)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{t('recentSales.heading')}</span>
                <Link href="/pos/history" className="text-xs font-sans font-semibold text-[#376349] hover:underline">
                  {t('recentSales.viewAll')}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentTransactions?.length === 0 ? (
                <div className="text-sm text-[#7b827d] py-8 text-center">
                  {t('recentSales.empty')}{' '}
                  <Link href="/pos" className="text-[#2c6847] hover:underline">{t('recentSales.makeFirst')}</Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentTransactions?.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between gap-3 py-3 border-b border-[#eee6dc] last:border-0">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#244637] truncate">
                          {(tx.clients as { name: string } | null)?.name ?? t('recentSales.walkIn')}
                        </div>
                        <div className="text-xs text-[#879088] mt-1 capitalize">
                          {tx.payment_method} · {formatInBusinessTimezone(tx.created_at, business.timezone)}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-[#244637] shrink-0">
                        {formatCurrency(tx.amount, business.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  )
}
