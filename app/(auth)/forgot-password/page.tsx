import { requestPasswordReset } from './actions'
import Link from 'next/link'
import { SubmitButton } from './SubmitButton'

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { sent?: string; email?: string }
}) {
  if (searchParams.sent) {
    return (
      <div className="agelya-auth-card rounded-[28px] p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#879188]">Recuperação de acesso</p>
        <h1 className="agelya-serif mt-2 text-[34px] leading-none font-semibold tracking-[-.035em] text-[#17452f]">Check your email</h1>
        <p className="text-sm text-[#687970] mt-4 mb-6 leading-6">
          We sent a password reset link to <strong>{searchParams.email}</strong>.
          Click it to set a new password.
        </p>
        <Link href="/login" className="text-sm font-semibold text-[#2b6848] hover:underline">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="agelya-auth-card rounded-[28px] p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#879188]">Recuperação de acesso</p>
      <h1 className="agelya-serif mt-2 text-[34px] leading-none font-semibold tracking-[-.035em] text-[#17452f]">Reset your password</h1>
      <p className="text-sm text-[#718078] mt-4 mb-6 leading-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form action={requestPasswordReset} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#53685d] mb-1.5" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full border border-[#d9cec1] bg-[#fffdf9] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7d9d84]/30"
            placeholder="you@example.com"
          />
        </div>
        <SubmitButton />
      </form>

      <div className="mt-6">
        <Link href="/login" className="text-sm font-semibold text-[#2b6848] hover:underline">
          ← Back to sign in
        </Link>
      </div>
    </div>
  )
}
