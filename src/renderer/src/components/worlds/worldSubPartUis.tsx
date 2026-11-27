import { STANCE_BADGE, type StoredFaction } from '@shared/game/factions'
import { PLACE_TYPE_KEY, REGION_TYPE_KEY } from '@shared/world'
import type { WorldKnowledge } from '@shared/worldKnowledge'
import { NPC_SEGMENT, npcActorId } from '@shared/worldNpcs'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { EmptyState } from '../ui'
import { Chip, withReferences } from '../chat/References'
import { SheetCard } from '../data/SheetCard'
import { EntryCard, Facts, Loading } from '../entries/EntryCard'
import { registerWorldPartUi, type WorldPartSurfaceProps } from './worldPartUis'
import '../worldEvents/WorldEventChat'

function PlacePartChat({ worldId, itemKey }: WorldPartSurfaceProps) {
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed')
  const places = useLive(
    () => engine('worlds.records', { id: worldId, type: PLACE_TYPE_KEY }),
    ['worlds.changed', 'saves.changed'],
    [worldId]
  )
  const regions = useLive(
    () => engine('worlds.records', { id: worldId, type: REGION_TYPE_KEY }),
    ['worlds.changed', 'saves.changed'],
    [worldId]
  )
  if (!worlds || !places || !regions) return <Loading />
  const world = worlds.find((w) => w.id === worldId)
  if (!world) return <EmptyState title="Removed">This world no longer exists.</EmptyState>
  const p = places[itemKey]
  if (!p) return <EmptyState title="Removed">This place no longer exists.</EmptyState>

  const title = typeof p.Name === 'string' && p.Name.trim() ? p.Name : itemKey
  const looks = typeof p.Looks === 'string' ? p.Looks.trim() : ''
  const now = typeof p.Now === 'string' ? p.Now.trim() : ''
  const regionKey = typeof p.Region === 'string' && p.Region && p.Region in regions ? p.Region : null
  const insideKey = typeof p.Inside === 'string' && p.Inside && p.Inside in places ? p.Inside : null
  const childPlaces = Object.keys(places).filter((k) => k !== itemKey && places[k]?.Inside === itemKey)
  return (
    <EntryCard title={title} tag="place">
      {(regionKey || insideKey) && (
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          {regionKey && <Chip kind="world" refText={`${worldId}/region/${regionKey}`} />}
          {insideKey && <Chip kind="world" refText={`${worldId}/place/${insideKey}`} />}
        </div>
      )}
      <Facts
        rows={[
          ['World', world.name],
          ...(looks ? ([['Looks', looks]] as [string, string][]) : []),
          ...(now ? ([['Now', now]] as [string, string][]) : [])
        ]}
      />
      {childPlaces.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          {childPlaces.map((ck) => (
            <Chip key={ck} kind="world" refText={`${worldId}/place/${ck}`} />
          ))}
        </div>
      )}
    </EntryCard>
  )
}

function RegionPartChat({ worldId, itemKey }: WorldPartSurfaceProps) {
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed')
  const regions = useLive(
    () => engine('worlds.records', { id: worldId, type: REGION_TYPE_KEY }),
    ['worlds.changed', 'saves.changed'],
    [worldId]
  )
  const places = useLive(
    () => engine('worlds.records', { id: worldId, type: PLACE_TYPE_KEY }),
    ['worlds.changed', 'saves.changed'],
    [worldId]
  )
  if (!worlds || !regions || !places) return <Loading />
  const world = worlds.find((w) => w.id === worldId)
  if (!world) return <EmptyState title="Removed">This world no longer exists.</EmptyState>
  const r = regions[itemKey]
  if (!r) return <EmptyState title="Removed">This region no longer exists.</EmptyState>
  const title = typeof r.Name === 'string' && r.Name.trim() ? r.Name : itemKey
  const summary = typeof r.Summary === 'string' ? r.Summary.trim() : ''
  const parentKey = typeof r.Parent === 'string' && r.Parent && r.Parent in regions ? r.Parent : null
  const childPlaces = Object.keys(places).filter((k) => places[k]?.Region === itemKey)
  return (
    <EntryCard title={title} tag="region">
      {parentKey && (
        <div className="flex flex-wrap items-center gap-1 pb-1">
          <Chip kind="world" refText={`${worldId}/region/${parentKey}`} />
        </div>
      )}
      <Facts rows={[['World', world.name]]} />
      {summary && <p className="line-clamp-3 font-ui text-[12px] text-dim">{withReferences(summary)}</p>}
      {childPlaces.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-1">
          {childPlaces.map((pk) => (
            <Chip key={pk} kind="world" refText={`${worldId}/place/${pk}`} />
          ))}
        </div>
      )}
    </EntryCard>
  )
}

