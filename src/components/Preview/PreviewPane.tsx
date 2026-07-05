import { useMemo, useRef, useEffect, useCallback } from 'react'
import { EditorView } from 'codemirror'
import { renderMarkdown } from '../../editor/markdown-renderer'
import { initMermaid, renderMermaidDiagrams } from '../../editor/mermaid-renderer'
import { themeService } from '../../services/theme-service'
import { open as shellOpen } from '@tauri-apps/plugin-shell'
import * as bridge from '../../services/bridge'
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
  const outlineItems = useSidebarStore((s) => s.outlineItems)
  const previewHtml = useEditorStore((s) => s.previewHtml)

  const html = useMemo(() => {
    // 如果有来自 Rust 端的 previewHtml，跳过 JS 侧渲染
    if (previewHtml !== null) return null
    return renderMarkdown(content)
  }, [content, previewHtml])

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
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null
      if (anchor) {
        e.preventDefault()
        const href = anchor.getAttribute('href')
        if (!href) return
        if (/^https?:\/\//i.test(href)) {
          shellOpen(href)
        } else if (href.startsWith('#')) {
          const targetId = decodeURIComponent(href.slice(1))
          const target = el.querySelector(`[id="${CSS.escape(targetId)}"]`)
          target?.scrollIntoView({ behavior: 'smooth' })
        }
        return
      }

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

  // 流式渲染：监听 renderer:chunk/renderer:done 事件（大文件场景）
  useEffect(() => {
    const el = previewRef.current
    if (!el || !useEditorStore.getState().isLargeFile) return

    const onChunk = (e: Event) => {
      const detail = (e as CustomEvent).detail as string
      if (detail) el.innerHTML += detail
    }
    const onDone = () => {
      renderMermaidDiagrams(el)
      // 重置 previewHtml 标记，后续增量更新走 JS 渲染
      useEditorStore.getState().setPreviewHtml(null)
    }

    window.addEventListener('renderer:chunk', onChunk)
    window.addEventListener('renderer:done', onDone)
    return () => {
      window.removeEventListener('renderer:chunk', onChunk)
      window.removeEventListener('renderer:done', onDone)
    }
  }, [])

  // 内容渲染：previewHtml（来自 Rust）或 JS 侧渲染
  useEffect(() => {
    if (!previewRef.current) return

    const el = previewRef.current

    // 首次渲染使用 Rust 端 HTML
    if (previewHtml !== null && isFirstRender.current) {
      el.innerHTML = previewHtml
      isFirstRender.current = false
      // 渲染完成后清除 store 中的 HTML，后续增量更新走 JS
      useEditorStore.getState().setPreviewHtml(null)
      const isLarge = useEditorStore.getState().isLargeFile
      if (!isLarge) {
        renderMermaidDiagrams(el)
      }
      return
    }

    // 后续渲染使用 JS 侧渲染（增量更新）
    if (html === null) return // previewHtml 模式下 html 为 null

    if (isFirstRender.current) {
      el.innerHTML = html
      isFirstRender.current = false
    } else {
      updatePreviewContent(el, html)
    }

    const isLarge = useEditorStore.getState().isLargeFile
    if (!isLarge) {
      renderMermaidDiagrams(el)
    }

    // 异步加载本地图片为 base64 data URI（绕过 Tauri asset 协议限制）
    if (activeFilePath) {
      const dirPath = activeFilePath.replace(/[\\/][^\\/]*$/, '')
      const imgs = el.querySelectorAll('img')
      imgs.forEach((img) => {
        const src = img.getAttribute('src')
        if (!src) return
        if (/^(?:https?:|data:|asset:)/i.test(src)) return
        if (img.dataset.b64Loaded) return

        const normalized = src.replace(/\\/g, '/')
        const dirNorm = dirPath.replace(/\\/g, '/')
        const absPath = normalized.startsWith('/')
          ? normalized
          : dirNorm + '/' + normalized

        img.dataset.b64Loading = '1'
        bridge.readFileBase64(absPath).then((dataUri) => {
          if (!document.body.contains(img)) return
          img.setAttribute('src', dataUri)
          img.dataset.b64Loaded = '1'
          delete img.dataset.b64Loading
        }).catch(() => {
          delete img.dataset.b64Loading
        })
      })
    }
  }, [html, previewHtml, activeFilePath])

  return <div ref={previewRef} data-testid="preview-pane" className="preview-pane markdown-body" />
}

export default PreviewPane
