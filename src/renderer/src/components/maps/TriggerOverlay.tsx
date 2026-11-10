import type { MouseEvent } from 'react'
import { Zap, MousePointerClick } from 'lucide-react'
import { shapeBounds, type Size } from '@shared/shapes'
import type { TriggerDef } from '@shared/game/triggers'
import { OutlinePath } from '../shapes/OutlinePath'
import { boundsStyle } from '../shapes/boundsStyle'
import { cn } from '../../lib/cn'

interface Props {
  size: Size
  triggers: TriggerDef[]
  selected?: string | null
  onPick?: (trigger: TriggerDef) => void
  onMenu?: (e: MouseEvent, trigger: TriggerDef) => void
  className?: string
}

export function TriggerOverlay({ size, triggers, selected, onPick, onMenu, className }: Props) {
  if (!triggers.length) return null

  return (
    <span className={cn('pointer-events-none absolute inset-0 z-[4]', className)}>
      {triggers.map((t, i) => {
        const bounds = shapeBounds(t.shape)
        const isSelected = t.id === selected
        const isEnter = t.fires === 'enter'

        return (
          <button
            key={t.id}
            type="button"
            title={`${t.name} (${t.type}) · Fires on ${t.fires}`}
            onClick={(e) => {
              e.stopPropagation()
              onPick?.(t)
            }}
            onContextMenu={(e) => {
              e.stopPropagation()
              onMenu?.(e, t)
            }}
            style={{
              ...boundsStyle(bounds, size),
              animationDelay: `${0.1 + i * 0.05}s`
            }}
            className={cn(
              'absolute pointer-events-auto border-2 border-dashed transition-all cursor-pointer font-mono',
              isSelected
                ? 'border-accent bg-accent/20 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'border-accent/60 bg-accent/5 hover:border-accent hover:bg-accent/15'
            )}
          >
            {t.shape.kind === 'outline' && <OutlinePath points={t.shape.points} bounds={bounds} />}
            <span
              className={cn(
                'absolute -top-3 left-1 flex items-center gap-1 border px-1 py-0.2 text-[9px] font-bold uppercase shadow-sm select-none',
                isEnter
                  ? 'border-accent bg-black/90 text-accent'
                  : 'border-cyan bg-black/90 text-cyan'
              )}
            >
              {isEnter ? <Zap className="h-2.5 w-2.5 text-accent shrink-0" /> : <MousePointerClick className="h-2.5 w-2.5 text-cyan shrink-0" />}
              <span className="truncate max-w-[120px]">{t.name}</span>
            </span>
          </button>
        )
      })}
    </span>
  )
}
