/**
 * 编辑区与预览区双向滚动同步（百分比对齐）
 *
 * 只在 split 模式下启用。
 * 编辑器滚动容器：CM6 view.scrollDOM（.cm-scroller）
 * 预览滚动容器：.preview-pane
 */

import { useEffect, useRef } from 'react'

function calcPercent(el: HTMLElement): number {
  const sh = el.scrollHeight - el.clientHeight
  return sh > 0 ? el.scrollTop / sh : 0
}

function applyPercent(el: HTMLElement, pct: number): void {
  const sh = el.scrollHeight - el.clientHeight
  if (sh > 0) {
    el.scrollTop = pct * sh
  }
}

/**
 * @param editorEl  CM6 scrollDOM
 * @param previewEl 预览区容器（.preview-pane）
 * @param enabled   是否启用（split 模式下为 true）
 */
export function useSyncScroll(
  editorEl: HTMLElement | null,
  previewEl: HTMLElement | null,
  enabled: boolean,
): void {
  const cleanupsRef = useRef<(() => void)[]>([])
  const syncingRef = useRef(false)

  useEffect(() => {
    cleanupsRef.current.forEach((fn) => fn())
    cleanupsRef.current = []

    if (!enabled || !editorEl || !previewEl) return

    let scrollRaf = 0

    const onEditorScroll = (): void => {
      if (syncingRef.current) return
      syncingRef.current = true
      cancelAnimationFrame(scrollRaf)
      scrollRaf = requestAnimationFrame(() => {
        applyPercent(previewEl, calcPercent(editorEl))
        requestAnimationFrame(() => { syncingRef.current = false })
      })
    }

    const onPreviewScroll = (): void => {
      if (syncingRef.current) return
      syncingRef.current = true
      cancelAnimationFrame(scrollRaf)
      scrollRaf = requestAnimationFrame(() => {
        applyPercent(editorEl, calcPercent(previewEl))
        requestAnimationFrame(() => { syncingRef.current = false })
      })
    }

    editorEl.addEventListener('scroll', onEditorScroll, { passive: true })
    previewEl.addEventListener('scroll', onPreviewScroll, { passive: true })

    cleanupsRef.current = [
      () => {
        editorEl.removeEventListener('scroll', onEditorScroll)
        previewEl.removeEventListener('scroll', onPreviewScroll)
        cancelAnimationFrame(scrollRaf)
      },
    ]

    return () => {
      cleanupsRef.current.forEach((fn) => fn())
      cleanupsRef.current = []
    }
  }, [editorEl, previewEl, enabled])
}
