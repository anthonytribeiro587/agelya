import { cn } from '@/lib/utils'

interface AgelyaBrandProps {
  compact?: boolean
  inverse?: boolean
  className?: string
}

export function AgelyaBrand({ compact = false, inverse = false, className }: AgelyaBrandProps) {
  const stroke = inverse ? '#f7f2e9' : '#245b3e'
  const text = inverse ? 'text-[#f8f4ec]' : 'text-[#17452f]'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span
        className={cn(
          'grid place-items-center rounded-full border',
          compact ? 'h-9 w-9' : 'h-11 w-11',
          inverse ? 'border-white/30 bg-white/5' : 'border-[#7f9b86]/50 bg-[#f9f6ef]'
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 48 48" className={compact ? 'h-6 w-6' : 'h-7 w-7'} fill="none">
          <path d="M24 38c0-8.8 5.1-14.9 13.8-18.3-1.2 8.4-5.8 14.5-13.8 18.3Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M24 38c0-8.8-5.1-14.9-13.8-18.3 1.2 8.4 5.8 14.5 13.8 18.3Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M24 37.5c-4.8-7.2-4.8-14.4 0-21.5 4.8 7.1 4.8 14.3 0 21.5Z" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="24" cy="10" r="4.2" stroke={stroke} strokeWidth="1.8"/>
          <path d="M10 37.5c4.1 2.1 8.8 3.1 14 3.1s9.9-1 14-3.1" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </span>
      <span className={cn('agelya-serif font-semibold leading-none tracking-[-0.035em]', compact ? 'text-[24px]' : 'text-[30px]', text)}>
        Agelya
      </span>
    </div>
  )
}
