/**
 * POST /api/book
 * Server-side public booking submission with validation and rate limiting.
 * Agelya currently uses WhatsApp as the required customer contact channel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { rateLimit, getIp } from '@/lib/rate-limit'
import { sendBookingCreatedAutomation } from '@/lib/send-booking-automation'

function sanitizeText(value: string, max = 100): string {
  return value
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max)
}

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
    get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second')
  )
  const offsetMs = localNoonMs - noonUtc.getTime()
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMs)
}

function minutesOf(time: string) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours * 60 + minutes
}

const BookingSchema = z.object({
  businessId: z.string().uuid(),
  serviceId: z.string().uuid(),
  employeeId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time format'),
  name: z.string().min(1).max(100),
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
  if (!name) return NextResponse.json({ error: 'invalid_name' }, { status: 422 })

  const legacyPhone = phone.replace(/\D/g, '')
  const supabase = createServiceClient()

  const [
    { data: service },
    { data: business },
    { data: confirmationRule },
  ] = await Promise.all([
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
    supabase
      .from('business_automation_rules')
      .select('enabled, requires_reply_confirmation')
      .eq('business_id', businessId)
      .eq('rule_key', 'confirmation_request')
      .maybeSingle(),
  ])

  if (!service || !business) return NextResponse.json({ error: 'service_not_found' }, { status: 404 })

  if (employeeId) {
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('id', employeeId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle()
    if (!employee) return NextResponse.json({ error: 'employee_not_found' }, { status: 422 })
  }

  const timezone = business.timezone ?? 'America/Sao_Paulo'
  const startsAt = parseDateTimeInTz(date, time, timezone)
  if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() < Date.now() + 5 * 60_000) {
    return NextResponse.json({ error: 'time_in_past' }, { status: 422 })
  }

  // Revalidate business hours on the server so a modified browser request
  // cannot create arbitrary out-of-hours appointments.
  const [year, month, day] = date.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const { data: hours } = await supabase
    .from('business_hours')
    .select('is_open, open_time, close_time')
    .eq('business_id', businessId)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle()

  if (hours) {
    const requested = minutesOf(time)
    if (!hours.is_open || requested < minutesOf(hours.open_time) || requested + service.duration_min > minutesOf(hours.close_time)) {
      return NextResponse.json({ error: 'outside_business_hours' }, { status: 422 })
    }
  }

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
      const { error: updateError } = await supabase.from('clients').update(updates).eq('id', clientId).eq('business_id', businessId)
      if (updateError) {
        console.error('[api/book] client update:', updateError.message)
        return NextResponse.json({ error: 'client_update_failed' }, { status: 500 })
      }
    }
  } else {
    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({ business_id: businessId, name, phone, whatsapp_number: phone, email: null })
      .select('id')
      .single()

    if (insertError || !newClient) {
      console.error('[api/book] client insert:', insertError?.message)
      return NextResponse.json({ error: 'client_creation_failed' }, { status: 500 })
    }
    clientId = newClient.id
  }

  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000)
  const awaitsConfirmation = Boolean(confirmationRule?.enabled && confirmationRule.requires_reply_confirmation)

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
      status: awaitsConfirmation ? 'pending' : 'confirmed',
      source: 'online',
    })
    .select('id')
    .single()

  if (appointmentError || !appointment) {
    if (appointmentError?.message?.includes('no_staff_available')) {
      return NextResponse.json({ error: 'no_staff_available', message: 'Não há profissional disponível para receber este agendamento agora.' }, { status: 409 })
    }
    if (appointmentError?.message?.includes('slot_already_booked')) {
      return NextResponse.json({ error: 'slot_taken', message: 'Este horário acabou de ser reservado. Escolha outro horário.' }, { status: 409 })
    }
    console.error('[api/book] appointment insert:', appointmentError?.message)
    return NextResponse.json({ error: 'booking_failed' }, { status: 500 })
  }

  // The booking is committed independently from WhatsApp availability. The
  // message runs as a server-only function, without exposing an internal API.
  try {
    await sendBookingCreatedAutomation(appointment.id)
  } catch (error) {
    console.error('[api/book] booking automation:', error)
  }

  return NextResponse.json({
    appointmentId: appointment.id,
    clientId,
    awaitingConfirmation: awaitsConfirmation,
    hasTelegram: false,
    hasViber: false,
  })
}
