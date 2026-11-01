import type { DragEvent } from 'react'

const ENTRIES = 'seven/entries'

export function dragEntries(e: DragEvent, ids: string[]): void {
  e.dataTransfer.setData(ENTRIES, JSON.stringify(ids))
  e.dataTransfer.effectAllowed = 'move'
}

export function isEntryDrag(e: DragEvent): boolean {
  return e.dataTransfer.types.includes(ENTRIES)
}

export function droppedEntries(e: DragEvent): string[] {
  const raw = e.dataTransfer.getData(ENTRIES)
  return raw ? (JSON.parse(raw) as string[]) : []
}
