import { useEffect, useRef, useState } from 'react'

const GLYPHS = '0123456789<>{}[]/\\|@#$%&*+=?'

function scrambled(text: string): string {
  let out = ''
  for (const ch of text) out += ch === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
  return out
}

function calm(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function DecodeText({ text, onMount = true, duration = 520, className }: { text: string; onMount?: boolean; duration?: number; className?: string }) {
  const [shown, setShown] = useState(() => (onMount && !calm() ? scrambled(text) : text))
  const first = useRef(true)
  useEffect(() => {
    const initial = first.current
    first.current = false
    if ((initial && !onMount) || calm() || !text) {
      setShown(text)
      return
    }
    const start = performance.now()
    let last = 0
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      if (t - last > 33 || p === 1) {
        last = t
        const fixed = Math.floor(p * text.length)
        setShown(text.slice(0, fixed) + scrambled(text.slice(fixed)))
      }
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text])
  return <span className={className}>{shown}</span>
}
