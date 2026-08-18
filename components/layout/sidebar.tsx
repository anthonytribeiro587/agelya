'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, ShoppingCart, Users, CalendarDays, Settings, LogOut, Menu, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { LangSwitcher } from './lang-switcher'

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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navLinks = (
    <>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'text-[#4ade80]' : 'text-white/[0.55] hover:text-white/80'
              )}
              style={active ? { backgroundColor: 'rgba(22,163,74,0.15)' } : undefined}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = ''
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-white/10 space-y-0.5">
        <LangSwitcher />
        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            pathname.startsWith('/settings') ? 'text-[#4ade80]' : 'text-white/[0.55] hover:text-white/80'
          )}
          style={pathname.startsWith('/settings') ? { backgroundColor: 'rgba(22,163,74,0.15)' } : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {t('settings')}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/[0.55] hover:text-white/80 hover:bg-white/[0.08] transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t('signOut')}
        </button>
      </div>
    </>
  )

  return (
    <>
      <div className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
        <button onClick={() => setOpen(true)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100" aria-label={t('openMenu')}>
          <Menu className="w-5 h-5" />
        </button>
        <div className="font-bold text-base text-gray-900">Agelya<span className="text-green-600">.</span></div>
        <div className="text-sm text-gray-500 truncate flex-1">{businessName}</div>
      </div>

      {open && <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />}

      <aside className="hidden md:flex w-60 shrink-0 flex-col h-screen sticky top-0 border-r border-white/10 bg-[#0d1b2e]">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="font-bold text-lg text-white">Agelya<span className="text-[#4ade80]">.</span></div>
          <div className="text-xs text-white/40 truncate mt-0.5">{businessName}</div>
        </div>
        {navLinks}
      </aside>

      <aside className={cn(
        'md:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r border-white/10 bg-[#0d1b2e] transition-transform duration-200 ease-in-out',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg text-white">Agelya<span className="text-[#4ade80]">.</span></div>
            <div className="text-xs text-white/40 truncate mt-0.5">{businessName}</div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.08]" aria-label={t('closeMenu')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        {navLinks}
      </aside>
    </>
  )
}
