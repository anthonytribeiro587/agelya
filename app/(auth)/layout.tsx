import { getTranslations } from 'next-intl/server'
import { AgelyaBrand } from '@/components/brand/agelya-brand'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('brand')

  return (
    <div className="agelya-auth grid min-h-screen lg:grid-cols-[.9fr_1.1fr]">
      <aside className="relative hidden lg:flex overflow-hidden bg-[#1c4d36] p-10 xl:p-14 text-[#f7f3e9]">
        <div className="absolute -left-28 -bottom-32 h-[430px] w-[430px] rounded-full border border-white/10" />
        <div className="absolute -left-12 -bottom-16 h-[300px] w-[300px] rounded-full border border-white/10" />
        <div className="absolute -right-28 top-10 h-[360px] w-[360px] rounded-full border border-white/10" />
        <div className="absolute right-14 top-24 h-32 w-20 rotate-[-18deg] opacity-20">
          <svg viewBox="0 0 80 130" fill="none" className="h-full w-full">
            <path d="M39 124C39 80 49 44 68 10M40 88C25 75 17 58 15 37M45 66C58 55 66 42 69 25M38 104C24 98 14 89 8 77" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="relative z-10 flex max-w-xl flex-col">
          <AgelyaBrand inverse />
          <div className="mt-auto pb-8">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-white/45">Cuidado • organização • presença</p>
            <h1 className="agelya-serif mt-5 text-[54px] xl:text-[66px] leading-[.96] tracking-[-.045em]">
              Seu negócio de bem-estar,
              <br />
              mais leve de gerir.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/62">
              Agenda, clientes, prontuário, pacotes e relacionamento em uma experiência pensada para profissionais de cuidado.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <AgelyaBrand className="justify-center" />
            <p className="text-center text-sm text-[#78847c] mt-3">{t('tagline')}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
