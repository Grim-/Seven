import { useEffect, useRef, useState } from 'react'

interface Layer {
  run: () => void
}

const layers: Layer[] = []
let listening = false

function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  const active = document.activeElement as HTMLElement | null
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
    e.preventDefault()
    active.blur()
    return
  }
  const top = layers[layers.length - 1]
  if (!top) return
  e.preventDefault()
  top.run()
}

export function useEscapeLayer(active: boolean, onEscape: () => void): number {
  const handler = useRef(onEscape)
  handler.current = onEscape
  const [depth, setDepth] = useState(0)
  useEffect(() => {
    if (!active) return
    if (!listening) {
      window.addEventListener('keydown', onKey)
      listening = true
    }
    const layer: Layer = { run: () => handler.current() }
    layers.push(layer)
    setDepth(layers.length)
    return () => {
      layers.splice(layers.indexOf(layer), 1)
    }
  }, [active])
  return depth
}
