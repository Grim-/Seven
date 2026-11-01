import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Pin, ScrollText } from 'lucide-react'
import type { PromptView } from '@shared/types'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { draftOf, useSessions } from '../../store/sessions'
import { cn } from '../../lib/cn'
import { useConversation } from '../../lib/conversation'

const CLOSE_DELAY = 220

export function PromptPeek() {
  const conv = useConversation()
  const activeId = conv.sessionId
  const draftAgentId = useSessions((s) => draftOf(s, conv.key).agentId)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [view, setView] = useState<PromptView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [place, setPlace] = useState<{ top: number; left: number; width: number; height: number }>({ top: 0, left: 0, width: 0, height: 0 })
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)

  const cancelClose = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const measure = () => {
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const margin = 12
    const width = Math.min(780, window.innerWidth - margin * 2)
    const left = Math.min(Math.max(margin, r.right - width), window.innerWidth - width - margin)
    const top = r.bottom + 8
    setPlace({ top, left, width, height: Math.max(160, window.innerHeight - top - margin) })
  }
  const show = () => {
    cancelClose()
    measure()
    setOpen(true)
  }
  const hideSoon = () => {
    if (pinned) return
    cancelClose()
    timer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY)
  }

  useEffect(() => {
    if (!open) return
    let live = true
    setError(null)
    engine('sessions.prompt', { id: activeId, agentId: draftAgentId })
      .then((v) => live && setView(v))
      .catch((err) => live && setError(errorText(err)))
    return () => {
      live = false
    }
  }, [open, activeId, draftAgentId])

  useEffect(() => {
    if (!pinned) return
    const away = (e: MouseEvent) => {
      if (panel.current?.contains(e.target as Node) || button.current?.contains(e.target as Node)) return
      setPinned(false)
      setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPinned(false)
      setOpen(false)
    }
    window.addEventListener('mousedown', away)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
    }
  }, [pinned])

  useEffect(() => cancelClose, [])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  return (
    <>
      <button
        ref={button}
        title="What the agent sees (click to keep it open)"
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onClick={() => {
          if (pinned) {
            setPinned(false)
            setOpen(false)
          } else {
            show()
            setPinned(true)
          }
        }}
        className={cn('flex h-7 w-7 shrink-0 items-center justify-center border', pinned ? 'border-accent/70 text-accent' : 'border-line/60 text-dim hover:text-white')}
      >
        <ScrollText className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={panel}
          onMouseEnter={cancelClose}
          onMouseLeave={hideSoon}
          style={{ top: place.top, left: place.left, width: place.width, maxHeight: place.height }}
          className="record fixed z-[250] flex flex-col"
        >
          <div className="record-header flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate">What the agent sees</span>
            {view && (
              <span className="shrink-0 font-mono text-[10px] normal-case tracking-normal text-faint">
                {view.format !== 'none' ? `${view.format} · ` : ''}
                {view.tokens !== null ? `${view.tokens.toLocaleString()} tokens · ` : ''}
                {view.text.length.toLocaleString()} chars
              </span>
            )}
            <button
              title="Copy all"
              disabled={!view}
              onClick={() => {
                if (!view) return
                void navigator.clipboard.writeText(view.text).then(() => {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1200)
                })
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center text-dim hover:text-accent disabled:opacity-40"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              title={pinned ? 'Unpin' : 'Keep open'}
              onClick={() => setPinned((p) => !p)}
              className={cn('flex h-5 w-5 shrink-0 items-center justify-center hover:text-accent', pinned ? 'text-accent' : 'text-dim')}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
          </div>
          {view?.note && <div className="relative z-[2] border-b border-line/40 px-3 py-1.5 text-[11.5px] text-dim">{view.note}</div>}
          <div className="relative z-[2] min-h-0 flex-1 overflow-auto px-3 py-2">
            {error ? (
              <div className="text-[12px] text-alert">{error}</div>
            ) : !view ? (
              <div className="font-mono text-[11px] text-dim">Loading…</div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-white/90">{view.text}</pre>
            )}
          </div>
        </div>
      )}
    </>
  )
}
