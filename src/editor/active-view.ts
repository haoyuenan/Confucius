import { EditorView } from 'codemirror'

/** 当前激活的 CM6 EditorView 实例（模块级引用） */
let activeView: EditorView | null = null

export function setActiveView(view: EditorView | null): void {
  activeView = view
  // 暴露到 window 上，供 E2E 测试读取编辑器内容
  ;(window as any).__cm6View = view
}

export function getActiveView(): EditorView | null {
  return activeView
}
