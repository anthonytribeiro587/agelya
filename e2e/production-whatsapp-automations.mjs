import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

const BASE = process.env.E2E_BASE_URL || 'https://agelya.vercel.app'
const suffix = (process.env.GITHUB_RUN_ID || Date.now()) + '-' + Date.now()
const email = 'agelya-wa-e2e-' + suffix + '@example.com'
const password = 'WaE2e!' + crypto.randomBytes(18).toString('base64url') + 'aA9'
const business = 'Agelya WhatsApp E2E ' + suffix

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const evidence = []

function log(step, detail) {
  const line = detail ? step + ': ' + detail : step
  evidence.push(line)
  console.log('[wa-e2e] ' + line)
}

async function ready() {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  assert.ok((await page.locator('body').innerText()).trim().length > 0, 'blank page')
  assert.equal(await page.locator('[data-nextjs-dialog], .vite-error-overlay').count(), 0, 'framework error overlay')
}

async function go(path) {
  await page.goto(new URL(path, BASE).toString(), { waitUntil: 'domcontentloaded' })
  await ready()
}

async function api(path, init = {}) {
  return await page.evaluate(async ({ path, init }) => {
    const res = await fetch(path, init)
    let body = null
    try { body = await res.json() } catch { body = await res.text() }
    return { status: res.status, ok: res.ok, body }
  }, { path, init })
}

async function registerAndOnboard() {
  await go('/register')
  await page.locator('input[name="business_name"]').fill(business)
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.waitForURL(u => !u.pathname.endsWith('/register'), { timeout: 30000 })
  await ready()

  const path = new URL(page.url()).pathname
  assert.notEqual(path, '/check-email', 'signup unexpectedly requires email confirmation')
  if (path === '/dashboard') return
  assert.equal(path, '/onboarding')

  await page.locator('input').first().fill(business)
  const massage = page.getByRole('button', { name: /Massagem \/ Spa/i })
  if (await massage.count()) await massage.click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
  await page.getByText('Adicione seu primeiro serviço', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Pular', exact: true }).click()
  await page.getByText('Configure o WhatsApp', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Ir para o painel/ }).click()
  await page.waitForURL(u => u.pathname === '/dashboard', { timeout: 30000 })
  await ready()
  log('cadastro/onboarding', 'ok')
}

async function testAutomationRules() {
  await go('/automations')
  const res = await api('/api/automations')
  assert.equal(res.status, 200)
  const rules = res.body.rules || []
  const byKey = Object.fromEntries(rules.map(r => [r.rule_key, r]))

  for (const key of ['booking_received', 'confirmation_request', 'reminder_1h', 'thank_you', 'reactivation_30d', 'birthday']) {
    assert.ok(byKey[key], 'missing automation rule: ' + key)
  }

  assert.equal(byKey.booking_received.event_type, 'appointment_created')
  assert.equal(byKey.booking_received.enabled, true)
  assert.equal(byKey.confirmation_request.event_type, 'appointment_before')
  assert.equal(byKey.confirmation_request.offset_minutes, 1440)
  assert.equal(byKey.confirmation_request.requires_reply_confirmation, true)
  assert.equal(byKey.reminder_1h.offset_minutes, 60)
  assert.equal(byKey.thank_you.event_type, 'appointment_after')
  log('regras padrão', '6 regras presentes e horários corretos')

  const create = await api('/api/automations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E custom',
      eventType: 'appointment_before',
      offsetMinutes: 120,
      enabled: true,
      messageTemplate: 'Olá {cliente}, teste E2E para {data} às {hora}.'
    })
  })
  assert.equal(create.status, 200)
  assert.ok(create.body.rule?.id)
  const id = create.body.rule.id

  const patch = await api('/api/automations', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, enabled: false, offsetMinutes: 180 })
  })
  assert.equal(patch.status, 200)
  assert.equal(patch.body.rule.enabled, false)
  assert.equal(patch.body.rule.offset_minutes, 180)

  const del = await api('/api/automations?id=' + encodeURIComponent(id), { method: 'DELETE' })
  assert.equal(del.status, 200)
  log('CRUD automação', 'criar/editar/desativar/excluir ok')
}

async function testSummarySettings() {
  const get = await api('/api/automations/summary')
  assert.equal(get.status, 200)

  const invalid = await api('/api/automations/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false, time: '19:00', ownerWhatsapp: '123' })
  })
  assert.equal(invalid.status, 400)

  const valid = await api('/api/automations/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false, time: '19:15', ownerWhatsapp: '+5551999999999' })
  })
  assert.equal(valid.status, 200)

  const check = await api('/api/automations/summary')
  assert.equal(check.status, 200)
  assert.equal(check.body.enabled, false)
  assert.equal(check.body.time, '19:15')
  assert.ok(String(check.body.ownerWhatsapp).includes('5551999999999'))
  log('resumo diário', 'configuração e validações ok; envio mantido desativado')
}

async function testEvolutionConfig() {
  const cfg = await api('/api/evolution/config')
  assert.equal(cfg.status, 200)
  log('Evolution config', JSON.stringify({
    hasApiUrl: Boolean(cfg.body.apiUrl),
    hasInstance: Boolean(cfg.body.instance),
    hasApiKey: Boolean(cfg.body.hasApiKey),
    enabled: Boolean(cfg.body.enabled),
    lastStatus: cfg.body.lastStatus || null
  }))

  if (cfg.body.apiUrl && cfg.body.instance && cfg.body.hasApiKey) {
    const save = await api('/api/evolution/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUrl: cfg.body.apiUrl,
        instance: cfg.body.instance,
        enabled: true
      })
    })
    assert.equal(save.status, 200)

    const test = await api('/api/evolution/test', { method: 'POST' })
    assert.ok([200, 502].includes(test.status))
    if (test.status === 200) {
      log('Evolution conexão', 'endpoint respondeu; state=' + test.body.state)
    } else {
      log('Evolution conexão', 'credenciais existentes mas conexão não abriu: ' + (test.body.error || '502'))
    }

    // Restore test business to disabled so the cron cannot attempt outbound messages for it.
    const restore = await api('/api/evolution/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUrl: cfg.body.apiUrl,
        instance: cfg.body.instance,
        enabled: false
      })
    })
    assert.equal(restore.status, 200)
  } else {
    log('Evolution conexão', 'sem credenciais globais disponíveis para conta isolada; teste de conexão pulado')
  }
}

async function testCronProtection() {
  const res = await api('/api/cron/notify')
  assert.equal(res.status, 401)
  log('cron auth', 'chamada sem segredo bloqueada com 401')
}

try {
  await registerAndOnboard()
  await testAutomationRules()
  await testSummarySettings()
  await testEvolutionConfig()
  await testCronProtection()
  await page.screenshot({ path: 'wa-artifacts/automations.png', fullPage: true }).catch(() => {})
  console.log('WHATSAPP_E2E_RESULT=PASS')
  console.log(evidence.join('\n'))
} catch (e) {
  await page.screenshot({ path: 'wa-artifacts/failure.png', fullPage: true }).catch(() => {})
  console.error('WHATSAPP_E2E_RESULT=FAIL')
  console.error(e && e.stack ? e.stack : e)
  throw e
} finally {
  await context.close().catch(() => {})
  await browser.close().catch(() => {})
}
