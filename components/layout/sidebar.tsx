'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  CalendarDays,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { LangSwitcher } from './lang-switcher'
import { AgelyaBrand } from '@/components/brand/agelya-brand'

interface SidebarProps {
  businessName: string
}

export function Sidebar({ businessName }: SidebarProps) {
  const t = useTranslations('sidebar')
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const nav = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/booking', label: t('booking'), icon: CalendarDays },
    { href: '/automations', label: t('automations'), icon: Zap },
    { href: '/crm', label: t('clients'), icon: Users },
    { href: '/pos', label: t('pos'), icon: ShoppingCart },
  ]

  const mobileNav = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/booking', label: t('booking'), icon: CalendarDays },
    { href: '/crm', label: t('clients'), icon: Users },
    { href: '/automations', label: t('automations'), icon: Zap },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navLinks = (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all',
                active
                  ? 'bg-[#dfe8db] text-[#1e5539] shadow-[inset_0_0_0_1px_rgba(91,122,99,.12)]'
                  : 'text-[#63756c] hover:bg-white/60 hover:text-[#244b38]'
              )}
            >
              <span className={cn(
                'grid h-8 w-8 place-items-center rounded-xl transition-colors',
                active ? 'bg-[#245b3e] text-[#f7f3e9]' : 'bg-[#ece5da] text-[#60756a]'
              )}>
                <Icon className="w-4 h-4 shrink-0" />
              </span>
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-[#ddd2c4] space-y-1">
        <LangSwitcher />
        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all',
            pathname.startsWith('/settings')
              ? 'bg-[#dfe8db] text-[#1e5539]'
              : 'text-[#63756c] hover:bg-white/60 hover:text-[#244b38]'
          )}
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#ece5da]">
            <Settings className="w-4 h-4 shrink-0" />
          </span>
          {t('settings')}
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium text-[#7d7067] hover:text-[#6d2d2d] hover:bg-[#f3e7e2] transition-colors"
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#efe8df]">
            <LogOut className="w-4 h-4 shrink-0" />
          </span>
          {t('signOut')}
        </button>
      </div>
    </>
  )

  return (
    <>
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-[#f8f3eb]/95 backdrop-blur-xl border-b border-[#e4d9cc] flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-xl text-[#51685d] hover:bg-white/70"
          aria-label={t('openMenu')}
        >
          <Menu className="w-5 h-5" />
        </button>
        <AgelyaBrand compact className="scale-[.82] origin-left" />
        <div className="text-xs text-[#829087] truncate flex-1 text-right">{businessName}</div>
      </div>

      <div className="md:hidden fixed bottom-3 left-3 right-3 z-30 h-[68px] rounded-[24px] bg-[#1d5138] border border-white/10 shadow-[0_18px_50px_rgba(24,66,46,.28)] flex items-center justify-around px-2">
        {mobileNav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-[#f7f3e8]' : 'text-white/55'
              )}
            >
              <span className={cn(
                'grid h-8 w-8 place-items-center rounded-xl',
                active ? 'bg-white/14' : 'bg-transparent'
              )}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="max-w-[64px] truncate">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setOpen(true)}
          className="flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-medium text-white/55"
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl">
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </span>
          <span>Mais</span>
        </button>
      </div>

      {open && <div className="md:hidden fixed inset-0 z-40 bg-[#153827]/28 backdrop-blur-sm" onClick={() => setOpen(false)} />}

      <aside className="hidden md:flex w-[268px] shrink-0 flex-col h-screen sticky top-0 border-r border-[#ddd2c4] bg-[#f1eadf]/88 backdrop-blur-xl">
        <div className="px-5 py-6 border-b border-[#ddd2c4]">
          <AgelyaBrand />
          <div className="text-xs text-[#849087] truncate mt-3 pl-1">{businessName}</div>
        </div>
        {navLinks}
      </aside>

      <aside className={cn(
        'md:hidden fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[330px] flex flex-col border-r border-[#d9cec0] bg-[#f5efe6] transition-transform duration-200 ease-in-out shadow-2xl',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="px-5 py-5 border-b border-[#ddd2c4] flex items-center justify-between">
          <div className="min-w-0">
            <AgelyaBrand />
            <div className="text-xs text-[#879088] truncate mt-2">{businessName}</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl text-[#768078] hover:bg-white/70"
            aria-label={t('closeMenu')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {navLinks}
      </aside>
    </>
  )
}
