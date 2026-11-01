import { create } from 'zustand'

export type ToastKind = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  message?: string
  action?: ToastAction
}

export interface ToastAction {
  label: string
  onSelect: () => void
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++
    set({ toasts: [...get().toasts, { ...toast, id }].slice(-5) })
    setTimeout(() => get().dismiss(id), toast.kind === 'error' || toast.action ? 8000 : 4000)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}))

export const toast = {
  info: (title: string, message?: string, action?: ToastAction) => useToasts.getState().push({ kind: 'info', title, message, action }),
  success: (title: string, message?: string, action?: ToastAction) => useToasts.getState().push({ kind: 'success', title, message, action }),
  error: (title: string, message?: string) => useToasts.getState().push({ kind: 'error', title, message })
}
