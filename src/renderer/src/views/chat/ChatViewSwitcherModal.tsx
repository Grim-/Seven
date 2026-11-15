import { useEffect, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Clapperboard, LayoutDashboard, MessageSquare } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useEscapeLayer } from '../../lib/escape'
import { useConversation } from '../../lib/conversation'
import {
  CHAT_VIEW_MODES,
  resolveChatViewMode,
  setChatViewMode,
  useChatViewSwitcher,
  type ChatViewMode
} from '../../lib/chatViewMode'
import { useCinema } from '../../lib/cinema'
import {
  useBoardSurfaces,
  useChatDashboard,
  useTabletopMode
} from '../../components/chat/tabletopStore'
import { useKeybindLabel } from '../../store/keybinds'

const CARD_W = 192
const CARD_H = 128

const MODE_ICON: Record<ChatViewMode, ComponentType<{ className?: string }>> = {
  default: MessageSquare,
  tabletop: LayoutDashboard,
  cinema: Clapperboard
}

function ChatViewSwitcherContent({ onClose }: { onClose: () => void }) {
  const [cinema] = useCinema()
  const [tabletopMode] = useTabletopMode()
  const { sessionId } = useConversation()
  const [dashboard] = useChatDashboard(sessionId)
  const { activeSlot } = useBoardSurfaces(dashboard?.id ?? null)
  const modeKey = useKeybindLabel('chat.cycleMode')
  const currentMode = resolveChatViewMode(cinema, tabletopMode.windowed)

  useEscapeLayer(true, onClose)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const idx = Number(e.key)
        const match = CHAT_VIEW_MODES.find((m) => m.index === idx)
        if (match) {
          e.preventDefault()
          setChatViewMode(match.id)
          onClose()
        }
        return
      }
      const delta =
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? 1
          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
            ? -1
            : 0
      if (delta !== 0) {
        const curIdx = CHAT_VIEW_MODES.findIndex((m) => m.id === currentMode)
        const next = CHAT_VIEW_MODES[curIdx + delta]
        if (next) {
          e.preventDefault()
          setChatViewMode(next.id)
        }
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentMode, onClose])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="pointer-events-auto fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/88 backdrop-blur-md select-none"
    >
      <div className="pointer-events-none absolute top-5 flex items-center gap-3 border border-line/60 bg-black/85 px-3.5 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">
        <span className="font-bold text-accent">Chat</span>
        <span>·</span>
        <span>View Mode Overview</span>
        <span className="text-faint">({modeKey !== 'Unbound' ? `${modeKey} or ` : ''}Esc to close)</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 px-6">
        {CHAT_VIEW_MODES.map((def) => {
          const isCurrent = def.id === currentMode
          const Icon = MODE_ICON[def.id]
          const tags =
            def.id === 'tabletop'
              ? [activeSlot.label, tabletopMode.layoutMode, ...(dashboard ? [dashboard.name] : [])]
              : def.tags
          return (
            <button
              key={def.id}
              type="button"
              style={{ width: CARD_W, height: CARD_H }}
              onClick={() => {
                setChatViewMode(def.id)
                onClose()
              }}
              className={cn(
                'shell-slate group flex flex-col justify-between p-2.5 text-left transition-all cursor-pointer',
                isCurrent
                  ? 'border-accent border-l-2 border-l-accent bg-accent/15 shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]'
                  : 'hover:border-accent/70'
              )}
            >
              <div className="flex w-full items-center justify-between gap-1.5 border-b border-line/50 pb-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center border font-mono text-[11px] font-bold',
                      isCurrent
                        ? 'border-accent bg-accent text-black'
                        : 'border-line bg-black/60 text-accent-soft'
                    )}
                  >
                    {def.index}
                  </span>
                  <span className="truncate font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-white">
                    {def.label}
                  </span>
                </div>
                <Icon className={cn('h-3.5 w-3.5 shrink-0', isCurrent ? 'text-accent' : 'text-dim')} />
              </div>

              <div className="relative my-1 flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-hidden">
                {tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="max-w-full truncate border border-line/60 border-l-2 border-l-accent bg-black/75 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/85"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                <span>{isCurrent ? 'Active' : 'Click to switch'}</span>
              </div>
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

export function ChatViewSwitcherModal() {
  const open = useChatViewSwitcher((s) => s.open)
  const setOpen = useChatViewSwitcher((s) => s.setOpen)

  return createPortal(
    <AnimatePresence>
      {open && <ChatViewSwitcherContent onClose={() => setOpen(false)} />}
    </AnimatePresence>,
    document.body
  )
}
