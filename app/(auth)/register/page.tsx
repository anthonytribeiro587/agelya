import { register } from './actions'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const t = await getTranslations('auth.register')

  return (
    <div className="agelya-auth-card rounded-[28px] p-6 sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#879188]">Comece por aqui</p>
        <h1 className="agelya-serif mt-2 text-[34px] leading-none font-semibold tracking-[-.035em] text-[#17452f]">{t('heading')}</h1>
        <div className="mt-4 h-px w-16 bg-gradient-to-r from-[#b79a67] to-transparent" />
      </div>

      {searchParams.error && (
        <div className="bg-[#f8e8e5] border border-[#ebcbc7] text-[#8a4842] text-sm rounded-xl px-4 py-3 mb-4">
          {searchParams.error}
        </div>
      )}

      <form action={register} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#53685d] mb-1.5" htmlFor="business_name">
            {t('businessNameLabel')}
          </label>
          <input
            id="business_name" name="business_name" type="text" required
            className="w-full border border-[#d9cec1] bg-[#fffdf9] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7d9d84]/30"
            placeholder={t('businessNamePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#53685d] mb-1.5" htmlFor="email">
            {t('emailLabel')}
          </label>
          <input
            id="email" name="email" type="email" required autoComplete="email"
            className="w-full border border-[#d9cec1] bg-[#fffdf9] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7d9d84]/30"
            placeholder={t('emailPlaceholder')}
          />
        </div>

        <PasswordInput
          id="password"
          name="password"
          label={t('passwordLabel')}
          placeholder={t('passwordPlaceholder')}
          required
          minLength={8}
          autoComplete="new-password"
        />

        <Button size="lg" type="submit" className="w-full">Criar conta</Button>
      </form>

      <p className="text-sm text-[#7e8881] text-center mt-5">
        {t('alreadyHaveAccount')}{' '}
        <Link href="/login" className="font-semibold text-[#2b6848] hover:underline">{t('signIn')}</Link>
      </p>
    </div>
  )
}
