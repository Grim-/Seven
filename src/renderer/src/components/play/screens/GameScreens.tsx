import { useEffect, useMemo } from 'react'
import { showName } from '@shared/ids'
import { GameEntity, type Catalog } from '@shared/game/core'
import type { PlaceVisitor } from '@shared/maps'
import type { MapToken } from '../../maps/TokenLayer'
import { useEscapeLayer } from '../../../lib/escape'
import { useLatest } from '../../../game/react/useLatest'
import { GamePortrait, HudButton } from '../../../game/ui'
import { SlateContainer } from '../../entries/EntrySlate'
import { cn } from '../../../lib/cn'
import { gameScreen, gameScreens, type GameScreen } from './registry'
import { useGameAct } from './useGameAct'
import { useGameplaySettings } from '../settings/gameplaySettingsStore'

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

export function GameMenu({ open, onOpen }: { open: string | null; onOpen: (id: string | null) => void }) {
  const latest = useLatest({ open, onOpen })
  const binds = useGameplaySettings((s) => s.settings.keybinds)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
      const currentBinds = useGameplaySettings.getState().settings.keybinds
      const screen = gameScreens().find((s) => {
        const customBind = currentBinds[s.id]
        if (customBind && (customBind.code === e.code || customBind.display.toLowerCase() === e.key.toLowerCase())) return true
        return s.key === e.key.toLowerCase()
      })
      if (!screen) return
      e.preventDefault()
      latest.current.onOpen(latest.current.open === screen.id ? null : screen.id)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [latest])
  return (
    <div className="pointer-events-auto flex gap-1.5">
      {gameScreens().map((s) => (
        <HudButton key={s.id} icon={s.icon} label={s.label} keyHint={binds[s.id]?.display ?? s.key.toUpperCase()} active={open === s.id} onClick={() => onOpen(open === s.id ? null : s.id)} />
      ))}
    </div>
  )
}

function ScreenWindow({
  screen,
  visitor,
  party,
  catalog,
  onOpen,
  onSheet,
  onAim
}: {
  screen: GameScreen
  visitor: PlaceVisitor
  party: PlaceVisitor[]
  catalog: Catalog
  onOpen: (id: string | null) => void
  onSheet: (sheet: string) => void
  onAim?: (aim: { uid: string; label: string } | null) => void
}) {
  const { shown, act } = useGameAct(visitor.sheet, visitor.game!, catalog)
  const entity = useMemo(() => GameEntity.fromRecord(shown, catalog), [shown, catalog])
  const tabs = gameScreens()
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-scrim/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpen(null)
      }}
    >
      <SlateContainer
        title={showName(visitor.name)}
        tag={screen.label}
        expanded={true}
        onRemove={() => onOpen(null)}
        actions={
          <div className="flex items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpen(t.id)}
                className={cn(
                  'flex h-5 items-center gap-1 border px-1.5 font-label text-[9.5px] caps-5 transition-colors cursor-pointer',
                  t.id === screen.id
                    ? 'border-accent bg-accent/20 text-accent'
                    : 'border-line/50 tone-well-60 text-dim hover:border-line hover:text-ink'
                )}
              >
                <span>{t.label}</span>
                <span className="text-[8px] text-faint">[{t.key.toUpperCase()}]</span>
              </button>
            ))}
          </div>
        }
        className="flex h-[min(82vh,760px)] w-[min(980px,calc(100vw-2rem))] flex-col"
      >
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {party.length > 1 && (
            <div className="flex w-52 shrink-0 flex-col gap-1.5 overflow-y-auto border-r border-line/50 p-2">
              {party.map((p) => (
                <GamePortrait
                  key={p.sheet}
                  visitor={p.sheet === visitor.sheet ? { ...p, game: shown } : p}
                  catalog={catalog}
                  active={p.sheet === visitor.sheet}
                  onClick={() => onSheet(p.sheet)}
                  className="border border-line/30"
                />
              ))}
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
            <screen.Screen
              entity={entity}
              catalog={catalog}
              visitor={visitor}
              act={act}
              onClose={() => onOpen(null)}
              onAim={onAim}
            />
          </div>
        </div>
      </SlateContainer>
    </div>
  )
}

export function GameScreens({
  open,
  sheet,
  partyIds,
  tokens,
  catalog,
  onOpen,
  onSheet,
  onAim
}: {
  open: string | null
  sheet: string | null
  partyIds?: string[]
  tokens: MapToken[]
  catalog: Catalog
  onOpen: (id: string | null) => void
  onSheet: (sheet: string) => void
  onAim?: (aim: { uid: string; label: string } | null) => void
}) {
  const partySet = new Set(partyIds?.length ? partyIds : (sheet ? [sheet] : []))
  const party = tokens.flatMap((t) => (t.visitor.source !== 'creature' && partySet.has(t.visitor.sheet) && t.visitor.game ? [t.visitor] : []))
  const visitor = party.find((v) => v.sheet === sheet) ?? party[0] ?? null
  const screen = open ? gameScreen(open) : null
  useEscapeLayer(!!screen && !!visitor, () => onOpen(null))
  if (!screen || !visitor) return null
  return (
    <ScreenWindow
      key={visitor.sheet}
      screen={screen}
      visitor={visitor}
      party={party}
      catalog={catalog}
      onOpen={onOpen}
      onSheet={onSheet}
      onAim={onAim}
    />
  )
}
