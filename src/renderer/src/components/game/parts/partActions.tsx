import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import type { MenuItem } from '../../ui'

export interface PartHandlers {
  duplicate: () => void
  move: (by: number) => void
  remove: () => void
}

export function partActions(h: PartHandlers, index: number, size: number): MenuItem[] {
  return [
    { label: 'Duplicate', hint: 'Ctrl D', icon: <Copy className="h-3.5 w-3.5" />, onSelect: h.duplicate },
    { label: 'Move up', hint: 'Alt ↑', icon: <ArrowUp className="h-3.5 w-3.5" />, disabled: index === 0, onSelect: () => h.move(-1) },
    { label: 'Move down', hint: 'Alt ↓', icon: <ArrowDown className="h-3.5 w-3.5" />, disabled: index === size - 1, onSelect: () => h.move(1) },
    { label: 'Remove', hint: 'Del', icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onSelect: h.remove }
  ]
}

export function partKeys(h: PartHandlers): (e: KeyboardEvent) => void {
  return (e) => {
    if (e.target !== e.currentTarget) return
    const act = (fn: () => void) => {
      e.preventDefault()
      fn()
    }
    if (e.key === 'Delete') act(h.remove)
    else if (e.key.toLowerCase() === 'd' && (e.ctrlKey || e.metaKey)) act(h.duplicate)
    else if (e.key === 'ArrowUp' && e.altKey) act(() => h.move(-1))
    else if (e.key === 'ArrowDown' && e.altKey) act(() => h.move(1))
  }
}
