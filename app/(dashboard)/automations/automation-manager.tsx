'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  MessageCircle,
  Plus,
  Save,
  Trash2,
  Webhook,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Rule {
  id: string
  rule_key: string
  name: string
  event_type: 'appointment_created' | 'appointment_before' | 'appointment_after' | 'birthday' | 'reactivation'
  offset_minutes: number
  enabled: boolean
  message_template: string
  requires_reply_confirmation: boolean
  is_system: boolean
}

interface EvolutionStatus {
  enabled: boolean
  connected: boolean
  webhookConfigured: boolean
}

interface ApiData {
  rules: Rule[]
  evolution: EvolutionStatus
}

function splitOffset(totalMinutes: number) {
  if (totalMinutes > 0 && totalMinutes % 1440 === 0) return { value: totalMinutes / 1440, unit: 'days' }
  if (totalMinutes > 0 && totalMinutes % 60 === 0) return { value: totalMinutes / 60, unit: 'hours' }
  return { value: totalMinutes, unit: 'minutes' }
}

function toMinutes(value: number, unit: string) {
  if (unit === 'days') return value * 1440
  if (unit === 'hours') return value * 60
  return value
}

export function AutomationManager() {
  const t = useTranslations('automations')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [settingWebhook, setSettingWebhook] = useState(false)
  const [newRule, setNewRule] = useState({
    name: '',
    eventType: 'appointment_before' as 'appointment_before' | 'appointment_after',
    value: 2,
    unit: 'hours',
    messageTemplate: 'Olá, {cliente}! Lembrando do seu atendimento de {servico} em {data} às {hora}. — {empresa}',
  })

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/automations', { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || t('loadError'))
      setData(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const placeholders = useMemo(
    () => ['{cliente}', '{servico}', '{data}', '{hora}', '{profissional}', '{endereco}', '{empresa}'],
    []
  )

  function updateLocal(id: string, patch: Partial<Rule>) {
    setData((current) => current ? {
      ...current,
      rules: current.rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule),
    } : current)
  }

  async function saveRule(rule: Rule, patch?: Partial<Rule>) {
    const next = { ...rule, ...patch }
    setSavingId(rule.id)
    setSavedId(null)
    setError('')
    try {
      const res = await fetch('/api/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          enabled: next.enabled,
          name: next.name,
          offsetMinutes: next.offset_minutes,
          messageTemplate: next.message_template,
          requiresReplyConfirmation: next.requires_reply_confirmation,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || t('saveError'))
      updateLocal(rule.id, body.rule)
      setSavedId(rule.id)
      window.setTimeout(() => setSavedId((id) => id === rule.id ? null : id), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'))
    } finally {
      setSavingId(null)
    }
  }

  async function toggleRule(rule: Rule) {
    const enabled = !rule.enabled
    updateLocal(rule.id, { enabled })
    await saveRule(rule, { enabled })
  }

  async function deleteRule(rule: Rule) {
    if (rule.is_system || !window.confirm(t('deleteConfirm'))) return
    setSavingId(rule.id)
    try {
      const res = await fetch(`/api/automations?id=${encodeURIComponent(rule.id)}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || t('deleteError'))
      setData((current) => current ? { ...current, rules: current.rules.filter((r) => r.id !== rule.id) } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteError'))
    } finally {
      setSavingId(null)
    }
  }

  async function createRule() {
    const offsetMinutes = toMinutes(Math.max(1, Number(newRule.value) || 1), newRule.unit)
    if (!newRule.name.trim() || !newRule.messageTemplate.trim()) return
    setSavingId('new')
    setError('')
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRule.name,
          eventType: newRule.eventType,
          offsetMinutes,
          messageTemplate: newRule.messageTemplate,
          enabled: true,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || t('createError'))
      setData((current) => current ? { ...current, rules: [...current.rules, body.rule] } : current)
      setShowNew(false)
      setNewRule({
        name: '',
        eventType: 'appointment_before',
        value: 2,
        unit: 'hours',
        messageTemplate: 'Olá, {cliente}! Lembrando do seu atendimento de {servico} em {data} às {hora}. — {empresa}',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createError'))
    } finally {
      setSavingId(null)
    }
  }

  async function setupWebhook() {
    setSettingWebhook(true)
    setError('')
    try {
      const res = await fetch('/api/automations/webhook/setup', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || t('webhookError'))
      setData((current) => current ? {
        ...current,
        evolution: { ...current.evolution, webhookConfigured: true },
      } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('webhookError'))
    } finally {
      setSettingWebhook(false)
    }
  }

  function timingLabel(rule: Rule) {
    if (rule.event_type === 'appointment_created') return t('timing.created')
    if (rule.event_type === 'birthday') return t('timing.birthday')
    if (rule.event_type === 'reactivation') {
      const parts = splitOffset(rule.offset_minutes)
      return t('timing.reactivation', { value: parts.value, unit: t(`units.${parts.unit}`) })
    }
    const parts = splitOffset(rule.offset_minutes)
    return rule.event_type === 'appointment_before'
      ? t('timing.before', { value: parts.value, unit: t(`units.${parts.unit}`) })
      : t('timing.after', { value: parts.value, unit: t(`units.${parts.unit}`) })
  }

  if (loading) {
    return (
      <div className="min-h-48 flex items-center justify-center text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> {t('loading')}
      </div>
    )
  }

  if (!data) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error || t('loadError')}</div>
  }

  return (
    <div className="space-y-5">
      <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
        data.evolution.connected && data.evolution.enabled
          ? 'border-green-200 bg-green-50'
          : 'border-amber-200 bg-amber-50'
      }`}>
        <div className="flex items-start gap-3">
          <MessageCircle className={`w-5 h-5 mt-0.5 ${data.evolution.connected ? 'text-green-600' : 'text-amber-600'}`} />
          <div>
            <div className="font-medium text-gray-900">{t('evolutionTitle')}</div>
            <div className="text-sm text-gray-600 mt-0.5">
              {data.evolution.connected && data.evolution.enabled ? t('evolutionConnected') : t('evolutionDisconnected')}
            </div>
          </div>
        </div>
        <a href="/settings" className="text-sm font-medium text-green-700 hover:underline">{t('openNotifications')}</a>
      </div>

      {!data.evolution.webhookConfigured && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <Webhook className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <div className="font-medium text-gray-900">{t('webhookTitle')}</div>
              <p className="text-sm text-gray-600 mt-0.5">{t('webhookDescription')}</p>
            </div>
          </div>
          <Button onClick={setupWebhook} disabled={settingWebhook || !data.evolution.enabled}>
            {settingWebhook ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Webhook className="w-4 h-4 mr-2" />}
            {t('webhookButton')}
          </Button>
        </div>
      )}

      {data.evolution.webhookConfigured && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {t('webhookReady')}
        </div>
      )}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('rulesTitle')}</h2>
          <p className="text-sm text-gray-500">{t('rulesSubtitle')}</p>
        </div>
        <Button onClick={() => setShowNew((v) => !v)}>
          <Plus className="w-4 h-4 mr-2" /> {t('newAutomation')}
        </Button>
      </div>

      {showNew && (
        <div className="rounded-xl border border-green-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Bot className="w-5 h-5 text-green-600" /> {t('createTitle')}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">{t('nameLabel')}</label>
              <input
                value={newRule.name}
                onChange={(e) => setNewRule((r) => ({ ...r, name: e.target.value }))}
                placeholder={t('namePlaceholder')}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">{t('whenLabel')}</label>
              <select
                value={newRule.eventType}
                onChange={(e) => setNewRule((r) => ({ ...r, eventType: e.target.value as typeof r.eventType }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white"
              >
                <option value="appointment_before">{t('beforeAppointment')}</option>
                <option value="appointment_after">{t('afterAppointment')}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 max-w-sm">
            <input
              type="number"
              min={1}
              max={365}
              value={newRule.value}
              onChange={(e) => setNewRule((r) => ({ ...r, value: Number(e.target.value) }))}
              className="w-28 rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
            />
            <select
              value={newRule.unit}
              onChange={(e) => setNewRule((r) => ({ ...r, unit: e.target.value }))}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white"
            >
              <option value="minutes">{t('units.minutes')}</option>
              <option value="hours">{t('units.hours')}</option>
              <option value="days">{t('units.days')}</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">{t('messageLabel')}</label>
            <textarea
              value={newRule.messageTemplate}
              onChange={(e) => setNewRule((r) => ({ ...r, messageTemplate: e.target.value }))}
              rows={5}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => setNewRule((r) => ({ ...r, messageTemplate: `${r.messageTemplate}${r.messageTemplate.endsWith(' ') ? '' : ' '}${token}` }))}
                className="rounded-md bg-gray-100 px-2 py-1 text-xs font-mono text-gray-600 hover:bg-gray-200"
              >
                {token}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowNew(false)}>{t('cancel')}</Button>
            <Button onClick={createRule} disabled={savingId === 'new' || !newRule.name.trim() || !newRule.messageTemplate.trim()}>
              {savingId === 'new' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {t('create')}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {data.rules.map((rule) => {
          const expanded = expandedId === rule.id
          const saving = savingId === rule.id
          const saved = savedId === rule.id
          return (
            <div key={rule.id} className={`rounded-xl border bg-white overflow-hidden transition-colors ${rule.enabled ? 'border-gray-200' : 'border-gray-100 opacity-75'}`}>
              <div className="p-4 sm:p-5 flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  onClick={() => void toggleRule(rule)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${rule.enabled ? 'bg-green-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${rule.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">{rule.name}</h3>
                    {rule.is_system && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">{t('defaultBadge')}</span>}
                    {rule.requires_reply_confirmation && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">{t('replyBadge')}</span>}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                    <Clock3 className="w-3.5 h-3.5" /> {timingLabel(rule)}
                  </div>
                </div>

                {saving && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                {saved && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                <button
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                  onClick={() => setExpandedId(expanded ? null : rule.id)}
                  aria-label={t('edit')}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {expanded && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-5 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600">{t('nameLabel')}</label>
                    <input
                      value={rule.name}
                      onChange={(e) => updateLocal(rule.id, { name: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
                    />
                  </div>

                  {rule.event_type !== 'appointment_created' && rule.event_type !== 'birthday' && (
                    <div>
                      <label className="text-xs font-medium text-gray-600">{t('offsetLabel')}</label>
                      <div className="mt-1 flex max-w-sm gap-2">
                        <input
                          type="number"
                          min={0}
                          value={splitOffset(rule.offset_minutes).value}
                          onChange={(e) => {
                            const parts = splitOffset(rule.offset_minutes)
                            updateLocal(rule.id, { offset_minutes: toMinutes(Math.max(0, Number(e.target.value)), parts.unit) })
                          }}
                          className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
                        />
                        <select
                          value={splitOffset(rule.offset_minutes).unit}
                          onChange={(e) => {
                            const parts = splitOffset(rule.offset_minutes)
                            updateLocal(rule.id, { offset_minutes: toMinutes(parts.value, e.target.value) })
                          }}
                          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
                        >
                          <option value="minutes">{t('units.minutes')}</option>
                          <option value="hours">{t('units.hours')}</option>
                          <option value="days">{t('units.days')}</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {rule.event_type === 'appointment_created' && (
                    <label className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                      <input
                        type="checkbox"
                        checked={rule.requires_reply_confirmation}
                        onChange={(e) => updateLocal(rule.id, { requires_reply_confirmation: e.target.checked })}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900">{t('replyConfirmationTitle')}</span>
                        <span className="block text-xs text-gray-600 mt-0.5">{t('replyConfirmationDescription')}</span>
                      </span>
                    </label>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-600">{t('messageLabel')}</label>
                    <textarea
                      value={rule.message_template}
                      onChange={(e) => updateLocal(rule.id, { message_template: e.target.value })}
                      rows={6}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="mt-2 text-xs text-gray-500">{t('variablesHelp')}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {placeholders.map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => updateLocal(rule.id, { message_template: `${rule.message_template}${rule.message_template.endsWith(' ') ? '' : ' '}${token}` })}
                          className="rounded-md bg-white border border-gray-200 px-2 py-1 text-xs font-mono text-gray-600 hover:bg-gray-100"
                        >
                          {token}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between gap-2">
                    <div>
                      {!rule.is_system && (
                        <Button variant="outline" onClick={() => void deleteRule(rule)} className="text-red-600 border-red-200 hover:bg-red-50">
                          <Trash2 className="w-4 h-4 mr-2" /> {t('delete')}
                        </Button>
                      )}
                    </div>
                    <Button onClick={() => void saveRule(rule)} disabled={saving || !rule.name.trim() || !rule.message_template.trim()}>
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      {t('save')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-800">{t('howItWorksTitle')}</h3>
        <p className="mt-1 text-sm leading-6 text-gray-600">{t('howItWorksDescription')}</p>
      </div>
    </div>
  )
}
