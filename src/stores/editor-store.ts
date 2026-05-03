import { create } from 'zustand'

type EditorMode = 'split' | 'wysiwyg'

interface EditorState {
  content: string
  isLoading: boolean
  contentKey: number
  mode: EditorMode

  setContent: (content: string) => void
  setIsLoading: (loading: boolean) => void
  bumpContentKey: () => void
  setMode: (mode: EditorMode) => void
  toggleMode: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  content: '',
  isLoading: false,
  contentKey: 0,
  mode: 'split',

  setContent: (content) => set({ content }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  bumpContentKey: () => set((s) => ({ contentKey: s.contentKey + 1 })),
  setMode: (mode) => set({ mode }),
  toggleMode: () => set((s) => ({
    mode: s.mode === 'split' ? 'wysiwyg' : 'split',
  })),
}))
