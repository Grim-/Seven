import { useState, type DragEvent } from 'react'

export interface ReorderProps {
  draggable?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragOver?: (e: DragEvent) => void
  onDrop?: (e: DragEvent) => void
  onDragEnd?: () => void
}

export function moved<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function useReorder(onMove: (from: number, to: number) => void): { props: (index: number, enabled?: boolean) => ReorderProps; dragging: number | null; isOver: (index: number) => boolean } {
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const end = () => {
    setDrag(null)
    setOver(null)
  }
  const props = (index: number, enabled = true): ReorderProps =>
    enabled
      ? {
          draggable: true,
          onDragStart: (e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('seven/reorder', String(index))
            setDrag(index)
          },
          onDragOver: (e) => {
            if (drag === null) return
            e.preventDefault()
            setOver(index)
          },
          onDrop: (e) => {
            e.preventDefault()
            if (drag !== null && drag !== index) onMove(drag, index)
            end()
          },
          onDragEnd: end
        }
      : {}
  return { props, dragging: drag, isOver: (index) => over === index && drag !== null && drag !== index }
}
