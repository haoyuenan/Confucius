import { create } from 'zustand'

type EditorMode = 'split' | 'wysiwyg' | 'preview'

interface EditorState {
  content: string
  isLoading: boolean
  isLargeFile: boolean
  contentKey: number
  mode: EditorMode
  focusMode: boolean
  typewriterMode: boolean

  setContent: (content: string) => void
  setIsLoading: (loading: boolean) => void
  setIsLargeFile: (v: boolean) => void
  bumpContentKey: () => void
  setMode: (mode: EditorMode) => void
  toggleMode: () => void
  setFocusMode: (v: boolean) => void
  toggleFocusMode: () => void
  setTypewriterMode: (v: boolean) => void
  toggleTypewriterMode: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  content: '',
  isLoading: false,
  isLargeFile: false,
  contentKey: 0,
  mode: 'split',
  focusMode: false,
  typewriterMode: false,

  setContent: (content) => set({ content }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsLargeFile: (v) => set({ isLargeFile: v }),
  bumpContentKey: () => set((s) => ({ contentKey: s.contentKey + 1 })),
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({
    mode: s.mode === 'split' ? 'wysiwyg' : s.mode === 'wysiwyg' ? 'preview' : 'split',
  })),
  setFocusMode: (v) => set({ focusMode: v }),
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  setTypewriterMode: (v) => set({ typewriterMode: v }),
  toggleTypewriterMode: () => set((s) => ({ typewriterMode: !s.typewriterMode })),
}))
