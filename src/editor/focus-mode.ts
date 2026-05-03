import { EditorView } from '@codemirror/view'

/** 在 CM6 容器上添加/移除 focus-mode 样式类 */
export function toggleFocusMode(view: EditorView | null, enabled: boolean, opacity = 0.3): void {
  if (!view) return
  view.dom.classList.toggle('focus-mode-active', enabled)
  view.dom.style.setProperty('--focus-dim-opacity', String(opacity))
}
