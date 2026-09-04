import { chromium } from 'playwright'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.PREVIEW_BASE_URL
const SHARE = process.env.PREVIEW_SHARE_URL
if (!BASE || !SHARE) throw new Error('Preview URLs are required')

const suffix = (process.env.GITHUB_RUN_ID || Date.now()) + '-' + Date.now()
const email = 'agelya-redesign-' + suffix + '@example.com'
const password = 'Visual!' + crypto.randomBytes(16).toString('base64url') + 'Aa9'
const business = 'Agelya Visual ' + suffix
const service = 'Massagem Relaxante Visual'
const out = path.resolve('visual-artifacts')
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  viewport: { width: 1440, height: 1000 },
})
const page = await context.newPage()

async function ready() {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  const body = (await page.locator('body').innerText()).trim()
  if (!body) throw new Error('Blank page: ' + page.url())
  const overlay = await page.locator('[data-nextjs-dialog], .vite-error-overlay').count()
  if (overlay) throw new Error('Framework overlay detected: ' + page.url())
}

async function shot(name, fullPage = true) {
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage })
  console.log('[visual] screenshot', name, page.url())
}

async function go(p) {
  await page.goto(BASE + p, { waitUntil: 'domcontentloaded' })
  await ready()
}

try {
  // Set Vercel preview access cookie first.
  await page.goto(SHARE, { waitUntil: 'domcontentloaded' })
  await ready()

  await go('/login')
  await shot('01-login-desktop')

  await go('/register')
  await page.locator('input[name="business_name"]').fill(business)
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.waitForURL(u => !u.pathname.endsWith('/register'), { timeout: 30000 })
  await ready()

  if (new URL(page.url()).pathname === '/check-email') {
    throw new Error('SIGNUP_REQUIRES_EMAIL_CONFIRMATION')
  }

  if (new URL(page.url()).pathname === '/onboarding') {
    await page.locator('input').first().fill(business)
    const massage = page.getByRole('button', { name: /Massagem \/ Spa/i })
    if (await massage.count()) await massage.click()
    await page.waitForTimeout(1200)
    await shot('02-onboarding-desktop')

    await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()
    await page.getByText('Adicione seu primeiro serviço', { exact: true }).waitFor({ timeout: 15000 })

    const inputs = page.locator('input')
    await inputs.nth(0).fill(service)
    await inputs.nth(1).fill('180')
    await inputs.nth(2).fill('60')
    await page.getByRole('button', { name: 'Continuar', exact: true }).click()

    await page.getByText('Configure o WhatsApp', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: /Ir para o painel/ }).click()
    await page.waitForURL(u => u.pathname === '/dashboard', { timeout: 30000 })
    await ready()
  }

  await shot('03-dashboard-desktop')

  for (const [p, name] of [
    ['/booking', '04-booking-desktop'],
    ['/crm', '05-clients-desktop'],
    ['/automations', '06-automations-desktop'],
  ]) {
    await go(p)
    await shot(name)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await go('/dashboard')
  await shot('07-dashboard-mobile')

  await go('/booking')
  await shot('08-booking-mobile')

  await go('/crm')
  await shot('09-clients-mobile')

  console.log('VISUAL_PREVIEW_RESULT=PASS')
} catch (error) {
  await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {})
  console.error('VISUAL_PREVIEW_RESULT=FAIL')
  console.error(error?.stack || error)
  throw error
} finally {
  await context.close().catch(() => {})
  await browser.close().catch(() => {})
}
