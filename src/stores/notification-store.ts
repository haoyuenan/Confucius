import { create } from 'zustand'

export type ToastType = 'error' | 'success' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

interface NotificationState {
  toasts: ToastItem[]
  /** 弹出通知（自动消失），可脱离 React 组件调用（如编辑器插件内） */
  showToast: (message: string, type?: ToastType) => void
  dismissToast: (id: number) => void
}

let _nextToastId = 1

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  showToast: (message, type = 'info') => {
    const id = _nextToastId++
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => get().dismissToast(id), 3500)
  },
  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))
