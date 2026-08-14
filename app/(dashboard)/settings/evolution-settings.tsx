'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, MessageCircle, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Config {
  apiUrl: string
  instance: string
  enabled: boolean
  hasApiKey: boolean
  lastStatus: string | null
  lastCheckedAt: string | null
}

export function EvolutionSettings() {
  const [config, setConfig] = useState<Config>({
    apiUrl: '', instance: '', enabled: false, hasApiKey: false,
    lastStatus: null, lastCheckedAt: null,
  })
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/evolution/config', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar a configuração.')
      setConfig(data)
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao carregar.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/evolution/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          instance: config.instance,
          apiKey,
          enabled: config.enabled,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar.')
      setApiKey('')
      setConfig((c) => ({ ...c, hasApiKey: true }))
      setMessage({ type: 'ok', text: 'Configuração da Evolution salva.' })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao salvar.' })
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    setMessage(null)
    try {
      // Save current form first so the test always uses what is on screen.
      const saveRes = await fetch('/api/evolution/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          instance: config.instance,
          apiKey,
          enabled: config.enabled,
        }),
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Não foi possível salvar a configuração.')
      setApiKey('')

      const res = await fetch('/api/evolution/test', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível conectar.')

      const connected = data.state === 'open'
      setConfig((c) => ({
        ...c,
        hasApiKey: true,
        lastStatus: data.state,
        lastCheckedAt: new Date().toISOString(),
      }))
      setMessage({
        type: connected ? 'ok' : 'error',
        text: connected
          ? 'Evolution API conectada e WhatsApp online.'
          : `Evolution respondeu, mas a instância está: ${data.state}.`,
      })
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro ao testar.' })
    } finally {
      setTesting(false)
    }
  }

  const isConnected = config.lastStatus === 'open'

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando WhatsApp…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-gray-900">WhatsApp — Evolution API</h2>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                isConnected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isConnected ? 'Conectado' : config.lastStatus ? `Status: ${config.lastStatus}` : 'Não testado'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Use sua instância da Evolution para confirmações e lembretes de agendamento pelo WhatsApp.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-900">Ativar notificações pelo WhatsApp</p>
              <p className="text-xs text-gray-500 mt-0.5">Quando desligado, a Agelya não envia mensagens automáticas.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.enabled}
              onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${config.enabled ? 'bg-green-600' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>

          <div>
            <label className="text-xs font-medium text-gray-600">URL da Evolution API</label>
            <input
              type="url"
              value={config.apiUrl}
              onChange={(e) => setConfig((c) => ({ ...c, apiUrl: e.target.value }))}
              placeholder="https://evolution.seudominio.com"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Nome da instância</label>
            <input
              type="text"
              value={config.instance}
              onChange={(e) => setConfig((c) => ({ ...c, instance: e.target.value }))}
              placeholder="agelya-cliente"
              autoComplete="off"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config.hasApiKey ? 'Chave salva — deixe vazio para manter' : 'Cole a API Key da Evolution'}
              autoComplete="new-password"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">A chave fica armazenada somente no servidor e não é devolvida ao navegador.</p>
          </div>

          {config.lastCheckedAt && (
            <p className="text-xs text-gray-400">
              Último teste: {new Date(config.lastCheckedAt).toLocaleString('pt-BR')}
            </p>
          )}

          {message && (
            <div className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
              message.type === 'ok'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {message.type === 'ok' && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
              {message.text}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={save} disabled={saving || testing || !config.apiUrl || !config.instance}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar configuração
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={saving || testing || !config.apiUrl || !config.instance || (!config.hasApiKey && !apiKey)}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
              Testar conexão
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800">Mensagens que vamos usar</h3>
        <p className="text-sm text-gray-500 mt-1">Confirmação de agendamento, lembretes, pós-atendimento e outras automações da agenda serão enviadas por esta instância.</p>
      </div>
    </div>
  )
}
