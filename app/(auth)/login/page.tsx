import { loginWithGoogle } from './actions'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; error?: string }
}) {
  const t = await getTranslations('auth.login')
  const googleAuthEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

  return (
    <div className="agelya-auth-card rounded-[28px] p-6 sm:p-8">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#879188]">Bem-vindo de volta</p>
        <h1 className="agelya-serif mt-2 text-[34px] leading-none font-semibold tracking-[-.035em] text-[#17452f]">
          {t('heading')}
        </h1>
        <div className="mt-4 h-px w-16 bg-gradient-to-r from-[#b79a67] to-transparent" />
      </div>

      {searchParams.error && (
        <div className="bg-[#f8e8e5] border border-[#ebcbc7] text-[#8a4842] text-sm rounded-xl px-4 py-3 mb-4">
          {searchParams.error}
        </div>
      )}

      {googleAuthEnabled && (
        <>
          <form action={loginWithGoogle}>
            <input type="hidden" name="redirectTo" value={searchParams.redirectTo ?? '/dashboard'} />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 border border-[#d9cec1] bg-[#fffdf9] rounded-xl px-4 py-3 text-sm font-semibold text-[#425d50] hover:bg-[#f3efe7] transition-colors mb-4"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 0 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t('googleButton')}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e5dbcf]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[.16em] text-[#a09f98]">
              <span className="bg-[#fffdf9] px-3">{t('divider')}</span>
            </div>
          </div>
        </>
      )}

      <LoginForm
        redirectTo={searchParams.redirectTo}
        labels={{
          emailLabel: t('emailLabel'),
          emailPlaceholder: t('emailPlaceholder'),
          passwordLabel: t('passwordLabel'),
          passwordPlaceholder: t('passwordPlaceholder'),
          forgotPassword: t('forgotPassword'),
          submitButton: t('submitButton'),
        }}
      />

      <p className="text-sm text-[#7e8881] text-center mt-6">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-semibold text-[#2b6848] hover:underline">Criar conta</Link>
      </p>
    </div>
  )
}
