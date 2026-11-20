import {
  ExternalLink,
  Flag,
  Heart,
  Maximize2,
  Minimize2,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X,
  MapPin,
  Footprints
} from 'lucide-react'
import type { PlaceVisitor, Standing } from '@shared/maps'
import type { WorldEntity } from '@shared/world'
import type { StoredFaction } from '@shared/game/factions'
import { recordHealth } from '@shared/game/components'
import { getFactionStance, STANCE_BADGE } from '@shared/game/factions'
import { showName } from '@shared/ids'
import { DND_STATS, modifier, type DndStat } from '@shared/dnd'
import { Button, Select } from '../ui'
import { SheetPortrait } from '../data/SheetPortrait'
import { useGameCatalog } from '../game/useGameCatalog'
import { placeName } from './placeShapes'
import { openSevenLink } from '../../lib/links'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { cn } from '../../lib/cn'

interface Props {
  visitor: PlaceVisitor
  world: string
  places: Record<string, WorldEntity>
  isPlayer: boolean
  standing?: Standing
  currentPlaceKey: string | null
  isExpanded?: boolean
  onToggleExpand?: () => void
  onSetPlayer: () => void
  onSetFaction: (factionId: string | null) => void
  onMoveToPlace: (placeKey: string | null) => void
  onRemoveFromMap: () => void
  onClose: () => void
}

