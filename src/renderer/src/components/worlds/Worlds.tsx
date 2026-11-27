import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { ExternalLink, Play, Plus, Tag, Trash2, Unlink } from 'lucide-react'
import { PLACE_TYPE_KEY, REGION_TYPE_KEY, inspectSchema, type WorldMeta, type WorldSchema } from '@shared/world'
import { NPC_SEGMENT, type WorldNpc } from '@shared/worldNpcs'
import { EVENT_SEGMENT } from '@shared/game/worldEvents'
import { engine, on } from '../../lib/ipc'
import { openEntry } from '../../lib/library'
import { toast } from '../../store/toasts'
import { errorText } from '../../lib/format'
import { cn } from '../../lib/cn'
import { useViewPlace } from '../../lib/viewPlace'
import {
  AddressTools,
  BrowsePick,
  Button,
  EmptyState,
  Popover,
  SaveState,
  Segmented,
  ShellTabs,
  TagInput,
  askText,
  confirmDelete,
  openMenu,
  useAddressPane,
  useAutosavedState,
  type ShellTab
} from '../ui'
import { CharacterAvatar } from '../chat/CharacterAvatar'
import { Chip } from '../chat/References'
import { CopyLinkButton } from '../data/CopyLinkButton'
import { WorldBoard } from './Board'
import { SchemaEditor } from './SchemaEditor'
import { WorldOpening } from './WorldOpening'
import { WorldPartyScreen } from './WorldPartyScreen'
import { WorldAlmanacTab } from './WorldAlmanacTab'
import { WorldCastStage } from './cast/WorldCastStage'
import { WorldFactions } from './WorldFactions'
import { WorldFlags } from './WorldFlags'
import { WorldActions } from './WorldActions'
import { WorldTriggers } from './WorldTriggers'
import { WorldRecords } from './Records'
import { WorldKnowledgeList } from './WorldKnowledgeList'
import type { AtlasTarget } from './AtlasInspector'
import { WorldEventsTab } from '../worldEvents/WorldEventsTab'
import { WorldEventsPlayView } from '../worldEvents/WorldEventsPlayView'
import { WorldMapView } from '../maps/WorldMapView'
import { useWorldMaps } from '../maps/useMap'
import { usePlaceRecords, useRegionRecords } from '../maps/usePlaceRecords'
import { EntryPicker } from '../library/EntryPicker'
import { isWaiting, useWorldEvents } from '../worldEvents/useWorldEvents'
import { useApp } from '../../store/app'
import { useTools } from '../../store/tools'
import { useLive } from '../../lib/useLive'
import { checkConversions } from '../../store/conversions'
import { setWhere } from '../maps/placeActions'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'
import { entryMenuAt } from '../../views/data/entryMenu'

type WorldMode = 'player' | 'editor'
type PlayerTabId = 'atlas' | 'party' | 'cast' | 'events' | 'almanac' | 'factions' | 'board' | 'lore'
type EditorTabId = 'atlas' | 'opening' | 'cast' | 'events' | 'factions' | 'lore' | 'board' | 'rules' | 'schema'
type RulesSubTabId = 'flags' | 'actions' | 'triggers'
type SchemaSubTabId = 'schema' | 'records'

const PLAYER_ROUTES: { owns: string; tab: PlayerTabId }[] = [
  { owns: REGION_TYPE_KEY, tab: 'atlas' },
  { owns: 'region', tab: 'atlas' },
  { owns: PLACE_TYPE_KEY, tab: 'atlas' },
  { owns: 'place', tab: 'atlas' },
  { owns: EVENT_SEGMENT, tab: 'events' },
  { owns: 'faction', tab: 'factions' },
  { owns: NPC_SEGMENT, tab: 'cast' },
  { owns: 'knowledge', tab: 'lore' }
]

