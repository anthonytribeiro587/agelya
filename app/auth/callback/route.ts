import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient, type EmailOtpType } from '@supabase/supabase-js'
import { slugify } from '@/lib/utils'
import { safeInternalPath } from '@/lib/safe-redirect'
import { insertOwnerAsEmployee } from '@/lib/create-business'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin: requestOrigin } = new URL(request.url)
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || requestOrigin).replace(/\/$/, '')
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeInternalPath(searchParams.get('next'))
  const providerError = searchParams.get('error_description') || searchParams.get('error')

  if (providerError) {
    console.error('[auth/callback] Supabase returned an error:', providerError)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Não foi possível confirmar seu acesso. Solicite um novo link e tente novamente.')}`
    )
  }

  const supabase = createClient()
  let user = null
  let authError: string | null = null

  // OAuth / PKCE callback.
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    user = data.user
    authError = error?.message ?? null
  }

  // Recommended SSR email confirmation flow. This does not depend on the
  // browser retaining the PKCE verifier cookie from the signup request.
  if (!user && tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    user = data.user
    authError = error?.message ?? null
  }

  if (!user) {
    console.error('[auth/callback] Authentication failed:', {
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type,
      error: authError,
    })
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Não foi possível confirmar seu acesso. Solicite um novo link e tente novamente.')}`
    )
  }

  // Password reset — session is established, go straight to password update.
  if (next === '/reset-password') {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: existing } = await admin
    .from('businesses')
    .select('id, onboarding_completed')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!existing) {
    const businessName =
      (user.user_metadata?.business_name as string) ||
      (user.user_metadata?.full_name as string) ||
      (user.email?.split('@')[0] ?? 'Meu negócio')

    const baseSlug = slugify(businessName)
    let slug = baseSlug
    let attempt = 0

    while (true) {
      const { data: taken } = await admin
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      if (!taken) break
      attempt++
      slug = `${baseSlug}-${attempt}`
    }

    const { data: newBusiness } = await admin
      .from('businesses')
      .insert({
        owner_id: user.id,
        name: businessName,
        slug,
      })
      .select('id')
      .single()

    if (newBusiness) {
      await insertOwnerAsEmployee(admin, newBusiness.id, user)
    }

    return NextResponse.redirect(`${origin}/onboarding`)
  }

  if (!existing.onboarding_completed) {
    return NextResponse.redirect(`${origin}/onboarding`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
