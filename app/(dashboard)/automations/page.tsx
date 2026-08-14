import { getTranslations } from 'next-intl/server'
import { AutomationManager } from './automation-manager'

export default async function AutomationsPage() {
  const t = await getTranslations('automations')

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('subtitle')}</p>
      </div>
      <AutomationManager />
    </div>
  )
}
