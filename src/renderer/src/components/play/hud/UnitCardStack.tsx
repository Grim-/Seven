import { useState, type ReactNode } from 'react'
import { Shield, Crosshair } from 'lucide-react'
import { SheetPortrait } from '../../data/SheetPortrait'
import { SlateContainer } from '../../entries/EntrySlate'
import { cn } from '../../../lib/cn'

export interface UnitCardData {
  id: string
  name: string
  sheet?: string | null
  image?: string | null
  level?: number | string | null
  cr?: number | string | null
  ac?: number
  hp: { cur: number; max: number }
  tempHp?: number
  conditions?: string[]
  isPlayer?: boolean
  isActiveTurn?: boolean
  isSelected?: boolean
  faction?: string | null
  subtitle?: string | null
}

export interface UnitCardStackProps {
  title: string
  side: 'left' | 'right'
  units: UnitCardData[]
  activeId?: string | null
  selectedId?: string | null
  accentColor?: 'cyan' | 'alert' | 'accent' | 'ok' | 'purple'
  onSelect?: (id: string) => void
  onClear?: () => void
  footer?: ReactNode
  className?: string
}

export function UnitCardStack({
  title,
  side,
  units,
  activeId,
  selectedId,
  onSelect,
  onClear,
  footer,
  className
}: UnitCardStackProps) {
  const [expanded, setExpanded] = useState(true)
  if (!units || units.length === 0) return null

  const isLeft = side === 'left'

  return (
    <SlateContainer
      title={title}
      tag={String(units.length)}
      expanded={expanded}
      onToggleExpand={() => setExpanded((v) => !v)}
      onRemove={onClear}
      className={cn('pointer-events-auto w-64 font-ui text-[11px]', className)}
    >
      <div className="flex flex-col gap-1.5 p-1.5">
        {units.map((unit) => {
          const isActive = activeId === unit.id || unit.isActiveTurn
          const isSelected = selectedId === unit.id || unit.isSelected
          const isDead = unit.hp.cur <= 0

          const hpPct = Math.max(0, Math.min(100, (unit.hp.cur / Math.max(1, unit.hp.max)) * 100))
          const hpColor =
            isDead
              ? 'bg-line/40'
              : hpPct <= 25
                ? 'bg-alert'
                : hpPct <= 50
                  ? 'bg-accent'
                  : isLeft
                    ? 'bg-tint-cyan'
                    : 'bg-alert'

          return (
            <div
              key={unit.id}
              onClick={() => onSelect?.(unit.id)}
              className={cn(
                'group relative flex flex-col border tone-panel-70 p-1.5 transition-all',
                onSelect && 'cursor-pointer hover:bg-ink/[0.04]',
                isActive
                  ? isLeft
                    ? 'border-tint-cyan shadow-[0_0_12px_color-mix(in_srgb,rgb(0,216,246)_calc(25%*var(--glow)),transparent)]'
                    : 'border-alert shadow-[0_0_12px_color-mix(in_srgb,rgb(255,77,77)_calc(25%*var(--glow)),transparent)]'
                  : isSelected
                    ? 'border-accent shadow-[0_0_10px_color-mix(in_srgb,rgb(255,160,0)_calc(20%*var(--glow)),transparent)]'
                    : 'border-line/50 hover:border-line'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center overflow-hidden border tone-well-80 text-[11px] font-bold',
                      isActive
                        ? isLeft
                          ? 'border-tint-cyan text-tint-cyan'
                          : 'border-alert text-alert'
                        : isSelected
                          ? 'border-accent text-accent'
                          : 'border-line/50 text-ink'
                    )}
                  >
                    {unit.image ? (
                      <SheetPortrait image={unit.image} className="h-full w-full object-cover" />
                    ) : (
                      <span>{unit.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  {isActive && (
                    <div
                      className={cn(
                        'absolute -right-1 -top-1 flex h-3 items-center justify-center border px-1 text-[7.5px] font-extrabold caps',
                        isLeft ? 'border-tint-cyan bg-tint-cyan text-on-accent' : 'border-alert bg-alert text-ink'
                      )}
                    >
                      ACT
                    </div>
                  )}

                  {isSelected && !isActive && (
                    <div className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center border border-accent bg-well text-accent">
                      <Crosshair className="h-2.5 w-2.5" />
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        'truncate text-[11px] font-bold',
                        isDead ? 'text-faint line-through' : 'text-ink group-hover:text-tint-cyan'
                      )}
                    >
                      {unit.name}
                    </span>
                    {unit.ac !== undefined && (
                      <span className="flex shrink-0 items-center gap-0.5 text-[9px] font-bold text-accent">
                        <Shield className="h-2.5 w-2.5 text-accent" />
                        <span>{unit.ac}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 truncate text-[8.5px] text-faint">
                    {unit.level !== undefined && unit.level !== null && <span className="text-dim">LVL {unit.level}</span>}
                    {unit.cr !== undefined && unit.cr !== null && <span className="text-dim">CR {unit.cr}</span>}
                    {unit.faction && <span className="truncate caps text-faint">{unit.faction}</span>}
                    {unit.subtitle && <span className="truncate text-dim">{unit.subtitle}</span>}
                  </div>
                </div>
              </div>

              <div className="mt-1.5 flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[8.5px]">
                  <span className="font-semibold text-faint">{isDead ? 'DOWNED' : 'HEALTH'}</span>
                  <span
                    className={cn(
                      'font-ui font-bold',
                      isDead ? 'text-faint' : hpPct <= 25 ? 'text-alert' : hpPct <= 50 ? 'text-accent' : 'text-dim'
                    )}
                  >
                    {unit.hp.cur}/{unit.hp.max}
                    {unit.tempHp ? ` (+${unit.tempHp})` : ''}
                  </span>
                </div>

                <div className="h-1.5 w-full border border-line/40 tone-panel-60">
                  <div className={cn('h-full transition-all duration-300', hpColor)} style={{ width: `${hpPct}%` }} />
                </div>
              </div>

              {unit.conditions && unit.conditions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {unit.conditions.map((cond) => (
                    <span
                      key={cond}
                      className="border border-line/50 bg-ink/[0.04] px-1 py-0.2 text-[8px] font-semibold caps text-dim"
                    >
                      {cond}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {footer && <div className="border-t border-line/40 pt-1.5">{footer}</div>}
      </div>
    </SlateContainer>
  )
}
