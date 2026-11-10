import { useEffect, useMemo } from 'react'
import { showName } from '@shared/ids'
import { GameEntity, type Catalog } from '@shared/game/core'
import type { PlaceVisitor } from '@shared/maps'
import type { MapToken } from '../../maps/TokenLayer'
import { useEscapeLayer } from '../../../lib/escape'
import { useLatest } from '../../../game/react/useLatest'
import { GamePortrait, GameWindow, HudButton } from '../../../game/ui'
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
  return (
    <GameWindow
      title={showName(visitor.name)}
      tabs={gameScreens().map((s) => ({ id: s.id, label: s.label, icon: s.icon, keyHint: s.key.toUpperCase() }))}
      tab={screen.id}
      onTab={onOpen}
      onClose={() => onOpen(null)}
      side={party.map((p) => (
        <GamePortrait key={p.sheet} visitor={p.sheet === visitor.sheet ? { ...p, game: shown } : p} catalog={catalog} active={p.sheet === visitor.sheet} onClick={() => onSheet(p.sheet)} className="border border-line/30" />
      ))}
    >
      <screen.Screen
        entity={entity}
        catalog={catalog}
        visitor={visitor}
        act={act}
        onClose={() => onOpen(null)}
        onAim={onAim}
      />
    </GameWindow>
  )
}

export function GameScreens({
  open,
  sheet,
  tokens,
  catalog,
  onOpen,
  onSheet,
  onAim
}: {
  open: string | null
  sheet: string | null
  tokens: MapToken[]
  catalog: Catalog
  onOpen: (id: string | null) => void
  onSheet: (sheet: string) => void
  onAim?: (aim: { uid: string; label: string } | null) => void
}) {
  const party = tokens.flatMap((t) => (t.visitor.game ? [t.visitor] : []))
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
