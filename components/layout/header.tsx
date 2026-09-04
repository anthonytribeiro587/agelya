'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'

interface HeaderProps {
  title: string
  actions?: React.ReactNode
}

export function Header({ title, actions }: HeaderProps) {
  const actionsRef = useRef<HTMLDivElement>(null)
  const [actionsOverflow, setActionsOverflow] = useState(false)

  useEffect(() => {
    function measure() {
      const el = actionsRef.current
      if (!el) return
      setActionsOverflow(el.scrollWidth > el.clientWidth + 1)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [actions])

  return (
    <header className="min-h-[68px] md:min-h-[76px] border-b border-[#e3d9cd] bg-[#f8f3eb]/82 backdrop-blur-xl flex items-center px-4 md:px-7 gap-4 sticky top-0 z-20">
      <div className="min-w-0 flex-1">
        <h1 className="agelya-serif text-[25px] md:text-[30px] leading-none font-semibold tracking-[-0.025em] text-[#18452f] truncate">
          {title}
        </h1>
        <div className="mt-2 h-px w-14 bg-gradient-to-r from-[#b89c68] to-transparent" />
      </div>

      {actions && (
        <div className="relative min-w-0">
          <div
            ref={actionsRef}
            className="flex items-center gap-2 overflow-x-auto flex-nowrap min-w-0 max-w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {actions}
          </div>
          {actionsOverflow && (
            <div className="pointer-events-none absolute top-0 right-0 h-full w-6 bg-gradient-to-l from-[#f8f3eb] to-transparent" />
          )}
        </div>
      )}

      <button className="grid h-10 w-10 place-items-center rounded-2xl border border-[#ded4c8] bg-[#fffdf9]/90 text-[#557064] hover:bg-white transition-colors shrink-0 shadow-[0_8px_20px_rgba(48,70,57,.06)]">
        <Bell className="w-[18px] h-[18px]" />
      </button>
    </header>
  )
}
