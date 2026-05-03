import { create } from 'zustand'

interface EditorState {
  /** 当前编辑器实时内容 */
  content: string
  /** 加载状态 */
  isLoading: boolean
  /** 递增版本号，每次打开文件时自增，用于强制重建编辑器 */
  contentKey: number

  setContent: (content: string) => void
  setIsLoading: (loading: boolean) => void
  /** 触发重新加载编辑器内容 */
  bumpContentKey: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  content: '',
  isLoading: false,
  contentKey: 0,

  setContent: (content) => set({ content }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  bumpContentKey: () => set((s) => ({ contentKey: s.contentKey + 1 })),
}))
