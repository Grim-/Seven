import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { getFactionStance, STANCE_BADGE, type StoredFaction } from '@shared/game/factions'
import { showName } from '@shared/ids'
import { placePath, type PlaceVisitor, type Standing, type WorldMapUse } from '@shared/maps'
import type { WorldMeta } from '@shared/world'
import { npcActorId, type WorldNpc } from '@shared/worldNpcs'
import { Button, EmptyState, SearchBox, Segmented, openMenu, useAddressPane } from '../../ui'
import { Chip, withReferences } from '../../chat/References'
import { useGameCatalog } from '../../game/useGameCatalog'
import { placeName } from '../../maps/placeShapes'
import { usePlaceRecords, useRegionRecords } from '../../maps/usePlaceRecords'
import { openPortableExport } from '../../portability/portabilityStore'
import { cn } from '../../../lib/cn'
import { useCompactLayout } from '../../../lib/form'
import { engine } from '../../../lib/ipc'
import { useLibraryData, useLive } from '../../../lib/useLive'
import { useViewPlace } from '../../../lib/viewPlace'
import { CastDossierPane } from './CastDossierPane'
import { CastMemberCard } from './CastMemberCard'
import { CreateOrBringCastModal, type CastModalTab } from './CreateOrBringCastModal'
import { buildWorldCast, type CastMember } from './castTypes'
import type { CastActionCallbacks } from './castActions'

type CastLens = 'scenes' | 'factions' | 'roles'

const LENS_OPTIONS: { value: CastLens; label: string; hint: string }[] = [
  { value: 'scenes', label: 'Scenes', hint: 'Grouped by Region › Place with live room atmosphere' },
  { value: 'factions', label: 'Allegiances', hint: 'Grouped by world Faction and diplomatic stance' },
  { value: 'roles', label: 'Cast', hint: 'Grouped into Protagonist & Party, World NPCs, Characters, and Archetypes' }
]

const ROLE_BUCKET_DEFS: { key: string; title: string; subtitle: (worldName: string) => string; roles: readonly string[] }[] = [
  {
    key: 'role:party',
    title: 'Player Party',
    subtitle: () => 'Who you play and who travels beside you',
    roles: ['player', 'party']
  },
  {
    key: 'role:world-npcs',
    title: 'Unique World Cast',
    subtitle: (worldName) => `Named individuals living inside ${worldName}`,
    roles: ['world-npc']
  },
  {
    key: 'role:characters',
    title: 'Characters',
    subtitle: () => 'Other full characters you bring into the world as NPCs.',
    roles: ['character']
  },
  {
    key: 'role:stamped',
    title: 'In World',
    subtitle: () => 'NPCs are characters that exist purely in world and not as standalone sheets',
    roles: ['stamped']
  },
  {
    key: 'role:archetypes',
    title: 'World Archetypes',
    subtitle: () => 'Reusable templates with @repo rolls and @stat behaviour',
    roles: ['archetype']
  }
]

const MIN_DOSSIER_W = 360
const MAX_DOSSIER_W = 980
const COMPACT_DOSSIER_W = 540
const EXPANDED_DOSSIER_W = 820

interface ModalRequest {
  tab?: CastModalTab
  place?: string | null
  archetype?: WorldNpc | null
}

