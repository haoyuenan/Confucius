import { create } from 'zustand'

type EditorMode = 'split' | 'wysiwyg' | 'preview'

interface EditorState {
  content: string
  isLargeFile: boolean
  mode: EditorMode
  focusMode: boolean
  typewriterMode: boolean

  setContent: (content: string) => void
  setIsLargeFile: (v: boolean) => void
  setMode: (mode: EditorMode) => void
  toggleMode: () => void
  setFocusMode: (v: boolean) => void
  toggleFocusMode: () => void
  setTypewriterMode: (v: boolean) => void
  toggleTypewriterMode: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  content: '',
  isLargeFile: false,
  mode: 'split',
  focusMode: false,
  typewriterMode: false,

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
}))