export function WorldCharacterInspector({
  visitor,
  places,
  isPlayer,
  standing,
  currentPlaceKey,
  isExpanded,
  onToggleExpand,
  onSetPlayer,
  onSetFaction,
  onMoveToPlace,
  onRemoveFromMap,
  onClose
}: Props) {
  const catalog = useGameCatalog()
  const factions: StoredFaction[] = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const playerFactionId = isPlayer ? (visitor.faction || 'player_party') : 'player_party'
  const targetFactionId = visitor.faction || (isPlayer ? 'player_party' : 'monsters')
  const stance = getFactionStance(factions, playerFactionId, targetFactionId)
  const stanceBadge = STANCE_BADGE[stance]

  const hp = recordHealth(visitor.game, catalog) ?? visitor.dnd?.hp
  const hpPercent = hp && hp.max > 0 ? Math.max(0, Math.min(100, (hp.cur / hp.max) * 100)) : 100

  const placeOptions = [
    { value: '', label: '(No Place / Roaming)' },
    ...Object.keys(places)
      .sort((a, b) => placeName(places, a).localeCompare(placeName(places, b)))
      .map((k) => ({ value: k, label: placeName(places, k) }))
  ]

  return (
    <div className="flex h-full min-h-0 flex-col font-mono text-[12px] select-none bg-card/95">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2 truncate">
          <Users className="h-4 w-4 text-cyan shrink-0" />
          <span className="font-bold uppercase tracking-wider text-white truncate max-w-[200px]">
            {showName(visitor.name)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-dim hover:text-white p-1 transition-colors"
              title={isExpanded ? 'Collapse panel (360px)' : 'Expand panel (680px)'}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-dim hover:text-white p-1 transition-colors"
            title="Close Inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* BODY SCROLL */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        {/* PROFILE CARD */}
        <div className="flex items-start gap-3 border border-line/40 bg-sidebar/40 p-3">
          <div className="relative shrink-0">
            <SheetPortrait
              image={visitor.image}
              className={cn('h-14 w-14 border', isPlayer ? 'border-accent' : 'border-line/60')}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[13px] font-bold text-white">
                {showName(visitor.name)}
              </span>
              {!isPlayer && (
                <span
                  className={cn('border px-1.5 py-0.5 text-[9px] font-bold uppercase', stanceBadge.cls)}
                  title={`Stance toward party: ${stance.toUpperCase()}`}
                >
                  {stanceBadge.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[10.5px]">
              {isPlayer ? (
                <span className="font-bold text-accent">[ ACTIVE PLAYER ]</span>
              ) : (
                <span className="text-dim">[ NPC / CREATURE ]</span>
              )}
              {visitor.line && <span className="text-faint truncate">· {visitor.line}</span>}
            </div>

            {standing?.at && (
              <div className="flex items-center gap-1 text-[10px] text-faint">
                <MapPin className="h-3 w-3 text-cyan" />
                <span>Token at: {standing.at.x}, {standing.at.y}</span>
              </div>
            )}
          </div>
        </div>

        {/* VITALS & STATS */}
        <div className="flex flex-col gap-2 border border-line/40 bg-sidebar/20 p-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
            Tactical Vitals
          </span>

          {/* HP BAR */}
          {hp ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-dim">
                  <Heart className="h-3.5 w-3.5 text-alert" /> Hit Points
                </span>
                <span className="font-bold text-white">
                  {hp.cur} / {hp.max} HP {'temp' in hp && hp.temp > 0 ? `(+${hp.temp} temp)` : ''}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden bg-black/60 border border-line/30">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    hpPercent > 50 ? 'bg-ok' : hpPercent > 20 ? 'bg-accent' : 'bg-alert'
                  )}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-faint">No DnD combat stats recorded.</div>
          )}

          {/* AC & SPEED */}
          {visitor.dnd && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line/20">
              <div className="flex items-center justify-between border border-line/30 bg-black/30 px-2 py-1">
                <span className="flex items-center gap-1 text-[10.5px] text-dim">
                  <Shield className="h-3 w-3 text-accent" /> AC
                </span>
                <span className="font-bold text-white text-[12px]">{visitor.dnd.ac || 10}</span>
              </div>
              <div className="flex items-center justify-between border border-line/30 bg-black/30 px-2 py-1">
                <span className="flex items-center gap-1 text-[10.5px] text-dim">
                  <Footprints className="h-3 w-3 text-cyan" /> Speed
                </span>
                <span className="font-bold text-white text-[12px]">30 ft</span>
              </div>
            </div>
          )}
        </div>

        {/* 6 ABILITY SCORES */}
        {visitor.dnd?.stats && (
          <div className="flex flex-col gap-1.5 border border-line/40 bg-sidebar/20 p-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
              Ability Scores
            </span>
            <div className="grid grid-cols-6 gap-1 text-center">
              {DND_STATS.map((stat) => {
                const score = visitor.dnd?.stats?.[stat as DndStat] ?? 10
                const mod = modifier(score)
                return (
                  <div key={stat} className="flex flex-col border border-line/30 bg-black/40 py-1 px-0.5">
                    <span className="text-[9px] uppercase font-bold text-dim">{stat}</span>
                    <span className="text-[12px] font-bold text-white">{score}</span>
                    <span className="text-[9.5px] text-accent font-mono">{mod}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* FACTION ASSIGNMENT */}
        <div className="flex flex-col gap-1.5 border border-line/40 bg-sidebar/20 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
            <Flag className="h-3 w-3 text-cyan" />
            <span>Faction Allegiance</span>
          </div>
          <Select
            value={visitor.faction ?? ''}
            options={[
              { value: '', label: '(No Faction / Independent)' },
              ...factions.map((f) => ({ value: f.id, label: `${f.name} (${f.defaultStance})` }))
            ]}
            onChange={(val) => onSetFaction(val || null)}
            className="h-7 text-[11px]"
          />
        </div>

        {/* PLACE ASSIGNMENT */}
        <div className="flex flex-col gap-1.5 border border-line/40 bg-sidebar/20 p-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-faint">
            <MapPin className="h-3 w-3 text-cyan" />
            <span>Assigned Place</span>
          </div>
          <Select
            value={currentPlaceKey ?? ''}
            options={placeOptions}
            onChange={(val) => onMoveToPlace(val || null)}
            className="h-7 text-[11px]"
          />
        </div>

        {/* CONDITIONS */}
        {visitor.dnd?.conditions && visitor.dnd.conditions.length > 0 && (
          <div className="flex flex-col gap-1.5 border border-line/40 bg-sidebar/20 p-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-alert">
              Active Conditions
            </span>
            <div className="flex flex-wrap gap-1">
              {visitor.dnd.conditions.map((c) => (
                <span
                  key={c}
                  className="border border-alert/40 bg-alert/10 px-1.5 py-0.5 text-[10px] uppercase text-alert font-bold"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="mt-auto flex flex-col gap-2 border-t border-line/40 pt-3">
          {!isPlayer && (
            <Button
              size="sm"
              variant="primary"
              icon={<UserCheck className="h-3.5 w-3.5" />}
              onClick={onSetPlayer}
              className="w-full justify-center"
            >
              Take Control (Set Active Player)
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            icon={<ExternalLink className="h-3.5 w-3.5" />}
            onClick={() => openSevenLink(`seven:sheet/${encodeURIComponent(visitor.sheet)}`)}
            className="w-full justify-center"
          >
            Open Full Character Sheet
          </Button>

          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="h-3.5 w-3.5 text-alert" />}
            onClick={onRemoveFromMap}
            className="w-full justify-center text-alert/80 hover:text-alert hover:bg-alert/10"
          >
            Take Off Map
          </Button>
        </div>
      </div>
    </div>
  )
}
