import { createStore } from './create-store'

export type Toast = {
  id: number
  title: string
  description?: string
  variant: 'info' | 'success' | 'warning' | 'destructive'
}

export const toastStore = createStore<Toast[]>([])
let seq = 0

export function toast(input: Omit<Toast, 'id' | 'variant'> & { variant?: Toast['variant']; duration?: number }) {
  const id = ++seq
  const { duration = 6000, variant = 'info', ...rest } = input
  toastStore.set((prev) => [...prev.slice(-3), { id, variant, ...rest }])
  if (duration > 0) setTimeout(() => dismissToast(id), duration)
  return id
}

export function dismissToast(id: number) {
  toastStore.set((prev) => prev.filter((t) => t.id !== id))
}
