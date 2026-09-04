import fs from 'node:fs'

const sourceUrl = new URL('./production-massotherapy-v2.mjs', import.meta.url)
let source = fs.readFileSync(sourceUrl, 'utf8')

const dateOld = "  const d = new Date(); d.setDate(d.getDate() + 1)\n  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)"
const dateNew = "  const d = new Date(); d.setDate(d.getDate() + 1)"

const consumeOld = "  const card = page.getByText(pack, { exact: true }).locator('..').locator('..')\n  await card.locator('select').selectOption({ index: 1 }); await card.getByRole('button', { name: 'Consumir sessão' }).click()"
const consumeNew = "  const select = page.locator('select').filter({ hasText: 'Selecionar atendimento concluído' }).first()\n  const option = select.locator('option').filter({ hasText: service }).first()\n  const useId = await option.getAttribute('value'); assert.ok(useId, 'completed appointment missing from package selector')\n  await select.selectOption(useId); await page.getByRole('button', { name: 'Consumir sessão', exact: true }).click()"

if (!source.includes(dateOld)) throw new Error('appointmentDate patch target not found')
if (!source.includes(consumeOld)) throw new Error('package consume patch target not found')
source = source.replace(dateOld, dateNew).replace(consumeOld, consumeNew)

const generated = new URL('./.generated-massotherapy-v5.mjs', import.meta.url)
fs.writeFileSync(generated, source)
await import(generated.href + '?run=' + Date.now())
