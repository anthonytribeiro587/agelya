const fs = require('fs')
const path = 'app/book/[slug]/booking-form.tsx'
let s = fs.readFileSync(path, 'utf8')

s = s.replace(
  '  telegramBotUsername: string | null\n  viberBotUri: string | null',
  '  telegramBotUsername?: string | null\n  viberBotUri?: string | null'
)

if (!s.includes('awaitingConfirmation, setAwaitingConfirmation')) {
  s = s.replace(
    '  const [clientHasTelegram, setClientHasTelegram] = useState(false)\n',
    '  const [clientHasTelegram, setClientHasTelegram] = useState(false)\n  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)\n'
  )
}

s = s.replace(
  "      setClientHasTelegram(data.hasTelegram ?? false)\n      setStep('done')",
  "      setClientHasTelegram(data.hasTelegram ?? false)\n      setAwaitingConfirmation(Boolean(data.awaitingConfirmation))\n      setStep('done')"
)
s = s.replace(
  '    setClientHasTelegram(false)\n    setBookingError(null)',
  '    setClientHasTelegram(false)\n    setAwaitingConfirmation(false)\n    setBookingError(null)'
)
s = s.replace(
  "{t('success.heading')}</h2>",
  "{t(awaitingConfirmation ? 'success.pendingHeading' : 'success.heading')}</h2>"
)
s = s.replace(
  "{t('success.body')}</p>",
  "{t(awaitingConfirmation ? 'success.pendingBody' : 'success.body')}</p>"
)

const replacements = [
  ['Adicionar ao Google Agenda', "{t('addToGoogleCalendar')}"],
  ['<StepBadge label="Escolha o serviço" />', "<StepBadge label={t('stepSelectService')} />"],
  ['<StepBadge label="Escolha o profissional" />', "<StepBadge label={t('stepChooseSpecialist')} />"],
  ['<StepBadge label="Data e horário" />', "<StepBadge label={t('stepDatetime')} />"],
  ['⚠ Este horário acabou de ser reservado. Escolha outro horário.', "{t('slotTaken')}"],
  ['Carregando horários disponíveis&hellip;', "{t('loadingTimes')}"],
  ['Este dia está fora do horário de atendimento. Escolha outra data.', "{t('dayClosed')}"],
  ['Não há horários disponíveis neste dia. Escolha outra data.', "{t('noSlots')}"],
]
for (const [from, to] of replacements) s = s.replaceAll(from, to)

fs.writeFileSync(path, s)
console.log('Public booking pending-confirmation UX patched.')