const EDITOR_ROUTES: { owns: string; tab: EditorTabId }[] = [
  { owns: REGION_TYPE_KEY, tab: 'atlas' },
  { owns: 'region', tab: 'atlas' },
  { owns: PLACE_TYPE_KEY, tab: 'atlas' },
  { owns: 'place', tab: 'atlas' },
  { owns: EVENT_SEGMENT, tab: 'events' },
  { owns: 'faction', tab: 'factions' },
  { owns: NPC_SEGMENT, tab: 'cast' },
  { owns: 'knowledge', tab: 'lore' }
]

export function useWorlds(): WorldMeta[] {
  const [list, setList] = useState<WorldMeta[]>([])
  useEffect(() => {
    const load = () =>
      void engine('worlds.list')
        .then(setList)
        .catch(noteFailure('worlds', 'Could not list the worlds'))
    load()
    return on('worlds.changed', load)
  }, [])
  return list
}

function SchemaJson({ world }: { world: WorldMeta }) {
  const valid = (t: string) => {
    try {
      return !inspectSchema(JSON.parse(t) as WorldSchema).errors.length
    } catch {
      return false
    }
  }
  const autosave = useAutosavedState<string>(
    '',
    (t) => engine('worlds.saveSchema', { id: world.id, schema: JSON.parse(t) as WorldSchema }),
    { when: valid }
  )
  const text = autosave.value
  useEffect(() => {
    void engine('worlds.schema', { id: world.id })
      .then((s) => autosave.reset(JSON.stringify(s, null, 2)))
      .catch(failed('Could not read the schema'))
  }, [world.id])
  const parsed = useMemo(() => {
    try {
      return { schema: JSON.parse(text) as WorldSchema, error: null }
    } catch (err) {
      return { schema: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [text])
  const check = parsed.schema
    ? inspectSchema(parsed.schema)
    : { errors: [parsed.error ?? 'Not valid JSON'], warnings: [] }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => autosave.set(e.target.value)}
        spellCheck={false}
        className="min-h-64 flex-1 resize-none border border-line/60 tone-panel-60 p-3 font-mono text-[12px] leading-relaxed text-ink"
      />
      <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto font-ui text-[11.5px]">
        {check.errors.map((e) => (
          <div key={e} className="text-alert">
            ✕ {e}
          </div>
        ))}
        {check.warnings.map((w) => (
          <div key={w} className="text-accent-soft">
            ! {w}
          </div>
        ))}
        {!check.errors.length && !check.warnings.length && <div className="text-ok">✓ No problems</div>}
      </div>
      <div className="flex justify-end">
        <SaveState status={autosave.status} error={autosave.error} blocked={check.errors[0] ?? null} />
      </div>
    </div>
  )
}

function WorldWorkspace({
  worlds,
  world,
  first,
  firstType,
  firstKey,
  onSelectWorld,
  onCreateWorld,
  onDeleteWorld
}: {
  worlds: WorldMeta[]
  world: WorldMeta
  first: string
  firstType?: string
  firstKey?: string
  onSelectWorld: (id: string) => void
  onCreateWorld: () => void
  onDeleteWorld: (w: WorldMeta) => void
}) {
  const playEnabled = useTools((s) => s.list.some((m) => m.id === 'play' && m.state === 'on'))
  const inAddressPane = useAddressPane()

  const isCustomRecordRoute = Boolean(firstType && !PLAYER_ROUTES.some((r) => r.owns === firstType))
  const [savedMode, setSavedMode] = useViewPlace<WorldMode>(`worlds.mode.${world.id}`, 'player')
  const mode: WorldMode = isCustomRecordRoute ? 'editor' : savedMode

  const [playerTab, setPlayerTab] = useState<PlayerTabId>(() => {
    if (!firstType) return 'atlas'
    return PLAYER_ROUTES.find((r) => r.owns === firstType)?.tab ?? 'atlas'
  })
  const [editorTab, setEditorTab] = useState<EditorTabId>(() => {
    if (!firstType) return 'atlas'
    return EDITOR_ROUTES.find((r) => r.owns === firstType)?.tab ?? 'schema'
  })
  const [rulesSubTab, setRulesSubTab] = useState<RulesSubTabId>('flags')
  const [schemaSubTab, setSchemaSubTab] = useState<SchemaSubTabId>(() => (isCustomRecordRoute ? 'records' : 'schema'))
  const [schemaMode, setSchemaMode] = useState<'visual' | 'json'>('visual')
  const [schema, setSchema] = useState<WorldSchema | null>(null)
  const [shownMapId, setShownMapId] = useState<string | null>(null)
  const [pendingStampNpc, setPendingStampNpc] = useState<WorldNpc | null>(null)

  const mapUses = useWorldMaps(world.id) ?? []
  const mapList = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const save = useLive(() => engine('saves.current', { world: world.id }), 'saves.changed', [world.id]) ?? null
  const regions = useRegionRecords(world.id)
  const places = usePlaceRecords(world.id)
  const events = useWorldEvents(world.id)
  const factions = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const worldFactions = useMemo(() => factions.filter((f) => f.worldId === world.id), [factions, world.id])

  useEffect(() => {
    void engine('worlds.schema', { id: world.id })
      .then(setSchema)
      .catch((err) => {
        setSchema(null)
        failed('Could not read the world')(err)
      })
  }, [world.id, world.updatedAt])

  const initialAtlasTarget = useMemo<AtlasTarget | null>(() => {
    if (world.id !== first || !firstKey) return null
    if (firstType === REGION_TYPE_KEY || firstType === 'region') return { kind: 'region', key: firstKey }
    if (firstType === PLACE_TYPE_KEY || firstType === 'place') return { kind: 'place', key: firstKey }
    return null
  }, [world.id, first, firstType, firstKey])

  const mapForInitialTarget = useMemo(() => {
    if (!initialAtlasTarget) return null
    if (initialAtlasTarget.kind === 'region') {
      return mapUses.find((u) => Boolean(u.regionShapes?.[initialAtlasTarget.key]))?.map ?? null
    }
    return mapUses.find((u) => Boolean(u.shapes[initialAtlasTarget.key]))?.map ?? null
  }, [initialAtlasTarget, mapUses])

  const activeMapId =
    (shownMapId ? mapUses.find((u) => u.map === shownMapId)?.map : null) ??
    mapForInitialTarget ??
    mapUses[0]?.map ??
    null

  const mapNameOf = (id: string) => mapList.find((m) => m.id === id)?.name ?? id
  const regionCount = Object.keys(regions).length
  const placeCount = Object.keys(places).length
  const waitingEventCount = events.filter(isWaiting).length
  const partyCount = new Set([...(save?.party ?? []), ...(world.player ? [world.player] : [])]).size
  const schemaTypeCount = schema ? Object.keys(schema.types).length : 0

  const useMap = (map: string) =>
    void engine('worlds.useMap', { id: world.id, map })
      .then(() => {
        setShownMapId(map)
        if (mode === 'player') setPlayerTab('atlas')
        else setEditorTab('atlas')
      })
      .catch(failed('Could not use the map'))

  const dropMap = (map: string) =>
    confirmDelete(
      `Remove ${mapNameOf(map)} from this world?`,
      "This world's zones drawn on it will be detached; the map itself remains safe in Maps.",
      () => engine('worlds.dropMap', { id: world.id, map }),
      undefined,
      'Remove from World'
    )

  const onStart = (place: string) => {
    const player = world.player
    if (!player) return toast.info('No active player', 'Choose or add a character in Party first.')
    void setWhere(player, place, world.id)
      .then(() => {
        if (playEnabled) {
          toast.success('Starting location set', 'Character is ready. Entering Play mode…')
          useApp.getState().setView('play')
        } else {
          toast.success('Starting location set', 'Character starting place updated.')
        }
      })
      .catch(failed('Could not start there'))
  }

  const launchStampOnMap = (npc?: WorldNpc | null) => {
    if (!activeMapId) {
      toast.info('Attach a Map First', 'Link a map in Atlas before stamping on it.')
    }
    setPendingStampNpc(npc ?? null)
    setSavedMode('editor')
    setEditorTab('atlas')
  }

  const mapTabMenu = (e: MouseEvent, mapId: string) =>
    openMenu(e, mapNameOf(mapId), [
      { label: 'Open in Map Editor', icon: <ExternalLink />, onSelect: () => openEntry('map', mapId) },
      ...(mode === 'editor'
        ? [{ label: 'Remove from World', icon: <Unlink />, danger: true, onSelect: () => dropMap(mapId) }]
        : [])
    ])

  const renderAtlas = (viewMode: WorldMode) =>
    activeMapId ? (
      <WorldMapView
        key={`${world.id}/${activeMapId}/${viewMode}`}
        world={world.id}
        mapId={activeMapId}
        mode={viewMode}
        initialTarget={initialAtlasTarget}
        initialStampNpc={viewMode === 'editor' ? pendingStampNpc : null}
        onConsumeStamp={() => setPendingStampNpc(null)}
        onStart={onStart}
      />
    ) : (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <EmptyState title="Link a Map to Open the Atlas">
          Attach a map from Map Editor to draw Regions, Places, and stamp NPCs directly onto it.
          {viewMode === 'editor' && (
            <div className="mt-3 flex justify-center">
              <Popover
                title="Use a map from Map Editor"
                trigger={
                  <Button size="sm" variant="primary" icon={<Plus />}>
                    Use a map
                  </Button>
                }
              >
                {(close) => (
                  <EntryPicker
                    kind="map"
                    title="Use a map"
                    inline
                    onClose={close}
                    onPick={(hit) => {
                      useMap(hit.id)
                      close()
                    }}
                  />
                )}
              </Popover>
            </div>
          )}
        </EmptyState>
      </div>
    )

  const playerTabs: (ShellTab<PlayerTabId> & { render: () => ReactNode })[] = [
    {
      value: 'atlas',
      label: 'Atlas',
      count: regionCount + placeCount,
      render: () => renderAtlas('player')
    },
    {
      value: 'party',
      label: 'Party',
      count: partyCount,
      render: () => <WorldPartyScreen key={world.id} world={world} />
    },
    {
      value: 'cast',
      label: 'Cast',
      render: () => (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
          <WorldCastStage
            key={`${world.id}:player`}
            world={world}
            mode="player"
            initialNpcKey={world.id === first && firstType === NPC_SEGMENT ? firstKey : undefined}
          />
        </div>
      )
    },
    {
      value: 'events',
      label: waitingEventCount > 0 ? `Events (${waitingEventCount} active)` : 'Events',
      count: events.length,
      render: () => (
        <WorldEventsPlayView
          key={world.id}
          world={world}
          onSwitchToEditor={() => {
            setSavedMode('editor')
            setEditorTab('events')
          }}
        />
      )
    },
    {
      value: 'almanac',
      label: 'Almanac',
      render: () => <WorldAlmanacTab key={world.id} world={world} />
    },
    {
      value: 'factions',
      label: 'Factions',
      count: worldFactions.length,
      render: () => <WorldFactions key={`${world.id}:player`} world={world} mode="player" />
    },
    {
      value: 'board',
      label: 'Board',
      count: world.posts,
      render: () => <WorldBoard key={world.id} worldId={world.id} mode="player" />
    },
    {
      value: 'lore',
      label: 'Lore',
      render: () => <WorldKnowledgeList key={`${world.id}:player`} world={world} mode="player" />
    }
  ]

  const rulesSubTabs: (ShellTab<RulesSubTabId> & { render: () => ReactNode })[] = [
    {
      value: 'flags',
      label: 'World Flags',
      render: () => (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          <WorldFlags key={world.id} world={world} />
        </div>
      )
    },
    {
      value: 'actions',
      label: 'Trigger Actions',
      render: () => (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          <WorldActions key={world.id} world={world} />
        </div>
      )
    },
    {
      value: 'triggers',
      label: 'Map Triggers',
      render: () => (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          <WorldTriggers key={world.id} world={world} />
        </div>
      )
    }
  ]

  const schemaSubTabs: (ShellTab<SchemaSubTabId> & { render: () => ReactNode })[] = [
    {
      value: 'schema',
      label: 'Data Schema',
      count: schemaTypeCount,
      render: () => (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="type-title text-ink">World Data Schema</span>
            <Segmented
              value={schemaMode}
              onChange={setSchemaMode}
              options={[
                { value: 'visual', label: 'Visual' },
                { value: 'json', label: 'JSON' }
              ]}
            />
          </div>
          {schemaMode === 'visual' ? (
            <SchemaEditor key={world.id} worldId={world.id} />
          ) : (
            <SchemaJson key={world.id} world={world} />
          )}
        </div>
      )
    },
    {
      value: 'records',
      label: 'Custom Records',
      count: schemaTypeCount,
      render: () => (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          {schema ? (
            <WorldRecords
              key={world.id}
              worldId={world.id}
              schema={schema}
              initialType={world.id === first ? firstType : undefined}
              initialKey={world.id === first ? firstKey : undefined}
            />
          ) : (
            <EmptyState title="No schema yet">Define custom data types in Data Schema first.</EmptyState>
          )}
        </div>
      )
    }
  ]

  const editorTabs: (ShellTab<EditorTabId> & { render: () => ReactNode })[] = [
    {
      value: 'atlas',
      label: 'Atlas',
      count: regionCount + placeCount,
      render: () => renderAtlas('editor')
    },
    {
      value: 'opening',
      label: 'Opening',
      render: () => <WorldOpening key={world.id} world={world} />
    },
    {
      value: 'cast',
      label: 'Cast & Archetypes',
      render: () => (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
          <WorldCastStage
            key={`${world.id}:editor`}
            world={world}
            mode="editor"
            initialNpcKey={world.id === first && firstType === NPC_SEGMENT ? firstKey : undefined}
            onStampOnMap={launchStampOnMap}
          />
        </div>
      )
    },
    {
      value: 'events',
      label: 'Events',
      count: events.length,
      render: () => (
        <WorldEventsTab
          key={world.id}
          world={world}
          initialKey={world.id === first && firstType === EVENT_SEGMENT ? firstKey : undefined}
        />
      )
    },
    {
      value: 'factions',
      label: 'Factions',
      count: worldFactions.length,
      render: () => <WorldFactions key={`${world.id}:editor`} world={world} mode="editor" />
    },
    {
      value: 'lore',
      label: 'Lore',
      render: () => <WorldKnowledgeList key={`${world.id}:editor`} world={world} mode="editor" />
    },
    {
      value: 'board',
      label: 'Board',
      count: world.posts,
      render: () => <WorldBoard key={world.id} worldId={world.id} mode="editor" />
    },
    {
      value: 'rules',
      label: 'Rules',
      render: () => {
        const activeRule = rulesSubTabs.find((r) => r.value === rulesSubTab) ?? rulesSubTabs[0]
        return (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
            <ShellTabs
              value={activeRule.value}
              options={rulesSubTabs}
              onChange={setRulesSubTab}
              className="px-4 pt-1 tone-panel-40"
            />
            {activeRule.render()}
          </div>
        )
      }
    },
    {
      value: 'schema',
      label: 'Schema',
      count: schemaTypeCount,
      render: () => {
        const activeSchema = schemaSubTabs.find((s) => s.value === schemaSubTab) ?? schemaSubTabs[0]
        return (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
            <ShellTabs
              value={activeSchema.value}
              options={schemaSubTabs}
              onChange={setSchemaSubTab}
              className="px-4 pt-1 tone-panel-40"
            />
            {activeSchema.render()}
          </div>
        )
      }
    }
  ]

  const currentPlayerTab = playerTabs.find((t) => t.value === playerTab) ?? playerTabs[0]
  const currentEditorTab = editorTabs.find((t) => t.value === editorTab) ?? editorTabs[0]
  const isAtlasActive = (mode === 'player' ? currentPlayerTab.value : currentEditorTab.value) === 'atlas'

  const worldContextControls = (
    <div
      onContextMenu={(e) => entryMenuAt(e, 'world', world.id, world.name, [])}
      className="flex flex-wrap items-center gap-2 font-ui"
    >
      <div className="w-44">
        <BrowsePick
          value={world.id}
          options={worlds.map((w) => ({
            value: w.id,
            label: w.name,
            group: 'Worlds'
          }))}
          placeholder="Select world"
          clearable={false}
          onChange={(next) => {
            if (next) onSelectWorld(next)
          }}
        />
      </div>

      {/* FRONT-END (PLAYER) VS BACK-END (EDITOR) MODE SWITCH */}
      <Segmented
        value={mode}
        onChange={(next) => setSavedMode(next)}
        options={[
          { value: 'player', label: 'Player', hint: 'Explore the world, manage your Party, resolve Events, and read Almanac & Lore' },
          { value: 'editor', label: 'Editor', hint: 'Author Atlas maps, Opening story, Archetypes, Events, Factions, Rules & Schema' }
        ]}
      />

      <Button size="sm" variant="ghost" icon={<Plus />} onClick={onCreateWorld} title="Create new world">
        World
      </Button>
      <CopyLinkButton kind="world" id={world.id} />

      {/* ACTIVE PLAYER CHARACTER DOCK */}
      <div className="flex items-center gap-1.5 border border-line/60 tone-well-50 px-2 py-0.5">
        <CharacterAvatar sheetId={world.player} size={20} />
        <span className="font-label text-[9.5px] font-bold caps-5 text-dim">You:</span>
        {world.player ? (
          <Chip
            kind="sheet"
            refText={world.player}
            onRemove={() => void engine('worlds.setPlayer', { id: world.id, sheet: null }).catch(failed('Could not clear player'))}
          />
        ) : null}
        <Popover
          title="Choose your active character in this world"
          trigger={
            <span className="cursor-pointer font-label text-[10px] caps-5 text-accent hover:text-ink">
              {world.player ? 'Switch' : 'Choose…'}
            </span>
          }
        >
          {(close) => (
            <EntryPicker
              kind="sheet"
              title="Select Player Character"
              inline
              onClose={close}
              onPick={(hit) => {
                void engine('worlds.setPlayer', { id: world.id, sheet: hit.id }).catch(failed('Could not set player'))
                close()
              }}
            />
          )}
        </Popover>
      </div>

      {mode === 'editor' && (
        <Popover
          title="World tags"
          className="w-72 p-3"
          trigger={
            <span className="inline-flex h-7 cursor-pointer items-center gap-1 border border-line/60 tone-well-50 px-2 font-label text-[10px] caps-5 text-dim hover:border-accent hover:text-ink">
              <Tag className="h-3 w-3 text-accent" />
              <span>{world.tags.length > 0 ? world.tags.map((t) => `#${t}`).join(' ') : 'Tags'}</span>
            </span>
          }
        >
          <TagInput
            value={world.tags}
            onChange={(tags) => void engine('worlds.setTags', { id: world.id, tags }).catch(failed('Could not save tags'))}
          />
        </Popover>
      )}

      {playEnabled && (
        <Button
          size="sm"
          variant="primary"
          icon={<Play className="h-3.5 w-3.5" />}
          onClick={() => useApp.getState().setView('play')}
          title="Enter Play mode"
        >
          Play
        </Button>
      )}

      {mode === 'editor' && (
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 className="h-3.5 w-3.5 text-alert" />}
          onClick={() => onDeleteWorld(world)}
          title="Delete world"
        />
      )}
    </div>
  )

  const atlasMapPicker = isAtlasActive && (
    <div className="flex items-center gap-1.5">
      {mapUses.map((u) => {
        const isCurrent = u.map === activeMapId
        return (
          <button
            key={u.map}
            type="button"
            onClick={() => setShownMapId(u.map)}
            onContextMenu={(e) => mapTabMenu(e, u.map)}
            className={cn(
              'flex h-6 items-center gap-1.5 border px-2 font-label text-[10px] font-bold caps-5 transition-colors cursor-pointer',
              isCurrent
                ? 'border-secondary-ink/70 bg-secondary/15 text-secondary-ink'
                : 'border-line/50 tone-well-50 text-dim hover:border-accent hover:text-ink'
            )}
            title={`${mapNameOf(u.map)} · Right-click for map actions`}
          >
            <span className="max-w-32 truncate">{mapNameOf(u.map)}</span>
          </button>
        )
      })}
      {mode === 'editor' && (
        <Popover
          title="Use a map from Map Editor"
          trigger={
            <span className="inline-flex h-6 cursor-pointer items-center gap-1 border border-line/60 tone-well-50 px-2 font-label text-[10px] font-bold caps-5 text-accent hover:border-accent hover:text-ink">
              <Plus className="h-3 w-3" /> Use Map
            </span>
          }
        >
          {(close) => (
            <EntryPicker
              kind="map"
              title="Use a map"
              inline
              onClose={close}
              onPick={(hit) => {
                useMap(hit.id)
                close()
              }}
            />
          )}
        </Popover>
      )}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg">
      {inAddressPane ? (
        <AddressTools order={10}>{worldContextControls}</AddressTools>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 tone-sidebar-80 px-3 py-1.5">
          {worldContextControls}
        </div>
      )}

      {/* MODE-SCOPED TOP TABS */}
      {mode === 'player' ? (
        <ShellTabs
          value={currentPlayerTab.value}
          options={playerTabs}
          onChange={setPlayerTab}
          className="px-3 pt-1 tone-sidebar-60"
        >
          {atlasMapPicker}
        </ShellTabs>
      ) : (
        <ShellTabs
          value={currentEditorTab.value}
          options={editorTabs}
          onChange={setEditorTab}
          className="px-3 pt-1 tone-sidebar-60"
        >
          {atlasMapPicker}
        </ShellTabs>
      )}

      {/* FULL-WIDTH WORKSPACE BODY */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {mode === 'player' ? currentPlayerTab.render() : currentEditorTab.render()}
      </div>
    </div>
  )
}

export function WorldsPanel({ initial = null }: { initial?: string | null }) {
  const list = useWorlds()
  useEffect(() => {
    checkConversions('world-events')
    checkConversions('factions')
    checkConversions('world-npcs')
  }, [])
  const [first, firstType, firstKey] = (initial ?? '').split('/')
  const [selected, setSelected] = useState<string | null>(first || null)
  const world = list.find((w) => w.id === selected) ?? list[0] ?? null

  const create = () =>
    askText('New world', 'Name', '', async (name) => {
      try {
        const w = await engine('worlds.create', { name })
        setSelected(w.id)
      } catch (err) {
        toast.error('Could not create the world', errorText(err))
      }
    })

  const remove = (w: WorldMeta) =>
    void engine('saves.list', { world: w.id })
      .then((res) => {
        const n = res.saves.length
        confirmDelete(
          `Delete ${w.name}?`,
          `Every record goes with it${n ? `, and its ${n === 1 ? 'save' : `${n} saves`}: their characters leave first, taking their state onto their sheets` : ''}. Agents linked to it lose their place.`,
          () => engine('worlds.delete', { id: w.id })
        )
      })
      .catch(failed('Could not read its saves'))

  if (!list.length || !world) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <AddressTools order={10}>
          <Button size="sm" variant="badge" icon={<Plus className="h-3.5 w-3.5" />} onClick={create}>
            New world
          </Button>
        </AddressTools>
        <EmptyState title="No worlds yet">
          A world holds maps, regions, places, events, characters, and a shared board.
          <div className="mt-3 flex justify-center">
            <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={create}>
              New world
            </Button>
          </div>
        </EmptyState>
      </div>
    )
  }

  return (
    <WorldWorkspace
      key={`${world.id}:${initial ?? ''}`}
      worlds={list}
      world={world}
      first={first}
      firstType={firstType}
      firstKey={firstKey}
      onSelectWorld={setSelected}
      onCreateWorld={create}
      onDeleteWorld={remove}
    />
  )
}
