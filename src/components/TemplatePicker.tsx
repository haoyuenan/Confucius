import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSidebarStore } from '../stores/sidebar-store'
import { useTabStore } from '../stores/tab-store'
import * as bridge from '../services/bridge'
import {
  PRESET_TEMPLATES,
  expandTemplate,
  getDefaultVariables,
} from '../services/template-service'

export function TemplatePicker({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const rootPath = useSidebarStore((s) => s.rootPath)
  const openFile = useTabStore((s) => s.openFile)

  const templates = useMemo(
    () => Object.keys(PRESET_TEMPLATES).map((name) => ({ name })),
    [],
  )
  const [selected, setSelected] = useState(templates[0]?.name ?? '')
  const [fileName, setFileName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setError('')

    if (!rootPath) {
      setError('请先打开一个文件夹再创建笔记')
      return
    }
    if (!selected) {
      setError('请选择一个模板')
      return
    }
    if (creating) return

    setCreating(true)

    try {
      const content = PRESET_TEMPLATES[selected]
      if (!content) {
        setError('模板内容为空')
        return
      }

      const name = fileName.trim() || selected
      const finalName = name.endsWith('.md') ? name : `${name}.md`
      const targetPath = `${rootPath}/${finalName}`

      const title = finalName.replace(/\.md$/, '').replace(/\.markdown$/, '')
      const variables = getDefaultVariables(title)
      const expanded = expandTemplate(content, variables)

      await bridge.writeFile(targetPath, expanded)
      const result = await bridge.readFile(targetPath)
      openFile(result.filePath, result.content)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`创建失败: ${msg}`)
      console.error('创建文件失败:', err)
    } finally {
      setCreating(false)
    }
  }

  const noFolder = !rootPath

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>{t('template.picker.title')}</span>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          {noFolder && (
            <div className="template-error">
              ⚠ 请先在侧边栏打开一个文件夹，再使用模板创建笔记
            </div>
          )}

          {error && <div className="template-error">{error}</div>}

          <div className="template-list">
            {templates.map((tmpl) => (
              <div
                key={tmpl.name}
                className={`template-item ${selected === tmpl.name ? 'selected' : ''}`}
                onClick={() => setSelected(tmpl.name)}
              >
                <span className="template-icon">
                  {tmpl.name.includes('日记') ? '📅' :
                   tmpl.name.includes('会议') ? '📋' :
                   tmpl.name.includes('周报') ? '📊' :
                   tmpl.name.includes('读书') ? '📚' : '📄'}
                </span>
                <span>{tmpl.name.replace('.md', '')}</span>
              </div>
            ))}
          </div>

          <div className="template-filename">
            <label>{t('template.picker.fileName')}</label>
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder={selected || '未命名.md'}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn" onClick={onClose}>
            {t('template.picker.cancel')}
          </button>
          <button
            className="dialog-btn dialog-btn-primary"
            onClick={handleCreate}
            disabled={!selected || creating}
          >
            {creating ? '...' : t('template.picker.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
