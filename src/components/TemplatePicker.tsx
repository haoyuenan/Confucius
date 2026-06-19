import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSidebarStore } from '../stores/sidebar-store'
import { useTabStore } from '../stores/tab-store'
import * as bridge from '../services/bridge'
import {
  listTemplates,
  readTemplateContent,
  ensurePresetTemplates,
  expandTemplate,
  getDefaultVariables,
  type TemplateFile,
} from '../services/template-service'

interface TemplatePickerProps {
  onClose: () => void
}

export function TemplatePicker({ onClose }: TemplatePickerProps) {
  const { t } = useTranslation()
  const rootPath = useSidebarStore((s) => s.rootPath)
  const openFile = useTabStore((s) => s.openFile)

  const [templates, setTemplates] = useState<TemplateFile[]>([])
  const [selected, setSelected] = useState<TemplateFile | null>(null)
  const [fileName, setFileName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (rootPath) {
      ensurePresetTemplates(rootPath).then(() => {
        listTemplates(rootPath).then(setTemplates)
      })
    }
  }, [rootPath])

  const handleCreate = async () => {
    if (!rootPath || !selected || creating) return
    setCreating(true)

    const name = fileName.trim() || selected.name
    const finalName = name.endsWith('.md') ? name : `${name}.md`

    try {
      const content = await readTemplateContent(selected.path)
      const title = finalName.replace(/\.md$/, '').replace(/\.markdown$/, '')
      const variables = getDefaultVariables(title)
      const expanded = expandTemplate(content, variables)

      await bridge.writeFile(`${rootPath}/${finalName}`, expanded)
      const result = await bridge.readFile(`${rootPath}/${finalName}`)
      openFile(result.filePath, result.content)
      onClose()
    } catch (err) {
      console.error('创建文件失败:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <span>{t('template.picker.title')}</span>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          <div className="template-list">
            {templates.map((tmpl) => (
              <div
                key={tmpl.path}
                className={`template-item ${selected?.path === tmpl.path ? 'selected' : ''}`}
                onClick={() => setSelected(tmpl)}
              >
                <span className="template-name">{tmpl.name}</span>
              </div>
            ))}
          </div>

          <div className="template-filename">
            <label>{t('template.picker.fileName')}</label>
            <input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder={selected?.name || '未命名.md'}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
        </div>

        <div className="dialog-footer">
          <button className="dialog-btn" onClick={onClose}>{t('template.picker.cancel')}</button>
          <button
            className="dialog-btn dialog-btn-primary"
            onClick={handleCreate}
            disabled={!selected || creating}
          >
            {t('template.picker.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
