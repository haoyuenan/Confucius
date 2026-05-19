import { useEffect, useState } from 'react'
import { usePluginStore } from '../../stores/plugin-store'
import { useTabStore } from '../../stores/tab-store'
import { useTranslation } from '../../i18n/i18n-store'
import { getActiveView } from '../../editor/active-view'

function resolveLabel(label: string | (() => string) | undefined): string {
  if (typeof label === 'function') return label()
  return label ?? ''
}

function StatusBar() {
  const { t } = useTranslation()
  const pluginItems = usePluginStore((s) => s.statusBarItems)
  const activeTab = useTabStore((s) => s.activeTab())
  const [, setTick] = useState(0)

  // 每 500ms 刷新光标位置和插件动态标签
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [])

  const content = activeTab?.content ?? ''
  const filePath = activeTab?.filePath
  const isModified = activeTab?.isModified ?? false

  // 字数统计（Unicode 字符感知）
  const wordCount = content ? (content.match(/\p{L}+/gu) || []).length : 0
  const charCount = content.length

  // 光标位置
  const view = getActiveView()
  const cursorPos = view ? view.state.selection.main.head : 0
  const cursorLine = view ? view.state.doc.lineAt(cursorPos).number : 0
  const cursorCol = cursorPos - (view ? view.state.doc.lineAt(cursorPos).from : 0) + 1

  // 选中字符数
  const sel = view?.state.selection.main
  const selLen = sel && !sel.empty ? view!.state.sliceDoc(sel.from, sel.to).length : 0

  const sorted = pluginItems.slice().sort((a, b) => b.priority - a.priority)

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item status-save">
          {isModified ? t('editor.status.unsaved') : (filePath ? t('editor.status.saved') : '')}
        </span>
      </div>
      <div className="status-right">
        <span className="status-item">
          {t('editor.status.words', { count: wordCount })}
          {charCount > 0 && t('editor.status.chars', { count: charCount })}
          {selLen > 0 && t('editor.status.selected', { count: selLen })}
        </span>
        {charCount > 0 && (
          <span className="status-item">{cursorLine}:{cursorCol}</span>
        )}
        {sorted.map((item) => (
          <span key={item.id} className="status-item">
            {item.component ?? resolveLabel(item.label)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default StatusBar
