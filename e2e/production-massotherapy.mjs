'use strict'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'

const BASE = process.env.E2E_BASE_URL || 'https://agelya.vercel.app'
const suffix = (process.env.GITHUB_RUN_ID || Date.now()) + '-' + Date.now()
const email = 'agelya-e2e-' + suffix + '@example.com'
const password = 'E2e!' + crypto.randomBytes(18).toString('base64url') + 'aA9'
const business = 'Agelya E2E ' + suffix
const service = 'Massagem E2E ' + suffix
const client = 'Cliente E2E ' + suffix
const pack = 'Pacote E2E ' + suffix

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
let clientUrl = ''
const evidence = []

function log(step, detail) {
  const line = detail ? step + ': ' + detail : step
  evidence.push(line)
  console.log('[e2e] ' + line)
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
async function field(label, value) {
  await page.getByText(label, { exact: true }).locator('..').locator('input,textarea').first().fill(value)
}
async function snap(name) {
  await page.screenshot({ path: 'e2e-artifacts/' + name + '.png', fullPage: true }).catch(() => {})
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
  log('cadastro', path)
  if (path === '/check-email') throw new Error('SIGNUP_REQUIRES_EMAIL_CONFIRMATION')
  if (path === '/dashboard') return

  assert.equal(path, '/onboarding')
  await page.locator('input').first().fill(business)
  const massage = page.getByRole('button', { name: /Massagem \/ Spa/i })
  if (await massage.count()) await massage.click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Continuar', exact: true }).first().click()

  await page.getByText('Adicione seu primeiro serviço', { exact: true }).waitFor()
  const inputs = page.locator('input')
  await inputs.nth(0).fill(service)
  await inputs.nth(1).fill('120')
  await inputs.nth(2).fill('60')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()

  await page.getByText('Configure o WhatsApp', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Ir para o painel/ }).click()
  await page.waitForURL(u => u.pathname === '/dashboard', { timeout: 30000 })
  await ready()
  log('onboarding', 'serviço criado e painel aberto')
}

async function createClient() {
  await go('/crm/new')
  await page.getByPlaceholder('Ana Silva').fill(client)
  await page.getByPlaceholder('+55 11 99999-9999').fill('+55 51 99999-1234')
  await page.getByPlaceholder('ana@exemplo.com').fill('cliente-' + suffix + '@example.com')
  await page.getByPlaceholder('+5511999999999').fill('+5551999991234')
  await page.getByPlaceholder('vip, regular…').fill('e2e, massoterapia')
  await page.getByPlaceholder('Qualquer observação…').fill('Cliente criado pelo teste E2E.')
  await page.getByRole('button', { name: 'Adicionar cliente' }).click()
  await page.waitForURL(/\/crm\/[0-9a-f-]+$/, { timeout: 30000 })
  await ready()
  clientUrl = page.url()
  await page.getByText('Prontuário de massoterapia', { exact: true }).waitFor()
  log('cliente', 'criado e prontuário aberto')
}

async function wellnessBasics() {
  await page.getByRole('button', { name: 'Pacotes', exact: true }).click()
  await field('Nome do pacote', pack)
  await field('Sessões', '1')
  await field('Valor pago', '100')
  await field('Observações', 'Pacote E2E')
  await page.getByRole('button', { name: 'Criar pacote' }).click()
  await page.getByText('Pacote criado com sucesso.', { exact: true }).waitFor({ timeout: 15000 })
  await page.getByText(/0\/1 sessões utilizadas · 1 restantes/).waitFor()
  log('pacote', '1 sessão disponível')

  await page.getByRole('button', { name: 'Anamnese', exact: true }).click()
  await field('Queixa principal', 'Tensão em trapézio após rotina de trabalho.')
  await field('Objetivo do atendimento', 'Relaxamento e redução de tensão muscular.')
  await field('Local da dor/desconforto', 'Trapézio e cervical')
  await field('Intensidade da dor (0–10)', '6')
  await field('Condições de saúde', 'Nenhuma informada no teste.')
  await field('Medicamentos em uso', 'Nenhum')
  await field('Alergias', 'Nenhuma')
  await field('Contraindicações/cuidados', 'Nenhuma')
  await field('Cirurgias/procedimentos prévios', 'Nenhuma')
  await field('Observações gerais', 'Anamnese E2E.')
  await page.getByRole('button', { name: 'Salvar nova versão' }).click()
  await page.getByText('Anamnese salva e versionada no histórico.', { exact: true }).waitFor({ timeout: 15000 })
  await page.getByText(/Última versão: 1/).waitFor()
  log('anamnese', 'versão 1 salva')

  await page.getByRole('button', { name: 'Consentimentos', exact: true }).click()
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Registrar aceite', exact: true }).first().click()
    await page.getByText('Consentimento registrado.', { exact: true }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(300)
  }
  assert.equal(await page.getByRole('button', { name: 'Revogar', exact: true }).count(), 2)
  log('consentimentos', '2 aceites ativos')
}

