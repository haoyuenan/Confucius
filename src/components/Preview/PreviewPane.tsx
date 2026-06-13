import { useMemo, useRef, useEffect, useCallback } from 'react'
import { EditorView } from 'codemirror'
import { renderMarkdownWithBaseDir } from '../../editor/markdown-renderer'
import { initMermaid, renderMermaidDiagrams } from '../../editor/mermaid-renderer'
import { themeService } from '../../services/theme-service'
import { open as shellOpen } from '@tauri-apps/plugin-shell'
import { updatePreviewContent } from '../../utils/dom-diff'
import { useSidebarStore } from '../../stores/sidebar-store'
import { useEditorStore } from '../../stores/editor-store'
import { useTabStore } from '../../stores/tab-store'
import { getActiveView } from '../../editor/active-view'
import 'katex/dist/katex.min.css'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 3.0
const ZOOM_STEP = 0.1

interface PreviewPaneProps {
  content: string
}

/** 模块级预览滚动容器引用（供 sync-scroll 使用） */
let _previewScrollEl: HTMLElement | null = null
export function getPreviewScrollEl(): HTMLElement | null {
  return _previewScrollEl
}

function PreviewPane({ content }: PreviewPaneProps) {
  const previewRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const zoomRef = useRef(1)
  const activeFilePath = useTabStore((s) => s.activeTab()?.filePath ?? null)
  const html = useMemo(() => {
    if (!activeFilePath) return renderMarkdownWithBaseDir(content, null)
    const dirPath = activeFilePath.replace(/[\\/][^\\/]*$/, '')
    return renderMarkdownWithBaseDir(content, dirPath)
  }, [content, activeFilePath])
  const outlineItems = useSidebarStore((s) => s.outlineItems)

  // Ctrl+滚轮缩放预览区
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey || !previewRef.current) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomRef.current + delta))
    zoomRef.current = Math.round(next * 100) / 100
    previewRef.current.style.zoom = String(zoomRef.current)
  }, [])

  useEffect(() => {
    const el = previewRef.current?.parentElement ?? previewRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // 点击预览区标题 → 编辑器跳转到对应位置；点击链接 → 系统浏览器打开
  useEffect(() => {
    const el = previewRef.current
    if (!el) return

    const handleClick = (e: MouseEvent) => {
      // 处理链接点击
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
      if (anchor) {
        e.preventDefault()
        const href = anchor.getAttribute('href')
        if (!href) return
        if (/^https?:\/\//i.test(href)) {
          shellOpen(href)
        } else if (href.startsWith('#')) {
          // 锚点跳转：滚动到预览区内对应 id 元素
          const targetId = decodeURIComponent(href.slice(1))
          const target = el.querySelector(`[id="${CSS.escape(targetId)}"]`)
          target?.scrollIntoView({ behavior: 'smooth' })
        }
        return
      }

      // 处理标题点击 → 通过 slug 匹配 outline 条目
      const heading = (e.target as HTMLElement).closest('h1, h2, h3, h4, h5, h6') as HTMLElement | null
      if (!heading) return

      const view = getActiveView()
      if (!view) return

      const slug = heading.id
      const match = slug ? outlineItems.find((o) => o.slug === slug) : null
      const pos = match
        ? Math.min(match.from, view.state.doc.length)
        : Math.min(outlineItems[0]?.from ?? 0, view.state.doc.length)
      view.dispatch({
        effects: EditorView.scrollIntoView(pos, { y: 'start' }),
        selection: { anchor: pos },
      })
      view.focus()

      // 等待 sync-scroll 可能干扰后重新确认编辑器位置
      requestAnimationFrame(() => {
        if (view) {
          view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start' }) })
        }
      })
    }

    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [outlineItems])

  useEffect(() => {
    window.__exportPreviewHTML__ = () => previewRef.current?.innerHTML || ''
    _previewScrollEl = previewRef.current
    return () => {
      delete window.__exportPreviewHTML__
      _previewScrollEl = null
    }
  }, [])

  useEffect(() => {
    initMermaid(themeService.getCurrentDef().mermaid)
  }, [])

  useEffect(() => {
    if (!previewRef.current) return

    if (isFirstRender.current) {
      previewRef.current.innerHTML = html
      isFirstRender.current = false
    } else {
      updatePreviewContent(previewRef.current, html)
    }

    // 大文件跳过 Mermaid 渲染（性能开销大）
    const isLarge = useEditorStore.getState().isLargeFile
    if (!isLarge) {
      renderMermaidDiagrams(previewRef.current)
    }
  }, [html, activeFilePath])

  return <div ref={previewRef} data-testid="preview-pane" className="preview-pane markdown-body" />
}

export default PreviewPane
