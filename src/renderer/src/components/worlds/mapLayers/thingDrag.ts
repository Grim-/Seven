import { useState, type DragEvent } from 'react'

export interface ThingDrag {
  things?: string[]
  layer?: string
}

const MIME = 'application/x-seven-map-things'
let dragging: ThingDrag | null = null

export function dragProps(payload: ThingDrag) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.stopPropagation()
      dragging = payload
      e.dataTransfer.setData(MIME, JSON.stringify(payload))
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragEnd: () => {
      dragging = null
    }
  }
}

export function useThingDrop(accept: (drag: ThingDrag) => boolean, onDrop: (drag: ThingDrag) => void) {
  const [over, setOver] = useState(false)
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        if (!dragging || !accept(dragging)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        const drag = dragging
        setOver(false)
        if (!drag || !accept(drag)) return
        e.preventDefault()
        e.stopPropagation()
        dragging = null
        onDrop(drag)
      }
    }
  }
}
