import { updatePassword } from './actions'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <div className="agelya-auth-card rounded-[28px] p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#879188]">Segurança</p>
      <h1 className="agelya-serif mt-2 mb-7 text-[34px] leading-none font-semibold tracking-[-.035em] text-[#17452f]">Set new password</h1>

      {searchParams.error && (
        <div className="bg-[#f8e8e5] border border-[#ebcbc7] text-[#8a4842] text-sm rounded-xl px-4 py-3 mb-4">
          {searchParams.error}
        </div>
      )}

      <form action={updatePassword} className="space-y-4">
        <PasswordInput
          id="password"
          name="password"
          label="New password"
          placeholder="Min. 8 characters"
          required
          autoComplete="new-password"
        />
        <PasswordInput
          id="confirm"
          name="confirm"
          label="Confirm password"
          placeholder="Repeat new password"
          required
          autoComplete="new-password"
        />
        <Button size="lg" type="submit" className="w-full">Update password</Button>
      </form>
    </div>
  )
}
