import { Check, Clapperboard, LayoutDashboard, MessageSquare } from 'lucide-react'
import { CHAT_VIEW_MODES, resolveChatViewMode, setChatViewMode, type ChatViewMode } from '../../lib/chatViewMode'
import { useCinema } from '../../lib/cinema'
import { useKeybindLabel } from '../../store/keybinds'
import { cn } from '../../lib/cn'
import { Popover } from '../ui'
import { useTabletopMode } from './tabletopStore'

const ICONS: Record<ChatViewMode, typeof MessageSquare> = {
  default: MessageSquare,
  tabletop: LayoutDashboard,
  cinema: Clapperboard
}

export function ChatViewModeButton({ className }: { className?: string }) {
  const [cinema] = useCinema()
  const [mode] = useTabletopMode()
  const modeKey = useKeybindLabel('chat.cycleMode')
  const active = resolveChatViewMode(cinema, mode.windowed)
  const activeDef = CHAT_VIEW_MODES.find((m) => m.id === active) ?? CHAT_VIEW_MODES[0]
  const ActiveIcon = ICONS[active]

  return (
    <Popover
      title={`Chat view · ${modeKey}`}
      trigger={
        <button
          type="button"
          title={`Chat view: ${activeDef.label} (click to switch · ${modeKey})`}
          className={cn(
            'flex h-6 w-fit shrink-0 cursor-pointer items-center gap-1 border border-line/55 bg-black/55 px-1.5 font-mono text-[9.5px] uppercase tracking-wider text-dim transition-colors hover:border-accent/70 hover:text-white',
            className
          )}
        >
          <ActiveIcon className="h-3 w-3 text-accent/90" />
          <span>{activeDef.label}</span>
        </button>
      }
    >
      {(close) => (
        <div className="flex w-56 flex-col gap-1 p-1.5">
          {CHAT_VIEW_MODES.map((item) => {
            const Icon = ICONS[item.id]
            const isCurrent = item.id === active
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setChatViewMode(item.id)
                  close()
                }}
                className={cn(
                  'flex items-start gap-2 border px-2 py-1.5 text-left transition-colors',
                  isCurrent
                    ? 'border-accent/60 bg-accent/10 text-white'
                    : 'border-transparent text-ink hover:border-line/60 hover:bg-black/45'
                )}
              >
                <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', isCurrent ? 'text-accent' : 'text-dim')} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1 font-mono text-[11px] font-semibold">
                    <span>{item.label}</span>
                    {isCurrent && <Check className="h-3 w-3 text-accent" />}
                  </div>
                  <div className="text-[11px] leading-snug text-dim">{item.summary}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Popover>
  )
}
