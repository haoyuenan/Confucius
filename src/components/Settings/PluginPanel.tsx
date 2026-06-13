import { useTranslation } from '../../i18n/i18n-store'

export default function PluginPanel() {
  const { t } = useTranslation()
  return (
    <div className="plugin-panel" style={{ padding: '2em', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <p>{t('settings.plugin.removed')}</p>
    </div>
  )
}
