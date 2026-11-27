import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { MessageSquare, Plus, UserCheck, UserMinus, UserPlus } from 'lucide-react'
import { getFactionStance, STANCE_BADGE, type StoredFaction } from '@shared/game/factions'
import { showName } from '@shared/ids'
import type { PlaceVisitor, Standing, WorldMapUse } from '@shared/maps'
import type { WorldMeta } from '@shared/world'
import { actorLink, type WorldNpc } from '@shared/worldNpcs'
import { Button, EmptyState, Eyebrow, Popover, openMenu } from '../ui'
import { Chip, withReferences } from '../chat/References'
import { SheetPortrait } from '../data/SheetPortrait'
import { useGameCatalog } from '../game/useGameCatalog'
import { EntryPicker } from '../library/EntryPicker'
import { placeName } from '../maps/placeShapes'
import { usePlaceRecords, useRegionRecords } from '../maps/usePlaceRecords'
import { cn } from '../../lib/cn'
import { useConversation } from '../../lib/conversation'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLibraryData, useLive } from '../../lib/useLive'
import { useViewPlace } from '../../lib/viewPlace'
import { useAgents } from '../../store/agents'
import { useApp } from '../../store/app'
import { toast } from '../../store/toasts'
import { entryMenuAt } from '../../views/data/entryMenu'
import { WorldPlacePick } from './WorldPlacePick'
import { CastDossierPane } from './cast/CastDossierPane'
import { buildWorldCast, type CastMember } from './cast/castTypes'
import { castMemberExtraMenuItems, type CastActionCallbacks } from './cast/castActions'

const MIN_W = 360
const MAX_W = 960
const COMPACT_W = 540
const EXPANDED_W = 820

