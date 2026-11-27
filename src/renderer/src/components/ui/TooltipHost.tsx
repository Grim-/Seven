import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { fitNear, type NearSide } from '../../lib/fitNear'

type Source = 'title' | 'component'

interface Tip {
  rect: DOMRect
  title: string | null
  body: ReactNode
  side: NearSide
  source: Source
}

const useTip = create<{ tip: Tip | null }>(() => ({ tip: null }))

const DELAY_MS = 350

export function showTip(el: Element, title: string | null, body: ReactNode, side: NearSide = 'top', source: Source = 'component'): void {
  useTip.setState({ tip: { rect: el.getBoundingClientRect(), title, body, side, source } })
}

export function hideTip(source?: Source): void {
  if (!source || useTip.getState().tip?.source === source) useTip.setState({ tip: null })
}

function textOf(el: HTMLElement): string | null {
  const title = el.getAttribute('title')
  if (title !== null) {
    el.removeAttribute('title')
    if (title) {
      el.dataset.tip = title
      if (!el.getAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', title)
    }
  }
  return el.dataset.tip || null
}

export function TooltipHost() {
  const tip = useTip((s) => s.tip)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer = 0
    let current: HTMLElement | null = null
    const over = (e: PointerEvent) => {
      const el = e.target instanceof Element ? (e.target.closest('[title],[data-tip]') as HTMLElement | null) : null
      if (el === current) return
      current = el
      window.clearTimeout(timer)
      hideTip('title')
      const text = el ? textOf(el) : null
      if (!el || !text) return
      timer = window.setTimeout(() => {
        if (current === el && el.isConnected) showTip(el, null, text, 'top', 'title')
      }, DELAY_MS)
    }
    const clear = () => {
      window.clearTimeout(timer)
      current = null
      hideTip()
    }
    document.addEventListener('pointerover', over, true)
    window.addEventListener('scroll', clear, true)
    window.addEventListener('pointerdown', clear, true)
    window.addEventListener('keydown', clear, true)
    window.addEventListener('blur', clear)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerover', over, true)
      window.removeEventListener('scroll', clear, true)
      window.removeEventListener('pointerdown', clear, true)
      window.removeEventListener('keydown', clear, true)
      window.removeEventListener('blur', clear)
    }
  }, [])

  useLayoutEffect(() => {
    const el = box.current
    if (!el || !tip) return
    const { left, top } = fitNear(tip.rect, el.getBoundingClientRect(), tip.side, 'center')
    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
  }, [tip])

  if (!tip) return null
  return createPortal(
    <div ref={box} style={{ position: 'fixed', left: 0, top: 0, visibility: 'hidden' }} className="record pointer-events-none z-[1000] w-max max-w-80">
      {tip.title && <span className="record-header block">SYS.RECORD // {tip.title}</span>}
      {tip.body && <span className={tip.title ? 'relative z-[2] block px-3 py-2 text-[12px] leading-relaxed text-ink' : 'relative z-[2] block px-2.5 py-1.5 text-[12px] leading-snug text-ink'}>{tip.body}</span>}
    </div>,
    document.body
  )
}
