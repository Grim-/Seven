import { useState, useMemo } from 'react'
import {
  ExternalLink,
  Flag,
  Footprints,
  Heart,
  MapPin,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users
} from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import type { PlaceVisitor, Standing, WorldMapUse } from '@shared/maps'
import type { StoredFaction } from '@shared/game/factions'
import { recordHealth } from '@shared/game/components'
import { getFactionStance, STANCE_BADGE } from '@shared/game/factions'
import { showName } from '@shared/ids'
import { DND_STATS, modifier, type DndStat } from '@shared/dnd'
import { Button, EmptyState, confirmDelete, Select } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive, useLibraryData } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { openSevenLink } from '../../lib/links'
import { SheetPortrait } from '../data/SheetPortrait'
import { useGameCatalog } from '../game/useGameCatalog'
import { AddWorldCharacterModal } from './AddWorldCharacterModal'
import { cn } from '../../lib/cn'

interface Props {
  world: WorldMeta
}

export function WorldCharacters({ world }: Props) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const uses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed') ?? []
  const factions: StoredFaction[] = useLive(() => engine('factions.list'), 'factions.changed') ?? []

  // Map sheet IDs to standing info across all maps in this world
  const standingMap = useMemo(() => {
    const map = new Map<string, { mapId: string; use: WorldMapUse; standing: Standing }>()
    for (const u of uses) {
      for (const [sheet, standing] of Object.entries(u.stand)) {
        map.set(sheet, { mapId: u.map, use: u, standing })
      }
    }
    return map
  }, [uses])

  const sheetIds = useMemo(() => [...standingMap.keys()], [standingMap])

  const visitors =
    useLibraryData(
      () =>
        sheetIds.length
          ? engine('places.visitors', { sheets: sheetIds })
          : Promise.resolve([] as PlaceVisitor[]),
      `world-chars.${world.id}.${sheetIds.join(',')}`
    ) ?? []

  const catalog = useGameCatalog()
  const playerVisitor = visitors.find((v) => v.sheet === world.player)
  const playerFactionId = playerVisitor?.faction || 'player_party'

  // Filtered roster
  const filteredVisitors = useMemo(() => {
    if (!searchQuery.trim()) return visitors
    const q = searchQuery.toLowerCase()
    return visitors.filter(
      (v) =>
        showName(v.name).toLowerCase().includes(q) ||
        (v.faction ?? '').toLowerCase().includes(q) ||
        (v.line ?? '').toLowerCase().includes(q)
    )
  }, [visitors, searchQuery])

  // Active selected character (defaults to player or first visitor)
  const activeSheetId =
    selectedSheetId && visitors.some((v) => v.sheet === selectedSheetId)
      ? selectedSheetId
      : world.player && visitors.some((v) => v.sheet === world.player)
      ? world.player
      : visitors[0]?.sheet ?? null

  const selectedVisitor = visitors.find((v) => v.sheet === activeSheetId) ?? null

  const handleSetPlayer = (sheet: string, name: string) => {
    void engine('worlds.setPlayer', { id: world.id, sheet })
      .then(() => toast.success('Active Player Set', `${name} is now your active character.`))
      .catch(failed('Could not set player'))
  }

  const handleRemove = (v: PlaceVisitor) => {
    const info = standingMap.get(v.sheet)
    if (!info) return
    confirmDelete(
      `Remove ${showName(v.name)} from this world?`,
      'They will be taken off their current map. Their character sheet and items remain intact in your files.',
      async () => {
        const { [v.sheet]: _left, ...rest } = info.use.stand
        await engine('worlds.saveMapUse', { id: world.id, use: { ...info.use, stand: rest } })
        if (world.player === v.sheet) {
          await engine('worlds.setPlayer', { id: world.id, sheet: null })
        }
      }
    )
  }

  const handleSetFaction = async (sheetId: string, factionId: string | null) => {
    try {
      await engine('sheets.setFaction', { id: sheetId, faction: factionId })
      toast.success('Faction Updated', `Assigned to ${factionId ?? 'no faction'}.`)
    } catch (err) {
      failed('Could not change faction')(err)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border border-line/40 bg-bg font-mono select-none">
      {/* ROSTER LIST (LEFT PANE) */}
      <div className="flex w-72 shrink-0 flex-col border-r border-line/40 bg-sidebar/20">
        {/* ROSTER HEADER & SEARCH */}
        <div className="flex flex-col gap-2 border-b border-line/30 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
              <Users className="h-3.5 w-3.5 text-accent" />
              <span>Roster</span>
              <span className="text-[10px] text-faint">({visitors.length})</span>
            </div>
            <Button
              size="sm"
              variant="badge"
              icon={<UserPlus className="h-3 w-3" />}
              onClick={() => setShowAddModal(true)}
              className="h-6 text-[10.5px] px-2"
            >
              Add
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-2 h-3 w-3 text-faint" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter roster..."
              className="w-full border border-line/40 bg-black/40 py-1 pl-7 pr-2 text-[11px] text-white placeholder-faint focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* ROSTER ROWS */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto divide-y divide-line/20">
          {filteredVisitors.length === 0 ? (
            <div className="p-4 text-center text-[11px] text-dim">
              {visitors.length === 0 ? 'No characters in this world yet.' : 'No characters match your filter.'}
            </div>
          ) : (
            filteredVisitors.map((v) => {
              const isPlayer = world.player === v.sheet
              const isSelected = activeSheetId === v.sheet
              const curHp = recordHealth(v.game, catalog) ?? v.dnd?.hp
              const hp = curHp ? `${curHp.cur}/${curHp.max} HP` : null
              const targetFactionId = v.faction || (isPlayer ? 'player_party' : 'monsters')
              const stance = getFactionStance(factions, playerFactionId, targetFactionId)
              const stanceBadge = STANCE_BADGE[stance]

              return (
                <button
                  key={v.sheet}
                  type="button"
                  onClick={() => setSelectedSheetId(v.sheet)}
                  className={cn(
                    'flex items-center gap-2.5 p-2 text-left transition-colors',
                    isSelected
                      ? 'border-l-2 border-l-accent bg-accent/15 text-white'
                      : 'border-l-2 border-l-transparent text-dim hover:bg-card/40 hover:text-white'
                  )}
                >
                  <SheetPortrait
                    image={v.image}
                    className={cn('h-8 w-8 shrink-0 border', isPlayer ? 'border-accent' : 'border-line/40')}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-[12px] font-bold text-white">
                        {showName(v.name)}
                      </span>
                      {isPlayer && (
                        <span className="text-[8.5px] font-bold uppercase text-accent border border-accent/40 px-1 shrink-0">
                          Player
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[9.5px]">
                      {hp && <span className="text-dim">{hp}</span>}
                      {!isPlayer && (
                        <span className={cn('truncate font-bold', stanceBadge.cls.split(' ')[0])}>
                          · {stanceBadge.label}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* CHARACTER DOSSIER (RIGHT PANE) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {!selectedVisitor ? (
          <EmptyState title="No character selected">
            Characters, companions, and creature bestiary monsters exist inside the world as character sheets. Click &ldquo;Add Character to World&rdquo; or pick one from the roster.
          </EmptyState>
        ) : (
          (() => {
            const v = selectedVisitor
            const isPlayer = world.player === v.sheet
            const info = standingMap.get(v.sheet)
            const mapName = info ? info.mapId : 'Unknown'
            const hp = recordHealth(v.game, catalog) ?? v.dnd?.hp
            const hpPercent = hp && hp.max > 0 ? Math.max(0, Math.min(100, (hp.cur / hp.max) * 100)) : 100
            const targetFactionId = v.faction || (isPlayer ? 'player_party' : 'monsters')
            const stance = getFactionStance(factions, playerFactionId, targetFactionId)
            const stanceBadge = STANCE_BADGE[stance]

            return (
              <div className="flex flex-col gap-4 max-w-4xl">
                {/* TOP DOSSIER BANNER */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-line/50 bg-card/60 p-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <SheetPortrait
                      image={v.image}
                      className={cn(
                        'h-16 w-16 shrink-0 border-2',
                        isPlayer ? 'border-accent shadow-[0_0_12px_rgba(245,158,11,0.25)]' : 'border-line-strong'
                      )}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[17px] font-bold uppercase tracking-wider text-white">
                          {showName(v.name)}
                        </span>
                        {isPlayer ? (
                          <span className="border border-accent bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent uppercase">
                            Active Player
                          </span>
                        ) : (
                          <span
                            className={cn('border px-2 py-0.5 text-[10px] font-bold uppercase', stanceBadge.cls)}
                          >
                            {stanceBadge.label} Stance
                          </span>
                        )}
                      </div>

                      {v.line && <div className="text-[11.5px] text-dim">{v.line}</div>}

                      <div className="flex items-center gap-3 text-[10.5px] text-faint pt-0.5">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-cyan" /> Map: {mapName}
                        </span>
                        {info?.standing?.at && (
                          <span>Pos: ({info.standing.at.x}, {info.standing.at.y})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BANNER ACTIONS */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {!isPlayer && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<UserCheck className="h-3.5 w-3.5" />}
                        onClick={() => handleSetPlayer(v.sheet, v.name)}
                      >
                        Take Control
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<ExternalLink className="h-3.5 w-3.5" />}
                      onClick={() => openSevenLink(`seven:sheet/${encodeURIComponent(v.sheet)}`)}
                      title="Open full character sheet view"
                    >
                      Full Sheet
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 className="h-3.5 w-3.5 text-alert" />}
                      onClick={() => handleRemove(v)}
                      className="text-alert/70 hover:text-alert hover:bg-alert/10"
                      title="Remove from world"
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                {/* TACTICAL VITALS & COMBAT BAR */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* HP BOX */}
                  <div className="border border-line/40 bg-sidebar/30 p-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="flex items-center gap-1 font-bold uppercase text-dim">
                        <Heart className="h-3.5 w-3.5 text-alert" /> Hit Points
                      </span>
                      <span className="font-bold text-white text-[12px]">
                        {hp ? `${hp.cur} / ${hp.max}` : 'Unset'} {hp && 'temp' in hp && hp.temp ? `(+${hp.temp})` : ''}
                      </span>
                    </div>
                    {hp && (
                      <div className="h-2 w-full overflow-hidden bg-black/60 border border-line/30">
                        <div
                          className={cn(
                            'h-full transition-all duration-300',
                            hpPercent > 50 ? 'bg-ok' : hpPercent > 20 ? 'bg-accent' : 'bg-alert'
                          )}
                          style={{ width: `${hpPercent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* ARMOR CLASS */}
                  <div className="border border-line/40 bg-sidebar/30 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-accent" />
                      <span className="text-[11px] font-bold uppercase text-dim">Armor Class</span>
                    </div>
                    <span className="text-[16px] font-bold text-white">
                      {v.dnd?.ac ?? 10}
                    </span>
                  </div>

                  {/* SPEED */}
                  <div className="border border-line/40 bg-sidebar/30 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Footprints className="h-4 w-4 text-cyan" />
                      <span className="text-[11px] font-bold uppercase text-dim">Speed</span>
                    </div>
                    <span className="text-[16px] font-bold text-white">
                      30 ft
                    </span>
                  </div>
                </div>

                {/* 6 ABILITY SCORES */}
                {v.dnd?.stats && (
                  <div className="flex flex-col gap-2 border border-line/40 bg-sidebar/20 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                      Ability Scores &amp; Modifiers
                    </span>
                    <div className="grid grid-cols-6 gap-2 text-center">
                      {DND_STATS.map((stat) => {
                        const score = v.dnd?.stats?.[stat as DndStat] ?? 10
                        const mod = modifier(score)
                        return (
                          <div
                            key={stat}
                            className="flex flex-col border border-line/40 bg-black/40 py-2 px-1"
                          >
                            <span className="text-[9.5px] uppercase font-bold text-dim">{stat}</span>
                            <span className="text-[14px] font-bold text-white">{score}</span>
                            <span className="text-[10.5px] text-accent font-mono">{mod}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* FACTION & ALIGNMENT CONFIGURATION */}
                <div className="flex flex-col gap-3 border border-line/40 bg-sidebar/20 p-3.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white">
                    <Flag className="h-3.5 w-3.5 text-cyan" />
                    <span>Faction Allegiance &amp; Diplomatic Stance</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-faint">Assigned Faction</label>
                      <Select
                        value={v.faction ?? ''}
                        options={[
                          { value: '', label: '(No Faction / Independent)' },
                          ...factions.map((f) => ({ value: f.id, label: `${f.name} (${f.defaultStance})` }))
                        ]}
                        onChange={(val) => handleSetFaction(v.sheet, val || null)}
                        className="h-8 text-[11px]"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-faint">Party Stance</label>
                      <div className="flex items-center h-8 border border-line/40 bg-black/40 px-3 text-[11px]">
                        <span className="text-dim">Relationship to Player: </span>
                        <span className={cn('ml-1.5 font-bold uppercase', stanceBadge.cls.split(' ')[0])}>
                          {stance.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CONDITIONS */}
                {v.dnd?.conditions && v.dnd.conditions.length > 0 && (
                  <div className="flex flex-col gap-2 border border-line/40 bg-sidebar/20 p-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-alert">
                      Active Status Conditions
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {v.dnd.conditions.map((c) => (
                        <span
                          key={c}
                          className="border border-alert/40 bg-alert/10 px-2 py-0.5 text-[10.5px] uppercase text-alert font-bold"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()
        )}
      </div>

      {/* ADD CHARACTER / CREATURE BESTIARY MODAL */}
      {showAddModal && (
        <AddWorldCharacterModal
          world={world}
          uses={uses}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {}}
        />
      )}
    </div>
  )
}