function appointmentDate() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

async function appointment() {
  await go('/booking')
  await page.getByRole('button', { name: 'Novo agendamento', exact: true }).click()
  const modal = page.locator('h2').filter({ hasText: 'Novo agendamento' }).locator('..')
  await modal.getByText('Serviço *', { exact: true }).locator('..').locator('select').selectOption({ label: service })
  const date = modal.getByText('Data e hora *', { exact: true }).locator('..')
  await date.locator('input[type="text"]').fill(appointmentDate())
  const selects = date.locator('select')
  assert.ok(await selects.count() >= 2)
  await selects.nth(0).selectOption('16')
  await selects.nth(1).selectOption('00')

  const clientSelect = modal.getByText('Cliente', { exact: true }).locator('..').locator('select')
  const clientId = await clientSelect.locator('option').filter({ hasText: client }).first().getAttribute('value')
  assert.ok(clientId)
  await clientSelect.selectOption(clientId)
  await modal.getByRole('button', { name: 'Salvar', exact: true }).click()

  await page.getByText(client, { exact: true }).first().waitFor({ timeout: 15000 })
  await page.getByText(client, { exact: true }).first().click()
  const detail = page.locator('div.fixed.inset-0').filter({ hasText: client }).last()
  await detail.getByRole('button', { name: 'concluído', exact: true }).click()
  await page.waitForTimeout(500)
  const cls = await detail.getByRole('button', { name: 'concluído', exact: true }).getAttribute('class')
  assert.ok(cls && cls.includes('bg-amber-100'))
  await detail.getByRole('button', { name: 'Fechar', exact: true }).click()
  log('agendamento', 'criado e concluído')
}

async function evolutionAndConsume() {
  await page.goto(clientUrl, { waitUntil: 'domcontentloaded' })
  await ready()
  await page.getByRole('button', { name: 'Evoluções', exact: true }).click()
  const appt = page.getByText('Atendimento', { exact: true }).locator('..').locator('select')
  const id = await appt.locator('option').filter({ hasText: service }).first().getAttribute('value')
  assert.ok(id)
  await appt.selectOption(id)
  await field('Escala de dor (0–10)', '4')
  await field('Regiões trabalhadas', 'trapézio, cervical')
  await field('Técnicas utilizadas', 'deslizamento, pressão')
  await field('Evolução do atendimento', 'Cliente apresentou redução de tensão e melhora do desconforto.')
  await field('Resposta do cliente', 'Relatou alívio ao final da sessão.')
  await field('Recomendações', 'Hidratação e alongamento leve.')
  await page.getByRole('button', { name: 'Salvar evolução' }).click()
  await page.getByText('Evolução registrada.', { exact: true }).waitFor({ timeout: 15000 })
  log('evolução', 'registrada')

  await page.getByRole('button', { name: 'Pacotes', exact: true }).click()
  const card = page.getByText(pack, { exact: true }).locator('..').locator('..')
  await card.locator('select').selectOption({ index: 1 })
  await card.getByRole('button', { name: 'Consumir sessão' }).click()
  await page.getByText('Sessão consumida do pacote.', { exact: true }).waitFor({ timeout: 15000 })
  await page.getByText(/1\/1 sessões utilizadas · 0 restantes/).waitFor()
  log('pacote', 'sessão consumida; saldo 0')
}

async function cleanup() {
  if (!clientUrl) return
  await page.goto(clientUrl, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await ready().catch(() => {})
  const trash = page.locator('button:has(svg.lucide-trash-2)').first()
  if (await trash.count()) {
    await trash.click()
    const confirm = page.getByRole('button', { name: 'Excluir cliente', exact: true })
    if (await confirm.count()) {
      await confirm.click()
      await page.waitForURL(u => u.pathname === '/crm', { timeout: 15000 }).catch(() => {})
      log('cleanup', 'cliente E2E excluído')
    }
  }
}

try {
  await registerAndOnboard()
  await createClient()
  await wellnessBasics()
  await appointment()
  await evolutionAndConsume()
  await snap('success')
  console.log('E2E_RESULT=PASS')
  console.log(evidence.join('\n'))
} catch (e) {
  await snap('failure')
  console.error('E2E_RESULT=FAIL')
  console.error(e && e.stack ? e.stack : e)
  throw e
} finally {
  await cleanup().catch(e => console.error('[e2e] cleanup error', e))
  await context.close().catch(() => {})
  await browser.close().catch(() => {})
}
