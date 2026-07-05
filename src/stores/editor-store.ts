import { create } from 'zustand'

type EditorMode = 'split' | 'wysiwyg' | 'preview'

interface EditorState {
  content: string
  isLargeFile: boolean
  mode: EditorMode
  focusMode: boolean
  typewriterMode: boolean
  /** 来自 Rust 端渲染的预览 HTML（首次打开大文件时使用） */
  previewHtml: string | null

  setContent: (content: string) => void
  setIsLargeFile: (v: boolean) => void
  setMode: (mode: EditorMode) => void
  toggleMode: () => void
  setFocusMode: (v: boolean) => void
  toggleFocusMode: () => void
  setTypewriterMode: (v: boolean) => void
  toggleTypewriterMode: () => void
  setPreviewHtml: (html: string | null) => void
}

const MODE_KEY = 'confucius-default-mode'

function loadDefaultMode(): EditorMode {
  try {
    const saved = localStorage.getItem(MODE_KEY) as EditorMode | null
    if (saved === 'split' || saved === 'wysiwyg' || saved === 'preview') return saved
  } catch { /* noop */ }
  return 'split'
}

export const useEditorStore = create<EditorState>((set) => ({
  content: '',
  isLargeFile: false,
  mode: loadDefaultMode(),
  focusMode: false,
  typewriterMode: false,
  previewHtml: null,

  setContent: (content) => set({ content }),
  setIsLargeFile: (v) => set({ isLargeFile: v }),
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({
    mode: s.mode === 'split' ? 'wysiwyg' : 'split',
  })),
  setFocusMode: (v) => set({ focusMode: v }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  setTypewriterMode: (v) => set({ typewriterMode: v }),
  toggleTypewriterMode: () => set((s) => ({ typewriterMode: !s.typewriterMode })),
  setPreviewHtml: (html) => set({ previewHtml: html }),
}))
