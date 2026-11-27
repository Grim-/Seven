import { useEffect, useState } from 'react'

export function useSurfaceOutline(surface: string): void {
  useEffect(() => {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(`[data-skin-surface="${CSS.escape(surface)}"] { outline: 2px dashed var(--color-accent); outline-offset: 2px; }`)
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet)
    }
  }, [surface])
}

export function useSurfacePick(onPick: (surface: string) => void): { picking: boolean; pick: () => void } {
  const [picking, setPicking] = useState(false)
  useEffect(() => {
    if (!picking) return
    const click = (e: MouseEvent) => {
      const hit = (e.target as Element | null)?.closest('[data-skin-surface]')
      e.preventDefault()
      e.stopPropagation()
      setPicking(false)
      const id = hit?.getAttribute('data-skin-surface')
      if (id) onPick(id)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicking(false)
    }
    const timer = window.setTimeout(() => window.addEventListener('click', click, true), 0)
    window.addEventListener('keydown', key, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('click', click, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [picking, onPick])
  return { picking, pick: () => setPicking(true) }
}
