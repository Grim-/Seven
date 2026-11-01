import { create } from 'zustand'

interface Queued {
  text: string
  replace: boolean
}

const useQueue = create<{ queued: Record<string, Queued | undefined> }>(() => ({ queued: {} }))

export function queueComposer(key: string, text: string, replace = false): void {
  useQueue.setState((s) => ({ queued: { ...s.queued, [key]: replace ? { text, replace } : { text: `${s.queued[key]?.text ?? ''}${text}`, replace: s.queued[key]?.replace ?? false } } }))
}

export function useQueuedComposer(key: string): Queued | undefined {
  return useQueue((s) => s.queued[key])
}

export function takeQueuedComposer(key: string): void {
  useQueue.setState((s) => ({ queued: { ...s.queued, [key]: undefined } }))
}