function FactionPartChat({ worldId, itemKey }: WorldPartSurfaceProps) {
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed')
  const factions: StoredFaction[] | null | undefined = useLive(
    () => engine('factions.list', { world: worldId, layer: 'play' }),
    ['factions.changed', 'saves.changed'],
    [worldId]
  )
  if (!worlds || !factions) return <Loading />
  const world = worlds.find((w) => w.id === worldId)
  if (!world) return <EmptyState title="Removed">This world no longer exists.</EmptyState>
  const faction = factions.find((f) => f.id === itemKey) ?? null
  if (!faction) return <EmptyState title="Removed">This faction no longer exists.</EmptyState>
  const badge = STANCE_BADGE[faction.defaultStance]
  return (
    <EntryCard
      title={faction.name}
      tag="faction"
      aside={<span className={`border px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>}
    >
      {faction.leaderSheet && (
        <div className="flex items-center gap-1 pb-1">
          <Chip kind="sheet" refText={faction.leaderSheet} />
        </div>
      )}
      <Facts
        rows={[
          ['World', world.name],
          ...(faction.power !== undefined ? ([['Power', `${faction.power}/100`]] as [string, string][]) : [])
        ]}
      />
      {faction.description && <p className="line-clamp-3 font-ui text-[12px] text-dim">{withReferences(faction.description)}</p>}
    </EntryCard>
  )
}

function KnowledgePartChat({ worldId, itemKey }: WorldPartSurfaceProps) {
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed')
  const entry: WorldKnowledge | null = useLive(
    () => engine('knowledge.get', { ref: `${worldId}/${itemKey}` }),
    'knowledge.changed',
    [worldId, itemKey]
  )
  if (!worlds) return <Loading />
  const world = worlds.find((w) => w.id === worldId)
  if (!world) return <EmptyState title="Removed">This world no longer exists.</EmptyState>
  if (!entry) return <EmptyState title="Removed">This knowledge entry no longer exists.</EmptyState>
  return (
    <EntryCard title={entry.name} tag="knowledge" aside={<span className="font-ui text-[10px] caps text-dim">{entry.scope}</span>}>
      <Facts rows={[['World', world.name]]} />
      {entry.text && <p className="line-clamp-4 font-ui text-[12px] text-dim">{entry.text}</p>}
    </EntryCard>
  )
}

function NpcPartChat({ worldId, itemKey, part }: WorldPartSurfaceProps) {
  return <SheetCard id={npcActorId(worldId, itemKey)} part={part} />
}

registerWorldPartUi('region', { Chat: RegionPartChat, Widget: RegionPartChat })
registerWorldPartUi('place', { Chat: PlacePartChat, Widget: PlacePartChat })
registerWorldPartUi('faction', { Chat: FactionPartChat, Widget: FactionPartChat })
registerWorldPartUi('knowledge', { Chat: KnowledgePartChat, Widget: KnowledgePartChat })
registerWorldPartUi(NPC_SEGMENT, { Chat: NpcPartChat, Widget: NpcPartChat })
