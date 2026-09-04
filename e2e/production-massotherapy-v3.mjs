import fs from 'node:fs'

const sourceUrl = new URL('./production-massotherapy-v2.mjs', import.meta.url)
let source = fs.readFileSync(sourceUrl, 'utf8')
const oldBlock = "  const d = new Date(); d.setDate(d.getDate() + 1)\n  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)"
const newBlock = "  const d = new Date(); d.setDate(d.getDate() + 1)"
if (!source.includes(oldBlock)) throw new Error('appointmentDate patch target not found')
source = source.replace(oldBlock, newBlock)
const generated = new URL('./.generated-massotherapy-v3.mjs', import.meta.url)
fs.writeFileSync(generated, source)
await import(generated.href + '?run=' + Date.now())