export function WorldCastStage({
  world,
  initialNpcKey,
  mode = 'editor',
  onStampOnMap
}: {
  world: WorldMeta
  initialNpcKey?: string
  mode?: 'player' | 'editor'
  onStampOnMap?: (archetype?: WorldNpc | null) => void
}) {
  const isPlayerMode = mode === 'player'
  const compactViewport = useCompactLayout()
  const inAddressPane = useAddressPane()
  const narrow = compactViewport || inAddressPane

  const [lens, setLens] = useViewPlace<CastLens>(`worlds.cast.lens.${world.id}`, 'scenes')
  const [layer, setLayer] = useViewPlace<'play' | 'template'>(`worlds.cast.layer.${world.id}`, 'play')
  const effectiveLayer: 'play' | 'template' = isPlayerMode ? 'play' : layer
  const [showEmptyPlaces, setShowEmptyPlaces] = useViewPlace<boolean>(
    `worlds.cast.emptyPlaces.${world.id}`,
    false
  )
  const [collapsed, setCollapsed] = useViewPlace<string[]>(`worlds.cast.collapsed.${world.id}`, [])
  const [dossierWidth, setDossierWidth] = useViewPlace<number>('worlds.cast.dossierWidth', COMPACT_DOSSIER_W)

  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    initialNpcKey ? npcActorId(world.id, initialNpcKey) : null
  )
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const [modalReq, setModalReq] = useState<ModalRequest | null>(null)
  const dragStartRef = useRef<{ startX: number; startW: number } | null>(null)

  useEffect(() => {
    if (initialNpcKey) setSelectedId(npcActorId(world.id, initialNpcKey))
  }, [world.id, initialNpcKey])

  const uses =
    useLive(() => engine('worlds.maps', { id: world.id }), ['worlds.changed', 'saves.changed'], [world.id]) ?? []
  const places = usePlaceRecords(world.id)
  const regions = useRegionRecords(world.id)
  const save = useLive(() => engine('saves.current', { world: world.id }), 'saves.changed', [world.id]) ?? null
  const factions: StoredFaction[] =
    useLive(
      () => engine('factions.list', { world: world.id, layer: effectiveLayer === 'play' ? 'play' : 'template' }),
      ['factions.changed', 'saves.changed'],
      [world.id, effectiveLayer]
    ) ?? []
  const templateNpcs: WorldNpc[] =
    useLive(() => engine('npcs.list', { world: world.id, layer: 'template' }), 'npcs.changed', [world.id]) ?? []
  const playNpcs: WorldNpc[] =
    useLive(
      () => engine('npcs.list', { world: world.id, layer: 'play' }),
      ['npcs.changed', 'saves.changed'],
      [world.id]
    ) ?? []

  const standingMap = useMemo(() => {
    const map = new Map<string, { mapId: string; use: WorldMapUse; standing: Standing }>()
    for (const u of uses) {
      for (const [actorId, standing] of Object.entries(u.stand)) {
        map.set(actorId, { mapId: u.map, use: u, standing })
      }
    }
    return map
  }, [uses])

  const standaloneIds = useMemo(() => {
    const set = new Set<string>()
    for (const k of standingMap.keys()) if (!k.includes('/npc/')) set.add(k)
    for (const k of Object.keys(save?.characters ?? {})) if (!k.includes('/npc/')) set.add(k)
    if (world.player && !world.player.includes('/npc/')) set.add(world.player)
    return [...set]
  }, [standingMap, save, world.player])

  const visitors: PlaceVisitor[] =
    useLibraryData(
      () =>
        standaloneIds.length
          ? engine('places.visitors', { sheets: standaloneIds })
          : Promise.resolve([] as PlaceVisitor[]),
      `world-cast-sheets.${world.id}.${standaloneIds.join(',')}`
    ) ?? []

  const catalog = useGameCatalog()

  const allCast = useMemo(
    () => {
      const built = buildWorldCast({
        worldId: world.id,
        playerSheet: world.player,
        templateNpcs,
        playNpcs,
        visitors,
        standingMap,
        places,
        save,
        layer: save ? effectiveLayer : 'template',
        catalog
      })
      return isPlayerMode ? built.filter((m) => !m.archetype) : built
    },
    [world.id, world.player, templateNpcs, playNpcs, visitors, standingMap, places, save, effectiveLayer, catalog, isPlayerMode]
  )

  const filteredCast = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allCast
    return allCast.filter((m) => {
      const pName = m.placeKey ? placeName(places, m.placeKey).toLowerCase() : ''
      const rName =
        m.regionKey && regions[m.regionKey] ? String(regions[m.regionKey].Name || m.regionKey).toLowerCase() : ''
      const fName = m.faction ? (factions.find((f) => f.id === m.faction)?.name ?? m.faction).toLowerCase() : ''
      return (
        showName(m.title).toLowerCase().includes(q) ||
        m.actorId.toLowerCase().includes(q) ||
        pName.includes(q) ||
        rName.includes(q) ||
        fName.includes(q) ||
        m.doing.toLowerCase().includes(q) ||
        m.goal.toLowerCase().includes(q) ||
        m.mood.toLowerCase().includes(q) ||
        m.line.toLowerCase().includes(q)
      )
    })
  }, [allCast, query, places, regions, factions])

  const activeMember = useMemo(() => {
    if (selectedId) {
      const hit = allCast.find((m) => m.actorId === selectedId)
      if (hit) return hit
    }
    if (narrow) return null
    return (
      (world.player ? allCast.find((m) => m.actorId === world.player) : null) ??
      allCast.find((m) => !m.archetype) ??
      allCast[0] ??
      null
    )
  }, [allCast, selectedId, world.player, narrow])

  const playerMember = allCast.find((m) => m.actorId === world.player) ?? null
  const playerFactionId = playerMember?.faction || 'player_party'
  const partyIds = useMemo(() => save?.party ?? [], [save?.party])

  const actionsCtx: CastActionCallbacks = useMemo(
    () => ({
      worldId: world.id,
      worldName: world.name,
      saveId: save?.id ?? null,
      partyIds,
      places,
      onSelectActor: setSelectedId,
      onOpenStamp: (m) => {
        const tpl = m.npcId
          ? templateNpcs.find((t) => t.id === m.npcId) ?? playNpcs.find((t) => t.id === m.npcId) ?? null
          : null
        if (onStampOnMap) {
          onStampOnMap(tpl)
          return
        }
        setModalReq({ tab: 'stamp', place: m.placeKey, archetype: tpl })
      }
    }),
    [world.id, world.name, save?.id, partyIds, places, templateNpcs, playNpcs, onStampOnMap]
  )

  const toggleGroup = (groupKey: string) => {
    setCollapsed(
      collapsed.includes(groupKey)
        ? collapsed.filter((k) => k !== groupKey)
        : [...collapsed, groupKey]
    )
  }

  const handleCardClick = (member: CastMember, e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      setPickedIds((prev) =>
        prev.includes(member.actorId) ? prev.filter((x) => x !== member.actorId) : [...prev, member.actorId]
      )
      return
    }
    setPickedIds([])
    setSelectedId(member.actorId)
  }

  const handleEmptyContextMenu = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('[role="button"], button, a, input')) return
    openMenu(e, `${world.name} · Cast`, [
      { label: 'New World NPC or Archetype…', onSelect: () => setModalReq({ tab: 'new-npc' }) },
      { label: 'Stamp from Archetype or Bestiary…', onSelect: () => setModalReq({ tab: 'stamp' }) },
      { label: 'Bring Library Character…', onSelect: () => setModalReq({ tab: 'library' }) }
    ])
  }

  const clampedWidth = Math.max(MIN_DOSSIER_W, Math.min(MAX_DOSSIER_W, dossierWidth || COMPACT_DOSSIER_W))
  const isExpanded = clampedWidth >= EXPANDED_DOSSIER_W - 40

  const handleResizeStart = (e: PointerEvent) => {
    e.preventDefault()
    dragStartRef.current = { startX: e.clientX, startW: clampedWidth }
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!dragStartRef.current) return
      const delta = dragStartRef.current.startX - ev.clientX
      const next = Math.max(MIN_DOSSIER_W, Math.min(MAX_DOSSIER_W, Math.round(dragStartRef.current.startW + delta)))
      setDossierWidth(next)
    }
    const onUp = () => {
      dragStartRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const toggleExpandDossier = () => {
    setDossierWidth(isExpanded ? COMPACT_DOSSIER_W : EXPANDED_DOSSIER_W)
  }

  const sceneSections = useMemo(() => {
    const nonArchetypes = filteredCast.filter((m) => !m.archetype)
    const archetypes = filteredCast.filter((m) => m.archetype)
    const byPlace = new Map<string, CastMember[]>()
    const offStage: CastMember[] = []

    for (const m of nonArchetypes) {
      if (m.placeKey && places[m.placeKey]) {
        byPlace.set(m.placeKey, [...(byPlace.get(m.placeKey) ?? []), m])
      } else {
        offStage.push(m)
      }
    }

    const allPlaceKeys = Object.keys(places)
    const shownPlaceKeys = allPlaceKeys
      .filter((pk) => (byPlace.get(pk)?.length ?? 0) > 0 || (showEmptyPlaces && !query.trim()))
      .sort((a, b) => {
        const diff = (byPlace.get(b)?.length ?? 0) - (byPlace.get(a)?.length ?? 0)
        if (diff !== 0) return diff
        return placeName(places, a).localeCompare(placeName(places, b))
      })

    const hiddenEmptyCount = allPlaceKeys.filter((pk) => (byPlace.get(pk)?.length ?? 0) === 0).length

    const placeGroups = shownPlaceKeys.map((pk) => {
      const entity = places[pk] ?? {}
      const rawRegion = typeof entity.Region === 'string' ? entity.Region : ''
      const regionLabel = rawRegion && regions[rawRegion] ? String(regions[rawRegion].Name || rawRegion) : ''
      const parents = placePath(places, pk)
        .slice(0, -1)
        .map((anc) => placeName(places, anc))
      const trail = [regionLabel, ...parents].filter(Boolean).join(' › ')
      const nowBeat = typeof entity.Now === 'string' ? entity.Now.trim() : ''
      const looksBeat = typeof entity.Looks === 'string' ? entity.Looks.trim() : ''
      return {
        placeKey: pk,
        name: placeName(places, pk),
        trail,
        atmosphere: nowBeat || looksBeat,
        members: byPlace.get(pk) ?? []
      }
    })

    return { placeGroups, offStage, archetypes, hiddenEmptyCount }
  }, [filteredCast, places, regions, showEmptyPlaces, query])

  const factionSections = useMemo(() => {
    const nonArchetypes = filteredCast.filter((m) => !m.archetype)
    const archetypes = filteredCast.filter((m) => m.archetype)
    const groups: {
      key: string
      factionId: string | null
      title: string
      subtitle: string
      stanceBadge: { label: string; cls: string } | null
      members: CastMember[]
    }[] = []

    for (const f of factions) {
      const members = nonArchetypes.filter((m) => m.faction === f.id)
      if (!members.length && query.trim()) continue
      const stance = getFactionStance(factions, playerFactionId, f.id)
      groups.push({
        key: `faction:${f.id}`,
        factionId: f.id,
        title: f.name,
        subtitle: f.description || (f.power !== undefined ? `Power ${f.power}/100` : ''),
        stanceBadge: STANCE_BADGE[stance],
        members
      })
    }

    const unassigned = nonArchetypes.filter((m) => !m.faction || !factions.some((f) => f.id === m.faction))
    if (unassigned.length > 0) {
      groups.push({
        key: 'faction:none',
        factionId: null,
        title: 'Independent & Unaligned',
        subtitle: 'Not sworn to a world faction',
        stanceBadge: null,
        members: unassigned
      })
    }

    return { groups, archetypes }
  }, [filteredCast, factions, playerFactionId, query])

  const roleSections = useMemo(
    () =>
      ROLE_BUCKET_DEFS.map((def) => ({
        key: def.key,
        title: def.title,
        subtitle: def.subtitle(world.name),
        members: filteredCast.filter((m) => def.roles.includes(m.roleKind))
      })).filter((b) => b.members.length > 0),
    [filteredCast, world.name]
  )

  const renderCardGrid = (members: CastMember[]) => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(16.5rem,1fr))] gap-2.5">
      {members.map((m) => (
        <CastMemberCard
          key={m.actorId}
          member={m}
          active={activeMember?.actorId === m.actorId}
          picked={pickedIds.includes(m.actorId)}
          factions={factions}
          playerFactionId={playerFactionId}
          actionsCtx={actionsCtx}
          onClick={(e) => handleCardClick(m, e)}
        />
      ))}
    </div>
  )

  if (narrow && selectedId && activeMember) {
    return (
      <>
        <CastDossierPane
          member={activeMember}
          actionsCtx={actionsCtx}
          almanacId={save?.almanacId ?? null}
          fullWidth
          width={clampedWidth}
          expanded={isExpanded}
          onToggleExpand={toggleExpandDossier}
          onResizeStart={handleResizeStart}
          onBack={() => setSelectedId(null)}
          onClose={() => setSelectedId(null)}
        />
        {modalReq && (
          <CreateOrBringCastModal
            world={world}
            uses={uses}
            initialTab={modalReq.tab}
            initialPlace={modalReq.place ?? null}
            initialArchetype={modalReq.archetype ?? null}
            onClose={() => setModalReq(null)}
            onAdded={(actorId) => setSelectedId(actorId)}
          />
        )}
      </>
    )
  }

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Escape' && pickedIds.length > 0) setPickedIds([])
      }}
      className="flex min-h-0 flex-1 overflow-hidden bg-bg font-ui select-none"
    >
      {/* LEFT / MAIN LIVING SCENES & CAST STAGE */}
      <div
        onContextMenu={handleEmptyContextMenu}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {/* STAGE HEADER BAR */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line/50 tone-panel-50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Segmented value={lens} onChange={setLens} options={LENS_OPTIONS} />

            {!isPlayerMode && save && (
              <Segmented
                value={layer}
                onChange={setLayer}
                options={[
                  { value: 'play', label: save.name, hint: 'Live save positions, stats, and stamped NPCs' },
                  { value: 'template', label: 'Baseline', hint: 'Authored World NPC & Archetype templates' }
                ]}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Filter cast, places, doing…"
              className="w-56"
            />
            {!isPlayerMode && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => (onStampOnMap ? onStampOnMap(null) : setModalReq({ tab: 'stamp' }))}
                  title="Pick an Archetype or Bestiary creature and click on the Atlas map to stamp them directly"
                >
                  Stamp on Map
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Plus />}
                  onClick={() => setModalReq({ tab: 'new-npc' })}
                >
                  Add Cast
                </Button>
              </>
            )}
          </div>
        </div>

        {/* MULTI-SELECT BAR */}
        {pickedIds.length > 1 && (
          <div className="flex items-center justify-between border-b border-secondary/50 tone-well-60 px-4 py-1.5 text-[11.5px]">
            <span className="font-bold text-secondary-ink">{pickedIds.length} cast members selected</span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const items = allCast
                    .filter((m) => pickedIds.includes(m.actorId))
                    .map((m) => ({ kind: m.entry.kind, id: m.entry.id, title: m.title }))
                  openPortableExport({ items })
                }}
              >
                Export Selected…
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPickedIds([])}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* SCROLLABLE STAGE CHAPTERS */}
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          {allCast.length === 0 ? (
            <EmptyState title="No cast in this world yet">
              Author unique World NPCs and reusable Archetypes directly inside {world.name}, stamp guards or creatures into a scene, or bring in a standalone Character sheet.
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setModalReq({ tab: 'new-npc' })}>
                  New World NPC / Archetype
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setModalReq({ tab: 'library' })}>
                  Bring Library Character
                </Button>
              </div>
            </EmptyState>
          ) : filteredCast.length === 0 ? (
            <EmptyState title="No cast members match that filter">
              Try searching another name, place, faction, or scene action.
            </EmptyState>
          ) : lens === 'scenes' ? (
            <>
              {sceneSections.placeGroups.map((pg) => {
                const groupKey = `place:${pg.placeKey}`
                const isClosed = collapsed.includes(groupKey)
                return (
                  <section key={pg.placeKey} className="border border-line/50 tone-surface-40">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 tone-panel-50 px-3 py-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupKey)}
                          className="flex items-center gap-1.5 text-left text-ink hover:text-accent cursor-pointer"
                        >
                          {isClosed ? (
                            <ChevronRight className="h-3.5 w-3.5 text-dim" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-dim" />
                          )}
                          {pg.trail && (
                            <span className="font-label text-[10px] caps-5 text-dim">{pg.trail} ›</span>
                          )}
                          <span className="text-[13.5px] font-bold text-ink">{pg.name}</span>
                        </button>
                        <Chip kind="world" refText={`${world.id}/place/${pg.placeKey}`} />
                        <span className="font-data text-[11px] text-faint">({pg.members.length})</span>
                        {pg.atmosphere && (
                          <span className="hidden truncate font-body text-[11.5px] text-dim xl:inline">
                            — {withReferences(pg.atmosphere)}
                          </span>
                        )}
                      </div>
                      {!isPlayerMode && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Plus />}
                          onClick={() => setModalReq({ tab: 'new-npc', place: pg.placeKey })}
                          className="h-6 px-2 text-[10.5px]"
                          title={`Create or station someone at ${pg.name}`}
                        >
                          Here
                        </Button>
                      )}
                    </div>
                    {!isClosed && (
                      <div className="p-3">
                        {pg.members.length > 0 ? (
                          renderCardGrid(pg.members)
                        ) : (
                          <div className="flex items-center justify-between text-[11.5px] text-faint">
                            <span>Nobody is stationed at {pg.name} right now.</span>
                            {!isPlayerMode && (
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Plus />}
                                onClick={() => setModalReq({ tab: 'new-npc', place: pg.placeKey })}
                              >
                                Add Here
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )
              })}

              {sceneSections.hiddenEmptyCount > 0 && !query.trim() && (
                <div className="flex items-center justify-start">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowEmptyPlaces(!showEmptyPlaces)}
                  >
                    {showEmptyPlaces
                      ? 'Hide unoccupied places'
                      : `Show ${sceneSections.hiddenEmptyCount} unoccupied place${sceneSections.hiddenEmptyCount === 1 ? '' : 's'}`}
                  </Button>
                </div>
              )}

              {sceneSections.offStage.length > 0 && (
                <section className="border border-line/50 tone-surface-30">
                  <div className="flex items-center justify-between border-b border-line/35 tone-panel-40 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleGroup('scene:offstage')}
                      className="flex items-center gap-2 text-left text-ink hover:text-accent cursor-pointer"
                    >
                      {collapsed.includes('scene:offstage') ? (
                        <ChevronRight className="h-3.5 w-3.5 text-dim" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-dim" />
                      )}
                      <span className="text-[12.5px] font-bold caps-5 text-ink">Off-Stage &amp; Unstationed</span>
                      <span className="font-data text-[11px] text-faint">({sceneSections.offStage.length})</span>
                    </button>
                  </div>
                  {!collapsed.includes('scene:offstage') && (
                    <div className="p-3">{renderCardGrid(sceneSections.offStage)}</div>
                  )}
                </section>
              )}

              {!isPlayerMode && (
              <section className="border border-line/50 tone-surface-30">
                <div className="flex items-center justify-between border-b border-line/35 tone-panel-40 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleGroup('scene:archetypes')}
                    className="flex items-center gap-2 text-left text-ink hover:text-accent cursor-pointer"
                  >
                    {collapsed.includes('scene:archetypes') ? (
                      <ChevronRight className="h-3.5 w-3.5 text-dim" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-dim" />
                    )}
                    <span className="text-[12.5px] font-bold caps-5 text-ink">World Archetypes</span>
                    <span className="font-data text-[11px] text-faint">({sceneSections.archetypes.length})</span>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus />}
                    onClick={() => setModalReq({ tab: 'new-npc' })}
                    className="h-6 px-2 text-[10.5px]"
                  >
                    New Archetype
                  </Button>
                </div>
                {!collapsed.includes('scene:archetypes') && (
                  <div className="p-3">
                    {sceneSections.archetypes.length > 0 ? (
                      renderCardGrid(sceneSections.archetypes)
                    ) : (
                      <p className="text-[11.5px] text-faint">
                        No archetypes yet. Create reusable templates using @repo rolls and @stat behaviour.
                      </p>
                    )}
                  </div>
                )}
              </section>
              )}
            </>
          ) : lens === 'factions' ? (
            <>
              {factionSections.groups.map((fg) => {
                const isClosed = collapsed.includes(fg.key)
                return (
                  <section key={fg.key} className="border border-line/50 tone-surface-40">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/35 tone-panel-50 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleGroup(fg.key)}
                          className="flex min-w-0 items-center gap-2 text-left cursor-pointer"
                        >
                          {isClosed ? (
                            <ChevronRight className="h-3.5 w-3.5 text-dim" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-dim" />
                          )}
                          <span className="text-[13.5px] font-bold text-ink">{fg.title}</span>
                        </button>
                        {fg.factionId && <Chip kind="world" refText={`${world.id}/faction/${fg.factionId}`} />}
                        {fg.stanceBadge && (
                          <span className={cn('border px-1.5 py-px text-[9.5px] font-bold caps', fg.stanceBadge.cls)}>
                            {fg.stanceBadge.label}
                          </span>
                        )}
                        <span className="font-data text-[11px] text-faint">({fg.members.length})</span>
                        {fg.subtitle && (
                          <span className="hidden truncate text-[11px] text-dim lg:inline">
                            — {withReferences(fg.subtitle)}
                          </span>
                        )}
                      </div>
                    </div>
                    {!isClosed && (
                      <div className="p-3">
                        {fg.members.length > 0 ? (
                          renderCardGrid(fg.members)
                        ) : (
                          <span className="text-[11.5px] text-faint">No active cast members assigned to {fg.title}.</span>
                        )}
                      </div>
                    )}
                  </section>
                )
              })}
              {factionSections.archetypes.length > 0 && (
                <section className="border border-line/50 tone-surface-30">
                  <div className="border-b border-line/35 tone-panel-40 px-3 py-2 text-[12.5px] font-bold caps-5 text-ink">
                    World Archetypes ({factionSections.archetypes.length})
                  </div>
                  <div className="p-3">{renderCardGrid(factionSections.archetypes)}</div>
                </section>
              )}
            </>
          ) : (
            roleSections.map((rs) => {
              const isClosed = collapsed.includes(rs.key)
              return (
                <section key={rs.key} className="border border-line/50 tone-surface-40">
                  <div className="flex items-center justify-between border-b border-line/35 tone-panel-50 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleGroup(rs.key)}
                      className="flex items-center gap-2 text-left cursor-pointer"
                    >
                      {isClosed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-dim" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-dim" />
                      )}
                      <span className="text-[13px] font-bold text-ink">{rs.title}</span>
                      <span className="font-data text-[11px] text-faint">({rs.members.length})</span>
                      <span className="hidden text-[11px] text-dim md:inline">— {rs.subtitle}</span>
                    </button>
                  </div>
                  {!isClosed && <div className="p-3">{renderCardGrid(rs.members)}</div>}
                </section>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT RESIZABLE DOSSIER DRAWER */}
      {activeMember && (
        <CastDossierPane
          member={activeMember}
          actionsCtx={actionsCtx}
          almanacId={save?.almanacId ?? null}
          width={clampedWidth}
          expanded={isExpanded}
          onToggleExpand={toggleExpandDossier}
          onResizeStart={handleResizeStart}
          onClose={() => setSelectedId(null)}
        />
      )}

      {modalReq && (
        <CreateOrBringCastModal
          world={world}
          uses={uses}
          initialTab={modalReq.tab}
          initialPlace={modalReq.place ?? null}
          initialArchetype={modalReq.archetype ?? null}
          onClose={() => setModalReq(null)}
          onAdded={(actorId) => setSelectedId(actorId)}
        />
      )}
    </div>
  )
}
