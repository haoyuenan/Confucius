import { EditorView } from 'codemirror'

/** 当前激活的 CM6 EditorView 实例（模块级引用） */
let activeView: EditorView | null = null

export function setActiveView(view: EditorView | null): void {
  activeView = view
}

export function getActiveView(): EditorView | null {
  return activeView
}
