'use server'

import { createClient } from '@/lib/supabase/server'
import { safeInternalPath } from '@/lib/safe-redirect'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = createClient()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const redirectTo = safeInternalPath(formData.get('redirectTo'))

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    redirect(`/login?error=${encodeURIComponent('E-mail ou senha incorretos')}`)
  }

  redirect(redirectTo)
}

export async function loginWithGoogle(formData: FormData) {
  const supabase = createClient()
  const redirectTo = safeInternalPath(formData.get('redirectTo'))
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

  if (!siteUrl) {
    redirect(`/login?error=${encodeURIComponent('Login com Google indisponível')}`)
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
    },
  })

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent('Falha ao entrar com o Google')}`)
  }

  redirect(data.url)
}
