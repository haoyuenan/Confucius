import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  loadConfig,
  saveConfig,
  checkHealth,
  listModels,
  type AIConfig,
} from '../services/ai-service'

interface AIConfigDialogProps {
  onClose: () => void
}

export function AIConfigDialog({ onClose }: AIConfigDialogProps) {
  const { t } = useTranslation()
  const [config, setConfig] = useState<AIConfig>(loadConfig)
  const [models, setModels] = useState<string[]>([])
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    listModels(config.endpoint).then(setModels).catch(() => setModels([]))
  }, [config.endpoint])

  const handleTest = async () => {
    setTesting(true)
    setStatus('idle')
    const ok = await checkHealth(config.endpoint)
    setStatus(ok ? 'ok' : 'fail')
    if (ok) {
      listModels(config.endpoint).then(setModels).catch(() => {})
    }
    setTesting(false)
  }

  const handleSave = () => {
    saveConfig(config)
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>{t('ai.config.title')}</span>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          <div className="settings-group">
            <label>{t('ai.config.endpoint')}</label>
            <input
              value={config.endpoint}
              onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
              placeholder="http://localhost:11434"
            />
          </div>

          <div className="settings-group">
            <label>{t('ai.config.model')}</label>
            <select
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
            >
              {models.length > 0 ? (
                models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))
              ) : (
                <option value={config.model}>{config.model}</option>
              )}
            </select>
          </div>

          <div className="settings-group">
            <button className="dialog-btn" onClick={handleTest} disabled={testing}>
              {testing ? '...' : t('ai.config.test')}
            </button>
            {status === 'ok' && <span style={{ color: 'green', marginLeft: 8 }}>{t('ai.config.connected')}</span>}
            {status === 'fail' && <span style={{ color: 'red', marginLeft: 8 }}>{t('ai.config.connectFailed')}</span>}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn" onClick={onClose}>{t('template.picker.cancel')}</button>
          <button className="dialog-btn dialog-btn-primary" onClick={handleSave}>
            {t('ai.config.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
