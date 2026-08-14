export interface AutomationMessageContext {
  clientName: string
  serviceName?: string | null
  businessName: string
  employeeName?: string | null
  address?: string | null
  startsAt?: string | null
  timezone?: string | null
}

function formatDate(iso: string | null | undefined, timezone: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

function formatTime(iso: string | null | undefined, timezone: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export function renderAutomationMessage(template: string, context: AutomationMessageContext) {
  const timezone = context.timezone || 'America/Sao_Paulo'
  const values: Record<string, string> = {
    cliente: context.clientName || 'Cliente',
    servico: context.serviceName || 'Atendimento',
    empresa: context.businessName || 'Agelya',
    profissional: context.employeeName || '',
    endereco: context.address || '',
    data: formatDate(context.startsAt, timezone),
    hora: formatTime(context.startsAt, timezone),
  }

  return template
    .replace(/\{(cliente|servico|empresa|profissional|endereco|data|hora)\}/g, (_, key) => values[key] ?? '')
    .replace(/^📍\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
