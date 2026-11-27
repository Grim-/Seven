import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { ArrowRightLeft, Maximize2, Minimize2, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import {
  blankStoredFaction,
  getFactionStance,
  STANCE_BADGE,
  type FactionStance,
  type StoredFaction
} from '@shared/game/factions'
import { npcActorId, type WorldNpc } from '@shared/worldNpcs'
import { cn } from '../../lib/cn'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
import { useViewPlace } from '../../lib/viewPlace'
import { toast } from '../../store/toasts'
import { entryMenuAt } from '../../views/data/entryMenu'
import { CharacterAvatar } from '../chat/CharacterAvatar'
import { Chip, withReferences } from '../chat/References'
import { CopyLinkButton } from '../data/CopyLinkButton'
import { factionMonogram, WorldDiplomacyMatrix } from '../factions/FactionMatrix'
import { StoredFactionEditor } from '../factions/StoredFactionEditor'
import { openBringFromWorld, openCopyToWorld } from './CopyToWorldModal'
import { useWorlds } from './useWorlds'
import { Button, EmptyState, Eyebrow, Modal, SearchBox, confirmDelete } from '../ui'

const MIN_DRAWER = 340
const MAX_DRAWER = 880
const COMPACT_DRAWER = 440
const EXPANDED_DRAWER = 700

export function WorldFactions({
  world,
  mode = 'editor'
}: {
  world: WorldMeta
  mode?: 'player' | 'editor'
}) {
  const isPlayerMode = mode === 'player'
  const layer = isPlayerMode ? 'play' : 'template'
  const allWorlds = useWorlds()

  const factions =
    useLive(
      () => engine('factions.list', { world: world.id, layer }),
      ['factions.changed', 'saves.changed'],
      [world.id, layer]
    ) ?? []
  const worldNpcs: WorldNpc[] =
    useLive(
      () => engine('npcs.list', { world: world.id, layer }),
      ['npcs.changed', 'saves.changed'],
      [world.id, layer]
    ) ?? []

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showMatrix, setShowMatrix] = useViewPlace<boolean>(`worlds.factions.matrix.${world.id}`, true)
  const [drawerWidth, setDrawerWidth] = useViewPlace<number>('worlds.factions.drawerWidth', COMPACT_DRAWER)
  const [editingFaction, setEditingFaction] = useState<StoredFaction | null>(null)
  const [editingOriginalId, setEditingOriginalId] = useState<string | null>(null)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return factions
    return factions.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.doctrine ?? '').toLowerCase().includes(q) ||
        (f.temperament ?? []).some((t) => t.toLowerCase().includes(q)) ||
        f.tags.some((t) => t.toLowerCase().includes(q))
    )
  }, [factions, query])

  const activeFaction = useMemo(
    () => (selectedId ? factions.find((f) => f.id === selectedId) ?? null : null),
    [factions, selectedId]
  )

  const npcCountsByFaction = useMemo(() => {
    const map = new Map<string, WorldNpc[]>()
    for (const n of worldNpcs) {
      if (n.archetype || !n.faction) continue
      map.set(n.faction, [...(map.get(n.faction) ?? []), n])
    }
    return map
  }, [worldNpcs])

  const playerFactionId = 'player_party'

  const handleSaveFaction = async (saved: StoredFaction) => {
    await engine('factions.save', {
      faction: saved,
      world: world.id,
      previousId: editingOriginalId
    })
    toast.success('Faction Saved', saved.name)
    setEditingFaction(null)
    setEditingOriginalId(null)
  }

  const handleSeedStarters = () =>
    void engine('factions.seedStarters', { world: world.id })
      .then(() => toast.success('Starter Factions Added', world.name))
      .catch(failed('Could not add starter factions'))

  const handleDeleteFaction = (f: StoredFaction) =>
    confirmDelete(`Delete ${f.name}?`, `Removes ${f.name} from ${world.name}.`, async () => {
      await engine('factions.delete', { id: f.id, world: world.id })
      if (selectedId === f.id) setSelectedId(null)
    })

  const handleMatrixRelation = (from: StoredFaction, targetId: string, stance: FactionStance | null, note: string) => {
    const nextRelations = { ...from.relations }
    if (stance === null || stance === from.defaultStance) delete nextRelations[targetId]
    else nextRelations[targetId] = stance
    const nextNotes = { ...(from.relationNotes ?? {}) }
    if (note.trim()) nextNotes[targetId] = note
    else delete nextNotes[targetId]
    void engine('factions.save', {
      faction: { ...from, relations: nextRelations, relationNotes: nextNotes },
      world: world.id,
      previousId: from.id
    }).catch(failed('Could not update relation'))
  }

  const clampedWidth = Math.max(MIN_DRAWER, Math.min(MAX_DRAWER, drawerWidth || COMPACT_DRAWER))
  const isExpanded = clampedWidth >= EXPANDED_DRAWER - 40
  const startResize = (e: PointerEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: clampedWidth }
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!dragRef.current) return
      const next = Math.max(MIN_DRAWER, Math.min(MAX_DRAWER, Math.round(dragRef.current.startW + (dragRef.current.startX - ev.clientX))))
      setDrawerWidth(next)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-bg font-ui select-none">
      {/* MAIN LEFT/CENTER WORKSPACE */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* TOP BAR */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line/50 tone-panel-50 px-5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="type-title text-ink">
              {isPlayerMode ? 'Factions & Standing' : 'World Factions'}
            </span>
            <span className="font-data text-[11px] text-faint">({factions.length})</span>
            {factions.length >= 2 && (
              <Button
                size="sm"
                variant={showMatrix ? 'secondary' : 'ghost'}
                onClick={() => setShowMatrix(!showMatrix)}
              >
                {showMatrix ? 'Hide Matrix' : 'Show Matrix'}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchBox value={query} onChange={setQuery} placeholder="Filter factions, traits…" className="w-52" />
            {!isPlayerMode && (
              <>
                {allWorlds.length > 1 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ArrowRightLeft />}
                    onClick={() => openBringFromWorld({ targetWorld: world.id, initialCategory: 'faction' })}
                    title="Copy factions from another world"
                  >
                    From world…
                  </Button>
                )}
                {factions.length === 0 && (
                  <Button size="sm" variant="secondary" onClick={handleSeedStarters}>
                    Add Starter Set
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus />}
                  onClick={() => {
                    setEditingOriginalId(null)
                    setEditingFaction({
                      ...blankStoredFaction(world.id),
                      tags: [world.name.toLowerCase().replace(/\s+/g, '_')]
                    })
                  }}
                >
                  New Faction
                </Button>
              </>
            )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          {factions.length === 0 ? (
            <EmptyState title="No factions in this world">
              Factions define allegiances, leaders, power, and diplomacy across {world.name}.
              {!isPlayerMode && (
                <div className="mt-3 flex justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={handleSeedStarters}>
                    Add Starter Set
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Plus />}
                    onClick={() => {
                      setEditingOriginalId(null)
                      setEditingFaction({ ...blankStoredFaction(world.id) })
                    }}
                  >
                    New Faction
                  </Button>
                </div>
              )}
            </EmptyState>
          ) : (
            <>
              {showMatrix && factions.length >= 2 && (
                <WorldDiplomacyMatrix
                  factions={factions}
                  readOnly={isPlayerMode}
                  selectedId={activeFaction?.id ?? null}
                  onSelectFaction={setSelectedId}
                  onChangeRelation={isPlayerMode ? undefined : handleMatrixRelation}
                />
              )}

              {/* VISUAL INTERACTIVE FACTION CARDS GRID */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((f) => {
                  const isSelected = activeFaction?.id === f.id
                  const stance = isPlayerMode
                    ? getFactionStance(factions, playerFactionId, f.id)
                    : f.defaultStance
                  const badge = STANCE_BADGE[stance]
                  const power = typeof f.power === 'number' ? Math.max(0, Math.min(100, f.power)) : null
                  const npcMembers = npcCountsByFaction.get(f.id) ?? []
                  const totalMembers = npcMembers.length + (f.members?.length ?? 0)
                  const allies = factions.filter(
                    (o) => o.id !== f.id && ['allied', 'friendly'].includes(f.relations[o.id] ?? f.defaultStance)
                  ).length
                  const rivals = factions.filter(
                    (o) => o.id !== f.id && ['unfriendly', 'hostile'].includes(f.relations[o.id] ?? f.defaultStance)
                  ).length

                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedId(f.id)}
                      onContextMenu={(e) =>
                        entryMenuAt(
                          e,
                          'world',
                          `${world.id}/faction/${f.id}`,
                          f.name,
                          isPlayerMode
                            ? []
                            : [
                                {
                                  label: 'Edit Faction',
                                  icon: <Pencil />,
                                  onSelect: () => {
                                    setEditingOriginalId(f.id)
                                    setEditingFaction(f)
                                  }
                                },
                                {
                                  label: 'Delete Faction',
                                  icon: <Trash2 />,
                                  danger: true,
                                  onSelect: () => handleDeleteFaction(f)
                                }
                              ]
                        )
                      }
                      className={cn(
                        'group flex cursor-pointer flex-col justify-between gap-3 border p-4 transition-colors',
                        isSelected
                          ? 'border-accent bg-accent/[0.06]'
                          : 'border-line/60 tone-panel-50 hover:border-line'
                      )}
                    >
                      <div className="flex flex-col gap-2.5">
                        {/* HEADER: MONOGRAM + TITLE + STANCE */}
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'flex h-11 w-11 shrink-0 items-center justify-center border font-data text-[13px] font-bold',
                              badge.cls
                            )}
                          >
                            {factionMonogram(f.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[15px] font-bold text-ink">{f.name}</span>
                              <span className={cn('shrink-0 border px-1.5 py-px text-[9px] font-bold caps', badge.cls)}>
                                {badge.label}
                              </span>
                            </div>

                            {power !== null && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="font-label text-[9.5px] caps-5 text-faint">Power</span>
                                <div className="h-1.5 flex-1 overflow-hidden border border-line/50 tone-well-80">
                                  <div style={{ width: `${power}%` }} className="h-full bg-accent" />
                                </div>
                                <span className="font-data text-[10.5px] font-bold text-ink">{power}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* TEMPERAMENTS */}
                        {f.temperament && f.temperament.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {f.temperament.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="border border-line/45 tone-well-50 px-1.5 py-px font-label text-[9.5px] caps text-dim"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* DESCRIPTION / DOCTRINE */}
                        {(f.doctrine || f.description) && (
                          <p className="line-clamp-2 font-body text-[12px] leading-relaxed text-dim">
                            {withReferences(f.doctrine || f.description)}
                          </p>
                        )}
                      </div>

                      {/* FOOTER: LEADER + MEMBERS + DIPLOMACY COUNTS */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/35 pt-2.5 text-[11px] text-dim">
                        <div className="flex items-center gap-2">
                          {f.leaderSheet && (
                            <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <CharacterAvatar sheetId={f.leaderSheet} size={20} />
                              <Chip kind="sheet" refText={f.leaderSheet} />
                            </span>
                          )}
                          {!f.leaderSheet && totalMembers > 0 && (
                            <span className="font-data text-[10.5px] text-faint">
                              {totalMembers} member{totalMembers === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-data text-[10px]">
                          {allies > 0 && <span className="text-ok">{allies} allied</span>}
                          {rivals > 0 && <span className="text-alert">{rivals} hostile</span>}
                          {!isPlayerMode && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingOriginalId(f.id)
                                setEditingFaction(f)
                              }}
                              className="ml-1 text-dim hover:text-accent cursor-pointer"
                              title="Edit Faction"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* RIGHT INTERACTIVE FACTION DOSSIER DRAWER */}
      {activeFaction && (
        <aside
          style={{ width: clampedWidth }}
          className="relative flex min-h-0 shrink-0 flex-col border-l border-line/60 tone-surface-70"
        >
          <div
            onPointerDown={startResize}
            onDoubleClick={() => setDrawerWidth(isExpanded ? COMPACT_DRAWER : EXPANDED_DRAWER)}
            title="Drag to resize · Double-click to toggle width"
            className="absolute bottom-0 left-0 top-0 z-10 w-1.5 -translate-x-1/2 cursor-ew-resize hover:bg-accent/50"
          />

          {/* DRAWER HEADER */}
          <div className="flex items-center justify-between gap-2 border-b border-line/50 tone-panel-60 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center border font-data text-[12px] font-bold',
                  STANCE_BADGE[activeFaction.defaultStance].cls
                )}
              >
                {factionMonogram(activeFaction.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold text-ink">{activeFaction.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <CopyLinkButton kind="world" id={`${world.id}/faction/${activeFaction.id}`} />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {!isPlayerMode && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Pencil />}
                    onClick={() => {
                      setEditingOriginalId(activeFaction.id)
                      setEditingFaction(activeFaction)
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<ArrowRightLeft />}
                    title={`Copy ${activeFaction.name} to another world`}
                    onClick={() =>
                      openCopyToWorld({
                        entries: [{ ref: `${world.id}/faction/${activeFaction.id}`, title: activeFaction.name }],
                        sourceWorld: world.id
                      })
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="text-alert" />}
                    title={`Delete ${activeFaction.name}`}
                    onClick={() => handleDeleteFaction(activeFaction)}
                  />
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={isExpanded ? <Minimize2 /> : <Maximize2 />}
                onClick={() => setDrawerWidth(isExpanded ? COMPACT_DRAWER : EXPANDED_DRAWER)}
                title={isExpanded ? 'Compact width' : 'Expand width'}
              />
              <Button size="sm" variant="ghost" icon={<X />} onClick={() => setSelectedId(null)} title="Close dossier" />
            </div>
          </div>

          {/* DRAWER BODY */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* STATS / LEADER / HQ */}
            <div className="grid grid-cols-2 gap-3 border border-line/40 tone-well-40 p-3">
              <div className="flex flex-col gap-1">
                <span className="font-label text-[9.5px] caps-5 text-faint">Default Posture</span>
                <span
                  className={cn(
                    'w-fit border px-2 py-0.5 text-[10px] font-bold caps',
                    STANCE_BADGE[activeFaction.defaultStance].cls
                  )}
                >
                  {activeFaction.defaultStance}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-label text-[9.5px] caps-5 text-faint">Power</span>
                <span className="font-data text-[13px] font-bold text-ink">
                  {activeFaction.power !== undefined ? `${activeFaction.power} / 100` : 'Unrated'}
                </span>
              </div>

              {activeFaction.leaderSheet && (
                <div className="flex flex-col gap-1">
                  <span className="font-label text-[9.5px] caps-5 text-faint">Leader</span>
                  <div className="flex items-center gap-1.5">
                    <CharacterAvatar sheetId={activeFaction.leaderSheet} size={22} />
                    <Chip kind="sheet" refText={activeFaction.leaderSheet} />
                  </div>
                </div>
              )}

              {activeFaction.headquartersPlace && (
                <div className="flex flex-col gap-1">
                  <span className="font-label text-[9.5px] caps-5 text-faint">Headquarters</span>
                  <Chip
                    kind="world"
                    refText={
                      activeFaction.headquartersPlace.includes('/')
                        ? activeFaction.headquartersPlace
                        : `${world.id}/place/${activeFaction.headquartersPlace}`
                    }
                  />
                </div>
              )}
            </div>

            {activeFaction.description && (
              <div className="flex flex-col gap-1">
                <Eyebrow>Overview</Eyebrow>
                <p className="font-body text-[13px] leading-relaxed text-ink/90">
                  {withReferences(activeFaction.description)}
                </p>
              </div>
            )}

            {activeFaction.doctrine && (
              <div className="flex flex-col gap-1 border-l-2 border-accent/50 pl-3">
                <Eyebrow>Doctrine</Eyebrow>
                <p className="font-body text-[12.5px] leading-relaxed text-dim">
                  {withReferences(activeFaction.doctrine)}
                </p>
              </div>
            )}

            {/* MEMBERS */}
            {((activeFaction.members?.length ?? 0) > 0 || (npcCountsByFaction.get(activeFaction.id)?.length ?? 0) > 0) && (
              <div className="flex flex-col gap-1.5">
                <Eyebrow>Known Members</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {(activeFaction.members ?? []).map((sheetId) => (
                    <Chip key={sheetId} kind="sheet" refText={sheetId} />
                  ))}
                  {(npcCountsByFaction.get(activeFaction.id) ?? []).map((npc) => (
                    <Chip key={npc.id} kind="world" refText={npcActorId(world.id, npc.id)} />
                  ))}
                </div>
              </div>
            )}

            {/* DIPLOMATIC TIES */}
            {factions.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Eyebrow>Diplomatic Relations</Eyebrow>
                <div className="flex flex-col divide-y divide-line/30 border border-line/40 tone-well-30">
                  {factions
                    .filter((other) => other.id !== activeFaction.id)
                    .map((other) => {
                      const stance = activeFaction.relations[other.id] ?? activeFaction.defaultStance
                      const note = activeFaction.relationNotes?.[other.id] ?? ''
                      const cfg = STANCE_BADGE[stance]
                      return (
                        <button
                          key={other.id}
                          type="button"
                          onClick={() => setSelectedId(other.id)}
                          className="flex flex-col gap-1 px-3 py-2 text-left transition-colors hover:tone-card-40 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12.5px] font-semibold text-ink">{other.name}</span>
                            <span className={cn('shrink-0 border px-1.5 py-px text-[9px] font-bold caps', cfg.cls)}>
                              {cfg.label}
                            </span>
                          </div>
                          {note && <span className="font-body text-[11.5px] text-dim">{note}</span>}
                        </button>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* EDITOR MODAL */}
      {!isPlayerMode && editingFaction && (
        <Modal
          open={true}
          title={editingOriginalId ? `Edit Faction · ${editingFaction.name}` : 'New Faction'}
          onClose={() => {
            setEditingFaction(null)
            setEditingOriginalId(null)
          }}
          wide={true}
        >
          <div className="flex flex-col gap-4 p-4">
            <StoredFactionEditor worldId={world.id} value={editingFaction} onChange={setEditingFaction} />
            <div className="flex justify-end gap-2 border-t border-line/40 pt-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingFaction(null)
                  setEditingOriginalId(null)
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!editingFaction.name.trim()}
                onClick={() => void handleSaveFaction(editingFaction)}
              >
                Save Faction
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
