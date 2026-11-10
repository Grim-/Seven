import { Shield, Crosshair, X } from 'lucide-react'
import { SheetPortrait } from '../../data/SheetPortrait'
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
  className?: string
}

export function UnitCardStack({
  title,
  side,
  units,
  activeId,
  selectedId,
  accentColor,
  onSelect,
  onClear,
  className
}: UnitCardStackProps) {
  if (!units || units.length === 0) return null

  const isLeft = side === 'left'
  const defaultAccent = accentColor ?? (isLeft ? 'cyan' : 'alert')

  return (
    <div
      className={cn(
        'pointer-events-auto flex flex-col w-60 select-none font-mono text-[11px] shadow-2xl backdrop-blur-md',
        className
      )}
    >
      {/* STACK HEADER */}
      <div className="flex h-6 items-center justify-between border border-line/60 bg-black/90 px-2 text-[9.5px] font-bold uppercase tracking-wider text-dim">
        <div className="flex items-center gap-1.5 truncate">
          <span
            className={cn(
              'h-1.5 w-1.5',
              defaultAccent === 'cyan' && 'bg-cyan',
              defaultAccent === 'alert' && 'bg-alert',
              defaultAccent === 'accent' && 'bg-accent',
              defaultAccent === 'ok' && 'bg-ok',
              defaultAccent === 'purple' && 'bg-purple'
            )}
          />
          <span className="text-white">{title}</span>
          <span className="text-faint">[{units.length}]</span>
        </div>

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            title="Clear target (Esc)"
            className="flex h-4 w-4 items-center justify-center border border-line/40 text-faint hover:border-alert hover:text-alert transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* UNIT CARDS CONTAINER */}
      <div className="flex flex-col gap-1 mt-1">
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
              ? 'bg-cyan'
              : 'bg-alert'

          return (
            <div
              key={unit.id}
              onClick={() => onSelect?.(unit.id)}
              className={cn(
                'group relative flex flex-col border bg-black/90 p-1.5 transition-all',
                onSelect && 'cursor-pointer hover:bg-white/[0.04]',
                // Active turn highlight
                isActive
                  ? isLeft
                    ? 'border-cyan shadow-[0_0_12px_rgba(0,216,246,0.25)]'
                    : 'border-alert shadow-[0_0_12px_rgba(255,77,77,0.25)]'
                  : isSelected
                  ? 'border-accent shadow-[0_0_10px_rgba(255,160,0,0.2)]'
                  : 'border-line/60 hover:border-line'
              )}
            >
              {/* TOP ROW: PORTRAIT + INFO + AC */}
              <div className="flex items-center gap-2">
                {/* PORTRAIT / THUMBNAIL */}
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      'h-9 w-9 overflow-hidden border bg-black/80 flex items-center justify-center text-[11px] font-bold',
                      isActive
                        ? isLeft
                          ? 'border-cyan text-cyan'
                          : 'border-alert text-alert'
                        : isSelected
                        ? 'border-accent text-accent'
                        : 'border-line/50 text-white'
                    )}
                  >
                    {unit.image ? (
                      <SheetPortrait image={unit.image} className="h-full w-full object-cover" />
                    ) : (
                      <span>{unit.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>

                  {/* ACTIVE TURN BADGE */}
                  {isActive && (
                    <div
                      className={cn(
                        'absolute -top-1 -right-1 flex h-3 px-1 items-center justify-center text-[7.5px] font-extrabold uppercase border',
                        isLeft
                          ? 'border-cyan bg-cyan text-black'
                          : 'border-alert bg-alert text-white'
                      )}
                    >
                      ACT
                    </div>
                  )}

                  {/* TARGETED ICON */}
                  {isSelected && !isActive && (
                    <div className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center border border-accent bg-black text-accent">
                      <Crosshair className="h-2.5 w-2.5" />
                    </div>
                  )}
                </div>

                {/* NAME & SUBTITLE */}
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        'truncate text-[11px] font-bold',
                        isDead ? 'text-faint line-through' : 'text-white group-hover:text-cyan'
                      )}
                    >
                      {unit.name}
                    </span>
                    {unit.ac !== undefined && (
                      <span className="flex items-center gap-0.5 shrink-0 text-[9px] font-bold text-accent">
                        <Shield className="h-2.5 w-2.5 text-accent" />
                        <span>{unit.ac}</span>
                      </span>
                    )}
                  </div>

                  {/* SUBTITLE: LEVEL/CR, FACTION */}
                  <div className="flex items-center gap-1.5 text-[8.5px] text-faint truncate">
                    {unit.level !== undefined && unit.level !== null && (
                      <span className="text-dim">LVL {unit.level}</span>
                    )}
                    {unit.cr !== undefined && unit.cr !== null && (
                      <span className="text-dim">CR {unit.cr}</span>
                    )}
                    {unit.faction && (
                      <span className="truncate uppercase text-faint">
                        {unit.faction}
                      </span>
                    )}
                    {unit.subtitle && (
                      <span className="truncate text-dim">
                        {unit.subtitle}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* HP TELEMETRY BAR */}
              <div className="mt-1.5 flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[8.5px]">
                  <span className="text-faint font-semibold">
                    {isDead ? 'DOWNED' : 'HEALTH'}
                  </span>
                  <span
                    className={cn(
                      'font-mono font-bold',
                      isDead
                        ? 'text-faint'
                        : hpPct <= 25
                        ? 'text-alert'
                        : hpPct <= 50
                        ? 'text-accent'
                        : 'text-dim'
                    )}
                  >
                    {unit.hp.cur}/{unit.hp.max}
                    {unit.tempHp ? ` (+${unit.tempHp})` : ''}
                  </span>
                </div>

                {/* BAR TRACK */}
                <div className="h-1.5 w-full border border-line/40 bg-black/60">
                  <div
                    className={cn('h-full transition-all duration-300', hpColor)}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              </div>

              {/* STATUS CONDITIONS / TAGS */}
              {unit.conditions && unit.conditions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {unit.conditions.map((cond) => (
                    <span
                      key={cond}
                      className="border border-line/50 bg-white/[0.04] px-1 py-0.2 text-[8px] font-semibold uppercase text-dim"
                    >
                      {cond}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
