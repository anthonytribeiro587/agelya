/**
 * POST /api/book
 * Server-side public booking submission with validation and rate limiting.
 * Agelya currently uses WhatsApp as the required customer contact channel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, getIp } from '@/lib/rate-limit'

function sanitizeText(value: string, max = 100): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max)
}

/** Convert a wall-clock date+time in a named IANA timezone to a UTC Date. */
function parseDateTimeInTz(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)

  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0))
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(noonUtc)

  const get = (type: string) => parseInt(parts.find((part) => part.type === type)?.value ?? '0')
  const localNoonMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  )
  const offsetMs = localNoonMs - noonUtc.getTime()

  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMs)
}

const BookingSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  employeeId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  name: z.string().min(1).max(100),
  // E.164: + followed by country code and national subscriber number.
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Invalid phone number'),
})

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  if (!rateLimit(ip, { limit: 20, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = BookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    )
  }

  const { businessId, serviceId, employeeId, date, time, phone } = parsed.data
  const name = sanitizeText(parsed.data.name)
  if (!name) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 422 })
  }

  const legacyPhone = phone.replace(/\D/g, '')
  const supabase = createServiceClient()

  const [{ data: service }, { data: business }] = await Promise.all([
    supabase
      .from('services')
      .select('id, duration_min, price')
      .eq('id', serviceId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('businesses')
      .select('timezone')
      .eq('id', businessId)
      .maybeSingle(),
  ])

  if (!service) {
    return NextResponse.json({ error: 'service_not_found' }, { status: 404 })
  }

  const timezone = business?.timezone ?? 'America/Sao_Paulo'

  // Reuse a customer created by an older Agelya/Pronto version whether the
  // number was stored with or without the leading +. New records are always
  // normalized to E.164 in both contact columns.
  const { data: matches, error: clientLookupError } = await supabase
    .from('clients')
    .select('id, name, phone, whatsapp_number')
    .eq('business_id', businessId)
    .or(`phone.eq.${phone},phone.eq.${legacyPhone},whatsapp_number.eq.${phone},whatsapp_number.eq.${legacyPhone}`)
    .limit(1)

  if (clientLookupError) {
    console.error('[api/book] client lookup:', clientLookupError.message)
    return NextResponse.json({ error: 'client_lookup_failed' }, { status: 500 })
  }

  let clientId: string
  const existing = matches?.[0] ?? null

  if (existing) {
    clientId = existing.id
    const updates: { name?: string; phone?: string; whatsapp_number?: string } = {}
    if (existing.name !== name) updates.name = name
    if (existing.phone !== phone) updates.phone = phone
    if (existing.whatsapp_number !== phone) updates.whatsapp_number = phone

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId)

      if (updateError) {
        console.error('[api/book] client update:', updateError.message)
        return NextResponse.json({ error: 'client_update_failed' }, { status: 500 })
      }
    }
  } else {
    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({
        business_id: businessId,
        name,
        phone,
        whatsapp_number: phone,
        email: null,
      })
      .select('id')
      .single()

    if (insertError || !newClient) {
      console.error('[api/book] client insert:', insertError?.message)
      return NextResponse.json({ error: 'client_creation_failed' }, { status: 500 })
    }
    clientId = newClient.id
  }

  const startsAt = parseDateTimeInTz(date, time, timezone)
  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000)

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .insert({
      business_id: businessId,
      client_id: clientId,
      employee_id: employeeId ?? null,
      service_id: serviceId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price: service.price,
      status: 'confirmed',
      source: 'online',
    })
    .select('id')
    .single()

  if (appointmentError || !appointment) {
    if (appointmentError?.message?.includes('no_staff_available')) {
      return NextResponse.json(
        {
          error: 'no_staff_available',
          message: 'Não há profissional disponível para receber este agendamento agora.',
        },
        { status: 409 }
      )
    }

    if (appointmentError?.message?.includes('slot_already_booked')) {
      return NextResponse.json(
        {
          error: 'slot_taken',
          message: 'Este horário acabou de ser reservado. Escolha outro horário.',
        },
        { status: 409 }
      )
    }

    console.error('[api/book] appointment insert:', appointmentError?.message)
    return NextResponse.json({ error: 'booking_failed' }, { status: 500 })
  }

  // Keep booking creation independent from notification availability, but wait
  // for the internal request so Vercel does not terminate it after this response.
  try {
    const confirmResponse = await fetch(`${req.nextUrl.origin}/api/email/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET ?? ''}`,
      },
      body: JSON.stringify({ appointmentId: appointment.id }),
      cache: 'no-store',
    })

    if (!confirmResponse.ok) {
      const details = await confirmResponse.text().catch(() => '')
      console.error('[api/book] WhatsApp confirmation:', confirmResponse.status, details)
    }
  } catch (error) {
    console.error('[api/book] WhatsApp confirmation request:', error)
  }

  return NextResponse.json({
    appointmentId: appointment.id,
    clientId,
    hasTelegram: false,
    hasViber: false,
  })
}
