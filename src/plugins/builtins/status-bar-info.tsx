import { useEffect, useState } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { getActiveView } from '../../editor/active-view'
import type { Plugin, PluginContext } from '../../engine/types/plugin'

/* ─── 字数统计组件 ─── */
function WordCount() {
  const content = useEditorStore((s) => s.content)
  const [selected, setSelected] = useState('')
  useEffect(() => {
    const h = () => setSelected(window.getSelection()?.toString() ?? '')
    document.addEventListener('selectionchange', h)
    return () => document.removeEventListener('selectionchange', h)
  }, [])
  const chinese = (content.match(/[\u4e00-\u9fff]/g) || []).length
  const english = content
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .split(/[\s,;.!?()[\]{}"'':：；。！？（）【】""]+/)
    .filter(Boolean).length
  const words = chinese + english
  const lines = content.split('\n').length
  const parts: string[] = []
  if (selected) parts.push(`选中 ${selected.length}`)
  parts.push(`字数 ${words.toLocaleString()}`)
  parts.push(`行 ${lines}`)
  return <>{parts.join('  |  ')}</>
}

/* ─── 光标位置组件 ─── */
function CursorPos() {
  const [pos, setPos] = useState('行 1, 列 1')
  useEffect(() => {
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const view = getActiveView()
        if (!view) { setPos('行 1, 列 1'); return }
        const { main } = view.state.selection
        const line = view.state.doc.lineAt(main.head)
        setPos(`行 ${line.number}, 列 ${main.head - line.from + 1}`)
      })
    }
    document.addEventListener('selectionchange', update)
    return () => {
      document.removeEventListener('selectionchange', update)
      cancelAnimationFrame(raf)
    }
  }, [])
  return <>{pos}</>
}

/* ─── 文件信息组件 ─── */
function FileMeta() {
  const content = useEditorStore((s) => s.content)
  const ext = 'MD'
  const sizeKB = (content.length / 1024).toFixed(1)
  return <>{`${ext}  |  UTF-8  |  ${sizeKB} KB`}</>
}

/* ─── 编辑模式组件 ─── */
function EditMode() {
  const mode = useEditorStore((s) => s.mode)
  const labels: Record<string, string> = {
    split: '双栏编辑',
    wysiwyg: '即时渲染',
    preview: '纯预览',
  }
  return <>{labels[mode] ?? mode}</>
}

/* ─── 插件入口 ─── */
export class StatusBarPlugin implements Plugin {
  manifest = {
    id: 'builtin:status-bar',
    name: '状态栏信息',
    version: '1.1.0',
    apiVersion: '^1.0.0',
    description: '显示字数、光标位置、文件信息、编辑模式等',
  }

  private cleanups: (() => void)[] = []

  onActivate(ctx: PluginContext): void {
    this.cleanups = [
      ctx.addStatusBarItem({ id: 'edit-mode',   priority: -10, component: <EditMode /> }),
      ctx.addStatusBarItem({ id: 'file-meta',   priority: 0,   component: <FileMeta /> }),
      ctx.addStatusBarItem({ id: 'cursor-pos',  priority: 5,   component: <CursorPos /> }),
      ctx.addStatusBarItem({ id: 'word-count',  priority: 10,  component: <WordCount /> }),
    ]
  }

  onDeactivate(): void {
    this.cleanups.forEach((fn) => fn())
  }
}