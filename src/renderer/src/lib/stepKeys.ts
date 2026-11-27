import { isTypingTarget } from '../store/keybinds'

export interface StepKey {
  key: string
  to: (at: number, count: number) => number
}

const ENDS: StepKey[] = [
  { key: 'Home', to: () => 0 },
  { key: 'End', to: (_at, count) => count - 1 }
]

export const UP_DOWN: StepKey[] = [{ key: 'ArrowUp', to: (at) => at - 1 }, { key: 'ArrowDown', to: (at) => at + 1 }, ...ENDS]

export const LEFT_RIGHT: StepKey[] = [{ key: 'ArrowLeft', to: (at) => at - 1 }, { key: 'ArrowRight', to: (at) => at + 1 }, ...ENDS]

export function stepByKey(e: { key: string; code: string; target: EventTarget | null; preventDefault: () => void }, at: number, count: number, keys: StepKey[]): number | null {
  if (!count || isTypingTarget(e)) return null
  const step = keys.find((k) => k.key === e.key)
  if (!step) return null
  e.preventDefault()
  return Math.max(0, Math.min(count - 1, step.to(at, count)))
}
