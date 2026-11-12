import { useSyncExternalStore } from 'react'
import { hasCapability } from './transport'

export const PHONE_MAX_WIDTH = 640
export const TABLET_MAX_WIDTH = 1024

export type FormFactor = 'phone' | 'tablet'

const listeners = new Set<() => void>()
let current: FormFactor | null = null
let started = false

function detectForm(): FormFactor | null {
  if (!hasCapability('form') || typeof window === 'undefined') return null
  const width = window.innerWidth
  if (width <= PHONE_MAX_WIDTH) return 'phone'
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  if (width <= TABLET_MAX_WIDTH || coarse) return 'tablet'
  return null
}

function syncForm(): void {
  const next = detectForm()
  if (next === current) return
  current = next
  if (next) document.documentElement.dataset.form = next
  else delete document.documentElement.dataset.form
  for (const notify of listeners) notify()
}

export function startFormWatch(): void {
  if (started || !hasCapability('form')) return
  started = true
  syncForm()
  window.addEventListener('resize', syncForm)
  window.addEventListener('orientationchange', syncForm)
  window.matchMedia?.('(pointer: coarse)')?.addEventListener?.('change', syncForm)
}

export function useHasForm(): boolean {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    () => current !== null
  )
}

export function useCompactLayout(): boolean {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    () => current === 'phone'
  )
}
