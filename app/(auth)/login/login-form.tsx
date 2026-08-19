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
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
        <div className="text-right mt-1">
          <a href="/forgot-password" className="text-xs text-blue-600 hover:underline">
            {labels.forgotPassword}
          </a>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Entrando…' : labels.submitButton}
      </button>
    </form>
  )
}
