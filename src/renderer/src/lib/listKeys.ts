import type { KeyboardEvent } from 'react'

export function listKeys<T>(list: T[], active: T | null, onMove: (item: T) => void, onEnter?: (item: T) => void): (e: KeyboardEvent) => void {
  const step = (by: number) => {
    if (!list.length) return
    const at = active ? list.indexOf(active) : -1
    onMove(list[(at + by + list.length) % list.length])
  }
  const keys: Partial<Record<string, () => void>> = {
    ArrowDown: () => step(1),
    ArrowUp: () => step(-1),
    Enter: () => active && onEnter?.(active)
  }
  return (e) => {
    const run = keys[e.key]
    if (!run) return
    e.preventDefault()
    run()
  }
}
