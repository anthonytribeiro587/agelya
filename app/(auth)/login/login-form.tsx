'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { safeInternalPath } from '@/lib/safe-redirect'
import { PasswordInput } from '@/components/ui/password-input'

interface LoginFormProps {
  redirectTo?: string
  labels: {
    emailLabel: string
    emailPlaceholder: string
    passwordLabel: string
    passwordPlaceholder: string
    forgotPassword: string
    submitButton: string
  }
}

function authErrorMessage(error: { code?: string; message?: string }) {
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Abra o e-mail de confirmação e tente novamente.'
  }
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  if (code === 'over_request_rate_limit' || message.includes('rate limit')) {
    return 'Muitas tentativas seguidas. Aguarde um pouco e tente novamente.'
  }
  return 'Não foi possível entrar. Tente novamente.'
}

export function LoginForm({ redirectTo, labels }: LoginFormProps) {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(authErrorMessage(authError))
        setLoading(false)
        return
      }

      if (!data.session) {
        setError('A autenticação foi aceita, mas a sessão não foi criada. Tente novamente.')
        setLoading(false)
        return
      }

      window.location.assign(safeInternalPath(redirectTo))
    } catch {
      setError('Não foi possível conectar ao serviço de autenticação. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-[#f8e8e5] border border-[#ebcbc7] text-[#8a4842] text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-[#53685d] mb-1.5" htmlFor="email">
          {labels.emailLabel}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-[#d9cec1] bg-[#fffdf9] rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7d9d84]/30 focus:border-[#91aa96]"
          placeholder={labels.emailPlaceholder}
        />
      </div>

      <div>
        <PasswordInput
          id="password"
          name="password"
          label={labels.passwordLabel}
          placeholder={labels.passwordPlaceholder}
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="text-right mt-1.5">
          <a href="/forgot-password" className="text-xs font-semibold text-[#3b6d50] hover:underline">
            {labels.forgotPassword}
          </a>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-[#245b3e] text-[#fbf8f0] rounded-2xl px-4 text-sm font-semibold shadow-[0_10px_24px_rgba(36,91,62,.16)] hover:bg-[#1e4f35] hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
      >
        {loading ? 'Entrando…' : labels.submitButton}
      </button>
    </form>
  )
}