export function WorldPartyScreen({ world }: { world: WorldMeta }) {
  const conv = useConversation()
  const setView = useApp((s) => s.setView)
  const agents = useAgents((s) => s.list)
  const catalog = useGameCatalog()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [travelPlace, setTravelPlace] = useState<string | null>(null)
  const [dossierWidth, setDossierWidth] = useViewPlace<number>('worlds.party.dossierWidth', COMPACT_W)
  const dragStartRef = useRef<{ startX: number; startW: number } | null>(null)

  const uses =
    useLive(() => engine('worlds.maps', { id: world.id }), ['worlds.changed', 'saves.changed'], [world.id]) ?? []
  const places = usePlaceRecords(world.id)
  const regions = useRegionRecords(world.id)
  const save = useLive(() => engine('saves.current', { world: world.id }), 'saves.changed', [world.id]) ?? null
  const factions: StoredFaction[] =
    useLive(
      () => engine('factions.list', { world: world.id, layer: 'play' }),
      ['factions.changed', 'saves.changed'],
      [world.id]
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
    for (const k of save?.party ?? []) if (!k.includes('/npc/')) set.add(k)
    if (world.player && !world.player.includes('/npc/')) set.add(world.player)
    return [...set]
  }, [standingMap, save, world.player])

  const visitors: PlaceVisitor[] =
    useLibraryData(
      () =>
        standaloneIds.length
          ? engine('places.visitors', { sheets: standaloneIds })
          : Promise.resolve([] as PlaceVisitor[]),
      `world-party-sheets.${world.id}.${standaloneIds.join(',')}`
    ) ?? []

  const allCast = useMemo(
    () =>
      buildWorldCast({
        worldId: world.id,
        playerSheet: world.player,
        templateNpcs,
        playNpcs,
        visitors,
        standingMap,
        places,
        save,
        layer: 'play',
        catalog
      }),
    [world.id, world.player, templateNpcs, playNpcs, visitors, standingMap, places, save, catalog]
  )

  // Party is strictly the user's explicit save.party (+ active protagonist if set)
  const explicitPartyIds = useMemo(() => {
    const ids = new Set<string>(save?.party ?? [])
    if (world.player) ids.add(world.player)
    return [...ids]
  }, [save?.party, world.player])

  const partyMembers = useMemo(
    () =>
      allCast
        .filter((m) => !m.archetype && explicitPartyIds.includes(m.actorId))
        .sort((a, b) => {
          if (a.actorId === world.player) return -1
          if (b.actorId === world.player) return 1
          return a.title.localeCompare(b.title)
        }),
    [allCast, explicitPartyIds, world.player]
  )

  const leaderMember = partyMembers.find((m) => m.actorId === world.player) ?? partyMembers[0] ?? null
  const currentPlaceKey = leaderMember?.placeKey ?? null
  const currentMapId = leaderMember?.mapId ?? uses[0]?.map ?? null
  const playerFactionId = leaderMember?.faction || 'player_party'

  // Diegetic recruitment pool: people physically present at the party's current place who aren't in the party yet
  const localsHere = useMemo(() => {
    if (!currentPlaceKey) return []
    return allCast.filter(
      (m) =>
        !m.archetype &&
        m.placeKey === currentPlaceKey &&
        !explicitPartyIds.includes(m.actorId)
    )
  }, [allCast, currentPlaceKey, explicitPartyIds])

  const activeMember = useMemo(
    () => (selectedId ? allCast.find((m) => m.actorId === selectedId) ?? null : null),
    [allCast, selectedId]
  )

  const actionsCtx: CastActionCallbacks = useMemo(
    () => ({
      worldId: world.id,
      worldName: world.name,
      saveId: save?.id ?? null,
      partyIds: save?.party ?? [],
      places,
      onSelectActor: setSelectedId
    }),
    [world.id, world.name, save?.id, save?.party, places]
  )

  const ensureSave = async () => {
    if (save) return save
    return engine('saves.create', { world: world.id, name: 'Save 1', copy: false })
  }

  const inviteToParty = async (actorId: string, label: string, place?: string | null, map?: string | null) => {
    try {
      const targetSave = await ensureSave()
      await engine('saves.addPartyMember', {
        id: targetSave.id,
        sheet: actorId,
        place: place ?? currentPlaceKey ?? world.launch?.startingPlace ?? null,
        map: map ?? currentMapId ?? uses[0]?.map ?? null
      })
      toast.success('Joined Party', `${showName(label)} joined your party.`)
    } catch (err) {
      failed('Could not add member to party')(err)
    }
  }

  const dismissFromParty = async (member: CastMember) => {
    if (!save) return
    try {
      await engine('saves.removePartyMember', { id: save.id, sheet: member.actorId })
      if (world.player === member.actorId) {
        const nextLead = partyMembers.find((m) => m.actorId !== member.actorId) ?? null
        await engine('worlds.setPlayer', { id: world.id, sheet: nextLead?.actorId ?? null })
      }
      toast.info('Dismissed from Party', `${showName(member.title)} remains at their current location.`)
    } catch (err) {
      failed('Could not dismiss party member')(err)
    }
  }

  const setProtagonist = async (member: CastMember) => {
    try {
      await engine('worlds.setPlayer', { id: world.id, sheet: member.actorId })
      if (save && !(save.party ?? []).includes(member.actorId)) {
        await engine('saves.addPartyMember', { id: save.id, sheet: member.actorId, place: member.placeKey, map: member.mapId })
      }
      toast.success('Active Character', `Now playing as ${showName(member.title)}.`)
    } catch (err) {
      failed('Could not switch protagonist')(err)
    }
  }

  const movePartyTogether = async (placeKey: string | null) => {
    setTravelPlace(placeKey)
    if (!placeKey) return
    try {
      const targetSave = await ensureSave()
      const mapForPlace =
        uses.find((u) => Boolean(u.spawns?.[placeKey] || u.shapes[placeKey]))?.map ?? uses[0]?.map ?? null
      if (!mapForPlace) {
        toast.info('No Map Linked', 'Attach a map in Atlas before moving your party.')
        return
      }
      await engine('saves.travelParty', { id: targetSave.id, map: mapForPlace, place: placeKey })
      toast.success('Party Traveled', `Moved to ${placeName(places, placeKey)}.`)
      setTravelPlace(null)
    } catch (err) {
      failed('Could not move party')(err)
    }
  }

  const startConversationWith = (members: CastMember[], title?: string) => {
    const defaultAgentId = agents[0]?.id ?? 'default'
    const where = currentPlaceKey ? `@world:${world.id}/place/${currentPlaceKey}` : ''
    const charLinks = members.map((m) => actorLink(m.actorId))
    void engine('sessions.create', { agentId: defaultAgentId })
      .then(async (created) => {
        if (title) await engine('sessions.rename', { id: created.id, title })
        return engine('sessions.setScene', {
          id: created.id,
          scene: {
            almanacId: save?.almanacId ?? '',
            worldId: world.id,
            saveId: save?.id ?? null,
            mapId: currentMapId,
            placeKey: currentPlaceKey,
            playerSheet: world.player,
            where,
            characters: charLinks,
            worldTime: save?.clock.time ?? world.launch?.startingTime ?? 8 * 3600
          }
        })
      })
      .then((updated) => {
        conv.go(updated.id)
        setView('chat')
      })
      .catch(failed('Could not start scene chat'))
  }

  const clampedWidth = Math.max(MIN_W, Math.min(MAX_W, dossierWidth || COMPACT_W))
  const isExpanded = clampedWidth >= EXPANDED_W - 40
  const handleResizeStart = (e: PointerEvent) => {
    e.preventDefault()
    dragStartRef.current = { startX: e.clientX, startW: clampedWidth }
    const onMove = (ev: globalThis.PointerEvent) => {
      if (!dragStartRef.current) return
      const delta = dragStartRef.current.startX - ev.clientX
      setDossierWidth(Math.max(MIN_W, Math.min(MAX_W, Math.round(dragStartRef.current.startW + delta))))
    }
    const onUp = () => {
      dragStartRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const placeInfo = currentPlaceKey ? places[currentPlaceKey] : null
  const regionKey = placeInfo && typeof placeInfo.Region === 'string' ? placeInfo.Region : ''
  const regionName = regionKey && regions[regionKey] ? String(regions[regionKey].Name || regionKey) : ''
  const placeNow = placeInfo && typeof placeInfo.Now === 'string' ? placeInfo.Now.trim() : ''

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-bg font-ui select-none">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* TOP PARTY CAMP / COMMAND BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/50 tone-panel-50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="type-title text-ink">Active Party</span>
                <span className="border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-data text-[10.5px] font-bold text-accent">
                  {partyMembers.length} {partyMembers.length === 1 ? 'Member' : 'Members'}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-dim">
                {currentPlaceKey ? (
                  <>
                    <span>Currently at</span>
                    {regionName && <span className="text-faint">{regionName} ›</span>}
                    <Chip kind="world" refText={`${world.id}/place/${currentPlaceKey}`} />
                  </>
                ) : (
                  <span>Choose a destination to place your party in {world.name}.</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(places).length > 0 && partyMembers.length > 0 && (
              <div className="w-52">
                <WorldPlacePick
                  world={world.id}
                  value={travelPlace}
                  onChange={(p) => void movePartyTogether(p)}
                  placeholder="Move party to…"
                />
              </div>
            )}

            {partyMembers.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<MessageSquare />}
                onClick={() =>
                  startConversationWith(
                    partyMembers,
                    currentPlaceKey ? `Camp · ${placeName(places, currentPlaceKey)}` : `${world.name} Party`
                  )
                }
              >
                Camp / Talk
              </Button>
            )}

            <Popover
              title="Add a character from your library into this world and party"
              trigger={
                <Button size="sm" variant="primary" icon={<Plus />}>
                  Add Character
                </Button>
              }
            >
              {(close) => (
                <EntryPicker
                  kind="sheet"
                  title="Bring character into party"
                  inline
                  onClose={close}
                  onPick={(hit) => {
                    void inviteToParty(hit.id, hit.title)
                    close()
                  }}
                />
              )}
            </Popover>
          </div>
        </div>

        {/* MAIN SCROLLABLE PARTY & DIEGETIC RECRUITMENT AREA */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
          {/* PARTY ROSTER */}
          {partyMembers.length === 0 ? (
            <EmptyState title="Your party is empty">
              Add one of your Characters to begin, or recruit companions standing in the world. Friendly faction NPCs do not join automatically — you decide who travels with you.
              <div className="mt-3 flex justify-center">
                <Popover
                  title="Add a character from your library"
                  trigger={
                    <Button size="sm" variant="primary" icon={<Plus />}>
                      Add Character to Party
                    </Button>
                  }
                >
                  {(close) => (
                    <EntryPicker
                      kind="sheet"
                      title="Pick character sheet"
                      inline
                      onClose={close}
                      onPick={(hit) => {
                        void inviteToParty(hit.id, hit.title)
                        close()
                      }}
                    />
                  )}
                </Popover>
              </div>
            </EmptyState>
          ) : (
            <section className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {partyMembers.map((m) => {
                  const isLead = m.actorId === world.player
                  const isSelected = activeMember?.actorId === m.actorId
                  const hpPct =
                    m.hp && m.hp.max > 0 ? Math.max(0, Math.min(100, Math.round((m.hp.cur / m.hp.max) * 100))) : null
                  const fac = m.faction ? factions.find((f) => f.id === m.faction) : null

                  return (
                    <div
                      key={m.actorId}
                      onClick={() => setSelectedId(m.actorId)}
                      onContextMenu={(e) =>
                        entryMenuAt(e, m.entry.kind, m.entry.id, m.title, castMemberExtraMenuItems(m, actionsCtx))
                      }
                      className={cn(
                        'group flex cursor-pointer flex-col justify-between gap-3 border p-4 transition-colors',
                        isSelected
                          ? 'border-accent bg-accent/[0.06]'
                          : isLead
                            ? 'border-accent/60 tone-panel-70 hover:border-accent'
                            : 'border-line/60 tone-panel-50 hover:border-line'
                      )}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="relative shrink-0">
                          <SheetPortrait
                            image={m.image}
                            className={cn(
                              'h-16 w-16 border',
                              isLead ? 'border-accent' : 'border-line/60'
                            )}
                          />
                          {isLead && (
                            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap border border-accent bg-bg px-1.5 py-px font-label text-[8.5px] font-bold caps-8 text-accent">
                              Playing
                            </span>
                          )}
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[15px] font-bold text-ink">{showName(m.title)}</span>
                            <span className="shrink-0 font-label text-[9.5px] caps-5 text-faint">
                              {m.isWorldNpc ? 'Companion' : 'Personal'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-dim">
                            {fac && <span>{fac.name}</span>}
                            {m.placeKey && (
                              <Chip kind="world" refText={`${world.id}/place/${m.placeKey}`} />
                            )}
                          </div>

                          {m.hp && m.hp.max > 0 && hpPct !== null && (
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden border border-line/50 tone-well-80">
                                <div
                                  style={{ width: `${hpPct}%` }}
                                  className={cn(
                                    'h-full transition-all',
                                    hpPct <= 25 ? 'bg-alert' : hpPct <= 55 ? 'bg-warn' : 'bg-ok'
                                  )}
                                />
                              </div>
                              <span className="shrink-0 font-data text-[11px] font-bold text-ink">
                                {m.hp.cur}/{m.hp.max} HP
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {(m.doing || m.mood || m.line) && (
                        <div className="border-l-2 border-line/60 pl-2.5 font-body text-[12px] leading-snug text-dim line-clamp-2">
                          {withReferences(m.doing || m.line)}
                          {m.mood && <span className="ml-1.5 text-[11px] text-faint">({m.mood})</span>}
                        </div>
                      )}

                      {m.statPills.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {m.statPills.slice(0, 5).map((sp) => (
                            <span
                              key={sp.id}
                              className="border border-line/40 tone-well-50 px-1.5 py-0.5 font-data text-[10px] text-dim"
                            >
                              <span className="text-faint">{sp.label}</span> {sp.value}
                            </span>
                          ))}
                        </div>
                      )}

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex flex-wrap items-center justify-between gap-1.5 border-t border-line/35 pt-2.5"
                      >
                        <div className="flex items-center gap-1.5">
                          {!isLead && (
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<UserCheck />}
                              onClick={() => void setProtagonist(m)}
                              title="Play as this party member"
                            >
                              Play As
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<MessageSquare />}
                            onClick={() => startConversationWith([m], `Talking with ${showName(m.title)}`)}
                          >
                            Talk
                          </Button>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<UserMinus />}
                          onClick={() => void dismissFromParty(m)}
                          title="Remove from party (stays at current place in world)"
                          className="text-dim hover:text-alert"
                        >
                          Leave
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* DIEGETIC RECRUITMENT: WHO IS AT THE PARTY'S CURRENT LOCATION */}
          <section className="flex flex-col gap-3 border-t border-line/40 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <Eyebrow>
                  {currentPlaceKey
                    ? `Also at ${placeName(places, currentPlaceKey)} (${localsHere.length})`
                    : 'Nearby Companions'}
                </Eyebrow>
                {placeNow && (
                  <p className="font-body text-[12px] text-dim">{withReferences(placeNow)}</p>
                )}
              </div>
              {currentPlaceKey && (
                <span className="text-[11px] text-faint">
                  Recruit people present in this place into your party.
                </span>
              )}
            </div>

            {!currentPlaceKey ? (
              <div className="border border-line/40 tone-surface-30 p-4 text-[12px] text-faint">
                Station your party at a place in {world.name} to see who is there and invite companions.
              </div>
            ) : localsHere.length === 0 ? (
              <div className="border border-line/40 tone-surface-30 p-4 text-[12px] text-faint">
                Nobody else is at {placeName(places, currentPlaceKey)} right now. Travel to another place to meet and recruit companions.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {localsHere.map((m) => {
                  const stance = m.faction ? getFactionStance(factions, playerFactionId, m.faction) : 'neutral'
                  const badge = STANCE_BADGE[stance]
                  const fac = m.faction ? factions.find((f) => f.id === m.faction) : null
                  return (
                    <div
                      key={m.actorId}
                      onClick={() => setSelectedId(m.actorId)}
                      onContextMenu={(e) =>
                        openMenu(e, showName(m.title), [
                          {
                            label: 'Invite to Party',
                            icon: <UserPlus />,
                            onSelect: () => void inviteToParty(m.actorId, m.title, m.placeKey, m.mapId)
                          },
                          {
                            label: 'Talk',
                            icon: <MessageSquare />,
                            onSelect: () => startConversationWith([m], `Talking with ${showName(m.title)}`)
                          }
                        ])
                      }
                      className={cn(
                        'flex cursor-pointer items-center gap-3 border p-3 transition-colors',
                        activeMember?.actorId === m.actorId
                          ? 'border-accent bg-accent/[0.06]'
                          : 'border-line/50 tone-surface-50 hover:border-line'
                      )}
                    >
                      <SheetPortrait image={m.image} className="h-12 w-12 shrink-0 border border-line/50" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-bold text-ink">{showName(m.title)}</span>
                          <span className={cn('border px-1 py-px text-[8.5px] font-bold caps', badge.cls)}>
                            {badge.label}
                          </span>
                        </div>
                        <span className="truncate text-[11px] text-dim">
                          {m.doing || fac?.name || m.line || 'Present nearby'}
                        </span>
                      </div>
                      <div onClick={(e) => e.stopPropagation()} className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<UserPlus />}
                          onClick={() => void inviteToParty(m.actorId, m.title, m.placeKey, m.mapId)}
                          title={`Invite ${showName(m.title)} into your party`}
                        >
                          Invite
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
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
          onToggleExpand={() => setDossierWidth(isExpanded ? COMPACT_W : EXPANDED_W)}
          onResizeStart={handleResizeStart}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
