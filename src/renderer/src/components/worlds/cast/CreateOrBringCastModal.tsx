import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { CompendiumRef } from '@shared/compendium'
import { monsterToSheetInput } from '@shared/game/creatures'
import type { StoredFaction } from '@shared/game/factions'
import { showName } from '@shared/ids'
import type { CreatureDisposition, WorldMapUse } from '@shared/maps'
import { linkFor } from '@shared/text'
import { hitDetail, type LibraryHit } from '@shared/types'
import type { WorldMeta } from '@shared/world'
import { npcActorId, type WorldNpc } from '@shared/worldNpcs'
import {
  Button,
  EmptyState,
  Eyebrow,
  Field,
  ListRow,
  Modal,
  Popover,
  SearchListPanel,
  Segmented,
  ShellTabs,
  SliderNumber,
  type ShellTab
} from '../../ui'
import { LinkTextarea } from '../../data/LinkTextarea'
import { MarkdownEditor } from '../../data/MarkdownEditor'
import { LinkFaceList } from '../../entries/LinkFaces'
import { EntryPicker } from '../../library/EntryPicker'
import { useCompendiumList } from '../../dnd/useCompendiumList'
import { FactionSelect } from '../../factions/FactionSelect'
import { engine } from '../../../lib/ipc'
import { listKeys } from '../../../lib/listKeys'
import { failed } from '../../../lib/notify'
import { useLibraryFind } from '../../../lib/useLibraryFind'
import { useLive } from '../../../lib/useLive'
import { toast } from '../../../store/toasts'
import { entryMenuAt } from '../../../views/data/entryMenu'
import { JoinFooter } from '../JoinFooter'
import { joinWorld } from '../SheetJoin'
import { WorldMapUseSelect } from '../WorldMapUseSelect'
import { WorldPlacePick } from '../WorldPlacePick'
import { usePlaceRecords } from '../../maps/usePlaceRecords'

export type CastModalTab = 'new-npc' | 'stamp' | 'library'

interface Props {
  world: WorldMeta
  uses: WorldMapUse[]
  initialTab?: CastModalTab
  initialPlace?: string | null
  initialArchetype?: WorldNpc | null
  onClose: () => void
  onAdded: (actorId: string) => void
}

const DISPOSITION_OPTIONS: { value: CreatureDisposition; label: string }[] = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'hostile', label: 'Hostile' }
]

export function CreateOrBringCastModal({
  world,
  uses,
  initialTab,
  initialPlace = null,
  initialArchetype = null,
  onClose,
  onAdded
}: Props) {
  const [tab, setTab] = useState<CastModalTab>(
    initialTab ?? (initialArchetype ? 'stamp' : 'new-npc')
  )

  const tabs: ShellTab<CastModalTab>[] = [
    { value: 'new-npc', label: 'New World NPC' },
    { value: 'stamp', label: 'Stamp into Save' },
    { value: 'library', label: 'Library Character' }
  ]

  return (
    <Modal open={true} title={`Cast · ${world.name}`} onClose={onClose} wide>
      <div className="flex select-none flex-col gap-4 font-ui">
        <ShellTabs value={tab} onChange={(v) => setTab(v as CastModalTab)} options={tabs} className="border-b border-line/60" />

        {tab === 'new-npc' && (
          <NewWorldNpcPane
            world={world}
            uses={uses}
            initialPlace={initialPlace}
            onClose={onClose}
            onAdded={onAdded}
          />
        )}
        {tab === 'stamp' && (
          <StampCastPane
            world={world}
            uses={uses}
            initialPlace={initialPlace}
            initialArchetype={initialArchetype}
            onClose={onClose}
            onAdded={onAdded}
          />
        )}
        {tab === 'library' && (
          <LibraryCharacterPane
            world={world}
            uses={uses}
            initialPlace={initialPlace}
            onClose={onClose}
            onAdded={onAdded}
          />
        )}
      </div>
    </Modal>
  )
}

function NewWorldNpcPane({
  world,
  uses,
  initialPlace,
  onClose,
  onAdded
}: {
  world: WorldMeta
  uses: WorldMapUse[]
  initialPlace: string | null
  onClose: () => void
  onAdded: (actorId: string) => void
}) {
  const [name, setName] = useState('')
  const [kindMode, setKindMode] = useState<'unique' | 'archetype'>('unique')
  const [place, setPlace] = useState<string | null>(initialPlace)
  const [map, setMap] = useState(uses[0]?.map ?? '')
  const [faction, setFaction] = useState<string | null>(null)
  const [disposition, setDisposition] = useState<CreatureDisposition>('neutral')
  const [identity, setIdentity] = useState('')
  const [doing, setDoing] = useState('')
  const [voice, setVoice] = useState('')
  const [saving, setSaving] = useState(false)

  const places = usePlaceRecords(world.id)
  const hasPlaces = Object.keys(places).length > 0
  const isArchetype = kindMode === 'archetype'
  const needsLocation = !isArchetype && (hasPlaces ? !place : uses.length > 0 && !map)

  const create = async () => {
    const cleanTitle = name.trim()
    if (!cleanTitle) return toast.error('Missing Name', 'Give the NPC or archetype a name first.')
    if (needsLocation) return toast.error('Choose a Location', `Pick where in ${world.name} this NPC starts.`)
    setSaving(true)
    try {
      const fields = ['Identity', 'Appearance', 'Personality', 'Speech']
      const values: Record<string, string> = {}
      if (identity.trim()) values.Identity = identity.trim()
      if (voice.trim()) values.Speech = voice.trim()
      const where = !isArchetype && place ? `@world:${world.id}/place/${place}` : ''

      const created = await engine('npcs.save', {
        world: world.id,
        npc: {
          title: cleanTitle,
          archetype: isArchetype,
          faction,
          disposition,
          fields,
          values,
          story: {
            where,
            ...(doing.trim() ? { doing: doing.trim() } : {}),
            threads: [],
            sessions: []
          },
          mind: voice.trim() ? { voiceConstraints: voice.trim() } : null
        }
      })
      const actorId = npcActorId(world.id, created.id)
      if (!isArchetype && (place || map)) {
        const targetMap =
          map ||
          (place ? uses.find((u) => Boolean(u.spawns?.[place] || u.shapes[place]))?.map : null) ||
          uses[0]?.map ||
          ''
        if (targetMap) {
          await engine('worlds.moveCharacter', {
            sheet: actorId,
            world: world.id,
            map: targetMap,
            place: place ?? ''
          })
        }
      }
      toast.success(
        isArchetype ? 'Archetype Created' : 'World NPC Created',
        `${showName(created.title)} now lives inside ${world.name}.`
      )
      onAdded(actorId)
      onClose()
    } catch (err) {
      failed('Could not create World NPC')(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/40 pb-3">
        <div className="flex flex-col gap-0.5">
          <Eyebrow>{isArchetype ? 'Reusable World Archetype' : 'Unique World NPC'}</Eyebrow>
          <span className="text-[12px] text-dim">
            {isArchetype
              ? 'Type @ in any field to link repos (:roll bakes on stamp, :value stays live) or pages.'
              : 'Stored inside this world without adding files to your personal Characters library.'}
          </span>
        </div>
        <Segmented
          value={kindMode}
          onChange={setKindMode}
          options={[
            { value: 'unique', label: 'Unique NPC' },
            { value: 'archetype', label: 'Archetype' }
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field
          label={isArchetype ? 'Name or @repo pattern' : 'Name'}
          tip={isArchetype ? 'Type @ to link a repo with :roll so each stamped individual gets a distinct name.' : undefined}
        >
          <LinkTextarea
            rolls={false}
            rows={1}
            value={name}
            onValue={setName}
            placeholder={isArchetype ? 'Harbor Sentry or @repo:names:roll' : 'Captain Vane'}
            className="min-h-8 resize-none"
          />
        </Field>

        <Field label="Faction">
          <FactionSelect value={faction} onChange={setFaction} />
        </Field>

        {!isArchetype && hasPlaces && (
          <Field label="Starting Place (Required)">
            <WorldPlacePick
              world={world.id}
              value={place}
              onChange={setPlace}
              placeholder={`Choose a place in ${world.name}…`}
            />
          </Field>
        )}

        {!isArchetype && (uses.length > 1 || (!hasPlaces && uses.length > 0)) && (
          <Field label={hasPlaces ? 'Map' : 'Starting Map (Required)'}>
            <WorldMapUseSelect uses={uses} value={map} onChange={setMap} />
          </Field>
        )}

        <Field label="Default Posture">
          <Segmented value={disposition} onChange={setDisposition} options={DISPOSITION_OPTIONS} />
        </Field>

        <Field label={isArchetype ? 'Default Doing' : 'Doing Right Now'}>
          <LinkTextarea
            rolls={false}
            rows={1}
            value={doing}
            onValue={setDoing}
            placeholder={isArchetype ? 'Patrolling the docks or @repo:duties:roll' : 'Counting silver by lantern light'}
            className="min-h-8 resize-none"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5 border border-line/50 tone-well-40 p-3">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Identity &amp; Concept</Eyebrow>
            <Popover
              title="Insert link or repo roll"
              trigger={
                <span className="cursor-pointer font-label text-[10px] caps-5 text-secondary-ink hover:text-ink">
                  + Link
                </span>
              }
            >
              {(close) => (
                <EntryPicker
                  kind={null}
                  title="Link repo or entry"
                  inline
                  onClose={close}
                  onPick={(hit) => {
                    const token = hit.kind === 'repo' && isArchetype ? `@repo:${hit.id}:roll` : linkFor(hit.kind, hit.id)
                    setIdentity((prev) => (prev.trim() ? `${prev.trimEnd()} ${token}` : token))
                    close()
                  }}
                />
              )}
            </Popover>
          </div>
          <MarkdownEditor
            compact
            rolls={!isArchetype}
            value={identity}
            onValue={setIdentity}
            placeholder="Who they are, role, appearance — type @ to link repos or pages"
          />
          <LinkFaceList text={identity} />
        </div>

        <div className="flex flex-col gap-1.5 border border-line/50 tone-well-40 p-3">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Speech &amp; Voice</Eyebrow>
            <Popover
              title="Insert link or repo roll"
              trigger={
                <span className="cursor-pointer font-label text-[10px] caps-5 text-secondary-ink hover:text-ink">
                  + Link
                </span>
              }
            >
              {(close) => (
                <EntryPicker
                  kind={null}
                  title="Link repo or entry"
                  inline
                  onClose={close}
                  onPick={(hit) => {
                    const token = hit.kind === 'repo' && isArchetype ? `@repo:${hit.id}:roll` : linkFor(hit.kind, hit.id)
                    setVoice((prev) => (prev.trim() ? `${prev.trimEnd()} ${token}` : token))
                    close()
                  }}
                />
              )}
            </Popover>
          </div>
          <MarkdownEditor
            compact
            rolls={!isArchetype}
            value={voice}
            onValue={setVoice}
            placeholder="Cadence, verbal tells, voice constraints — type @ to link"
          />
          <LinkFaceList text={voice} />
        </div>
      </div>

      <JoinFooter
        note={
          needsLocation
            ? `Choose where in ${world.name} this NPC starts before creating.`
            : isArchetype
              ? `Saved in ${world.name} as an Archetype with a Game system attached.`
              : `Saved in ${world.name} with a full Game system and all 6 character tabs ready.`
        }
        busy={saving}
        onCancel={onClose}
      >
        <Button
          size="sm"
          variant="primary"
          icon={<Plus />}
          onClick={() => void create()}
          disabled={saving || !name.trim() || needsLocation}
        >
          {saving ? 'Creating…' : isArchetype ? 'Create Archetype' : 'Create World NPC'}
        </Button>
      </JoinFooter>
    </div>
  )
}

type StampSourceTab = 'archetypes' | 'bestiary'

function StampCastPane({
  world,
  uses,
  initialPlace,
  initialArchetype,
  onClose,
  onAdded
}: {
  world: WorldMeta
  uses: WorldMapUse[]
  initialPlace: string | null
  initialArchetype: WorldNpc | null
  onClose: () => void
  onAdded: (actorId: string) => void
}) {
  const places = usePlaceRecords(world.id)
  const hasPlaces = Object.keys(places).length > 0
  const templateNpcs =
    useLive(() => engine('npcs.list', { world: world.id, layer: 'template' }), 'npcs.changed', [world.id]) ?? []
  const archetypes = useMemo(() => templateNpcs.filter((n) => n.archetype), [templateNpcs])
  const { refs: monsters } = useCompendiumList('monster')
  const factions: StoredFaction[] =
    useLive(() => engine('factions.list', { world: world.id }), 'factions.changed', [world.id]) ?? []

  const [sourceTab, setSourceTab] = useState<StampSourceTab>(
    initialArchetype || archetypes.length > 0 ? 'archetypes' : 'bestiary'
  )
  const [query, setQuery] = useState('')
  const [pickedNpcId, setPickedNpcId] = useState<string | null>(initialArchetype?.id ?? null)
  const [pickedMonsterId, setPickedMonsterId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [count, setCount] = useState(1)
  const [place, setPlace] = useState<string | null>(initialPlace)
  const [map, setMap] = useState(uses[0]?.map ?? '')
  const [faction, setFaction] = useState<string | null | undefined>(undefined)
  const [disposition, setDisposition] = useState<CreatureDisposition>('hostile')
  const [busy, setBusy] = useState(false)

  const shownArchetypes = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = archetypes.length > 0 ? archetypes : templateNpcs
    return q ? pool.filter((n) => n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) : pool
  }, [archetypes, templateNpcs, query])

  const shownMonsters = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (
      q
        ? monsters.filter((m) =>
            [m.name, String(m.facts?.type ?? ''), String(m.facts?.cr ?? '')].some((v) =>
              v.toLowerCase().includes(q)
            )
          )
        : monsters
    ).slice(0, 50)
  }, [monsters, query])

  const activeNpc = shownArchetypes.find((n) => n.id === pickedNpcId) ?? shownArchetypes[0] ?? null
  const activeMonster = shownMonsters.find((m) => m.id === pickedMonsterId) ?? shownMonsters[0] ?? null

  const chosenFaction =
    faction !== undefined
      ? faction
      : sourceTab === 'archetypes'
        ? (activeNpc?.faction ?? null)
        : (factions.find((f) => f.defaultStance === 'hostile')?.id ?? null)

  const stampFromArchetype = async (npc: WorldNpc) => {
    setBusy(true)
    try {
      const res = await engine('npcs.stamp', {
        world: world.id,
        target: npc.id,
        source: 'world-npc',
        count,
        name: customName.trim() || null,
        faction: chosenFaction,
        disposition: npc.disposition ?? disposition,
        place,
        map: map || null
      })
      toast.success(
        'Stamped into Save',
        `Stamped ${res.actorIds.length} individual(s) from ${showName(npc.title)}.`
      )
      if (res.actorIds[0]) onAdded(res.actorIds[0])
      onClose()
    } catch (err) {
      failed('Could not stamp archetype')(err)
    } finally {
      setBusy(false)
    }
  }

  const stampOrSaveMonster = async (m: CompendiumRef, mode: 'stamp' | 'template-archetype') => {
    setBusy(true)
    try {
      const { entry } = await engine('dnd.get', { kind: 'monster', id: m.id })
      const sheetInput = monsterToSheetInput({
        monster: entry,
        customName: customName.trim() || entry.name,
        factionId: chosenFaction
      })
      if (mode === 'template-archetype') {
        const created = await engine('npcs.save', {
          world: world.id,
          npc: {
            title: sheetInput.title,
            fields: sheetInput.fields,
            values: sheetInput.values,
            dnd: sheetInput.dnd,
            faction: sheetInput.faction,
            disposition,
            archetype: true,
            story: { where: '', threads: [], sessions: [] }
          }
        })
        const actorId = npcActorId(world.id, created.id)
        toast.success('Saved as World Archetype', `${showName(created.title)} was added to ${world.name}.`)
        onAdded(actorId)
        onClose()
        return
      }

      const tempTpl = await engine('npcs.save', {
        world: world.id,
        npc: {
          title: sheetInput.title,
          fields: sheetInput.fields,
          values: sheetInput.values,
          dnd: sheetInput.dnd,
          faction: sheetInput.faction,
          disposition,
          archetype: true
        }
      })
      const res = await engine('npcs.stamp', {
        world: world.id,
        target: tempTpl.id,
        source: 'world-npc',
        count,
        name: customName.trim() || entry.name,
        faction: chosenFaction,
        disposition,
        place,
        map: map || null
      })
      await engine('npcs.delete', { world: world.id, id: tempTpl.id })
      toast.success('Stamped into Save', `Stamped ${res.actorIds.length} × ${entry.name} into the active save.`)
      if (res.actorIds[0]) onAdded(res.actorIds[0])
      onClose()
    } catch (err) {
      failed('Could not stamp creature')(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-[420px] grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="flex min-h-0 flex-col gap-2 lg:col-span-5">
        <Segmented
          value={sourceTab}
          onChange={setSourceTab}
          options={[
            { value: 'archetypes', label: `Archetypes (${archetypes.length})` },
            { value: 'bestiary', label: `Bestiary (${monsters.length})` }
          ]}
        />
        {sourceTab === 'archetypes' ? (
          <SearchListPanel
            query={query}
            onQuery={setQuery}
            placeholder="Filter world archetypes"
            count={`${shownArchetypes.length} templates`}
            className="min-h-0 flex-1"
          >
            {shownArchetypes.map((n) => (
              <ListRow
                key={n.id}
                active={activeNpc?.id === n.id}
                onClick={() => setPickedNpcId(n.id)}
                title={showName(n.title)}
                subtitle={n.values.Identity || (n.archetype ? 'Archetype template' : 'Unique World NPC')}
                meta={n.archetype ? 'Archetype' : 'Unique'}
              />
            ))}
            {!shownArchetypes.length && (
              <EmptyState title="No world archetypes">
                Create one in New World NPC, or switch to Bestiary.
              </EmptyState>
            )}
          </SearchListPanel>
        ) : (
          <SearchListPanel
            query={query}
            onQuery={setQuery}
            placeholder="Filter bestiary by name, type, or CR"
            count={`${shownMonsters.length} creatures`}
            className="min-h-0 flex-1"
          >
            {shownMonsters.map((m) => (
              <ListRow
                key={m.id}
                active={activeMonster?.id === m.id}
                onClick={() => setPickedMonsterId(m.id)}
                title={m.name}
                subtitle={[String(m.facts?.size ?? ''), String(m.facts?.type ?? '')].filter(Boolean).join(' ')}
                meta={m.facts?.cr !== undefined ? `CR ${m.facts.cr}` : undefined}
              />
            ))}
            {!shownMonsters.length && <EmptyState title="No match">Try another name or CR.</EmptyState>}
          </SearchListPanel>
        )}
      </div>

      <div className="flex flex-col justify-between gap-4 border border-line/60 tone-panel-50 p-4 lg:col-span-7">
        <div className="flex flex-col gap-4">
          <div className="border-b border-line/40 pb-3">
            <div className="text-[15px] font-bold text-ink">
              {sourceTab === 'archetypes'
                ? activeNpc
                  ? showName(activeNpc.title)
                  : 'Select an Archetype'
                : activeMonster
                  ? activeMonster.name
                  : 'Select a Creature'}
            </div>
            <p className="mt-0.5 text-[12px] text-dim">
              Each stamped individual rolls any :roll and #random tokens once into its own save-layer sheet.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <Field label="Count">
              <SliderNumber value={count} min={1} max={12} step={1} onChange={setCount} />
            </Field>
            <Field label="Name override (optional)" tip="Type @ to link a repo with :roll.">
              <LinkTextarea
                rolls={false}
                rows={1}
                value={customName}
                onValue={setCustomName}
                placeholder={
                  sourceTab === 'archetypes' ? activeNpc?.title ?? 'Keep template name' : activeMonster?.name ?? ''
                }
                className="min-h-8 resize-none"
              />
            </Field>
            {hasPlaces && (
              <Field label={`Where in ${world.name} (Required)`}>
                <WorldPlacePick
                  world={world.id}
                  value={place}
                  onChange={setPlace}
                  placeholder={`Choose a place in ${world.name}…`}
                />
              </Field>
            )}
            {(uses.length > 1 || (!hasPlaces && uses.length > 0)) && (
              <Field label={hasPlaces ? 'Map' : `Map in ${world.name} (Required)`}>
                <WorldMapUseSelect uses={uses} value={map} onChange={setMap} />
              </Field>
            )}
            <Field label="Faction">
              <FactionSelect value={chosenFaction} onChange={setFaction} />
            </Field>
            <Field label="Disposition">
              <Segmented value={disposition} onChange={setDisposition} options={DISPOSITION_OPTIONS} />
            </Field>
          </div>
        </div>

        <JoinFooter
          note={
            (hasPlaces ? !place : uses.length > 0 && !map)
              ? `Choose where in ${world.name} the stamped NPC(s) will exist.`
              : 'Stamped individuals live in the active Save with a full Game system; your Characters library stays untouched.'
          }
          busy={busy}
          onCancel={onClose}
        >
          {sourceTab === 'bestiary' && activeMonster && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void stampOrSaveMonster(activeMonster, 'template-archetype')}
              disabled={busy}
            >
              Save as Archetype
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (sourceTab === 'archetypes' && activeNpc) void stampFromArchetype(activeNpc)
              else if (sourceTab === 'bestiary' && activeMonster) void stampOrSaveMonster(activeMonster, 'stamp')
            }}
            disabled={
              busy ||
              (sourceTab === 'archetypes' ? !activeNpc : !activeMonster) ||
              (hasPlaces ? !place : uses.length > 0 && !map)
            }
          >
            {busy ? 'Stamping…' : `Stamp ×${count}`}
          </Button>
        </JoinFooter>
      </div>
    </div>
  )
}

function LibraryCharacterPane({
  world,
  uses,
  initialPlace,
  onClose,
  onAdded
}: {
  world: WorldMeta
  uses: WorldMapUse[]
  initialPlace: string | null
  onClose: () => void
  onAdded: (actorId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [place, setPlace] = useState<string | null>(initialPlace)
  const [map, setMap] = useState(uses[0]?.map ?? '')
  const [faction, setFaction] = useState<string | null | undefined>(undefined)
  const [copyMode, setCopyMode] = useState<'unique' | 'archetype'>('unique')
  const [busy, setBusy] = useState(false)

  const places = usePlaceRecords(world.id)
  const hasPlaces = Object.keys(places).length > 0
  const hits = useLibraryFind(query, 'sheet', 200)
  const list = hits ?? []
  const inWorld = useMemo(() => new Set(uses.flatMap((u) => Object.keys(u.stand))), [uses])
  const active: LibraryHit | null =
    list.find((h) => h.id === picked) ?? list.find((h) => !inWorld.has(h.id)) ?? list[0] ?? null
  const keys = listKeys(list, active, (h) => setPicked(h.id))
  const needsLocation = hasPlaces ? !place : uses.length > 0 && !map
  const copyNeedsLocation = copyMode !== 'archetype' && needsLocation

  const enterAsCharacter = async () => {
    if (!active) return
    setBusy(true)
    try {
      const targetMap = map || uses[0]?.map || null
      await joinWorld(
        world,
        active.id,
        active.title,
        targetMap,
        faction !== undefined ? { from: null, to: faction } : undefined
      )
      if (place && targetMap) {
        await engine('worlds.moveCharacter', { sheet: active.id, world: world.id, map: targetMap, place })
      }
      onAdded(active.id)
      onClose()
    } catch (err) {
      failed('Could not bring character into world')(err)
    } finally {
      setBusy(false)
    }
  }

  const copyIntoWorldAsNpc = async () => {
    if (!active) return
    setBusy(true)
    try {
      const created = await engine('npcs.copyFromSheet', {
        world: world.id,
        sheet: active.id,
        archetype: copyMode === 'archetype',
        place: copyMode === 'archetype' ? null : place,
        map: copyMode === 'archetype' ? null : map || uses[0]?.map || null,
        faction: faction !== undefined ? faction : undefined
      })
      const actorId = npcActorId(world.id, created.id)
      toast.success(
        copyMode === 'archetype' ? 'Copied as World Archetype' : 'Copied as World NPC',
        `${showName(created.title)} was copied into ${world.name}; the standalone sheet remains independent.`
      )
      onAdded(actorId)
      onClose()
    } catch (err) {
      failed('Could not copy character into world as NPC')(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-[420px] grid-cols-1 gap-4 lg:grid-cols-12">
      <SearchListPanel
        query={query}
        onQuery={setQuery}
        placeholder="Search character sheets"
        count={hits === null ? 'Looking…' : `${list.length} sheets`}
        aside={`${inWorld.size} in world`}
        onKeyDown={keys}
        className="lg:col-span-5"
      >
        {list.map((h) => (
          <ListRow
            key={h.id}
            active={active?.id === h.id}
            onClick={() => setPicked(h.id)}
            onMenu={(e) => entryMenuAt(e, 'sheet', h.id, h.title)}
            title={showName(h.title)}
            subtitle={hitDetail(h)}
            meta={inWorld.has(h.id) ? 'In world' : undefined}
          />
        ))}
        {hits !== null && !list.length && (
          <EmptyState title={query ? 'No match' : 'No character sheets'}>
            {query ? 'Try another name.' : 'Create standalone sheets in Characters, or make a New World NPC here.'}
          </EmptyState>
        )}
      </SearchListPanel>

      {active ? (
        <div className="flex flex-col justify-between gap-4 border border-line/60 tone-panel-50 p-4 lg:col-span-7">
          <div className="flex flex-col gap-4">
            <div className="border-b border-line/40 pb-3">
              <div className="text-[15px] font-bold text-ink">{showName(active.title)}</div>
              <p className="mt-0.5 text-[12px] text-dim">
                Enter as the linked standalone sheet, or clone an independent World NPC copy into {world.name}.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {hasPlaces && (
                <Field label={`Starting Place${copyMode === 'archetype' ? ' (for Enter)' : ' (Required)'}`}>
                  <WorldPlacePick
                    world={world.id}
                    value={place}
                    onChange={setPlace}
                    placeholder={`Choose a place in ${world.name}…`}
                  />
                </Field>
              )}
              {(uses.length > 1 || (!hasPlaces && uses.length > 0)) && (
                <Field label={hasPlaces ? 'Map' : 'Starting Map (Required)'}>
                  <WorldMapUseSelect uses={uses} value={map} onChange={setMap} />
                </Field>
              )}
              <Field label="Faction Override">
                <FactionSelect value={faction ?? null} onChange={setFaction} />
              </Field>
              <Field label="Copy Target">
                <Segmented
                  value={copyMode}
                  onChange={setCopyMode}
                  options={[
                    { value: 'unique', label: 'Unique NPC' },
                    { value: 'archetype', label: 'Archetype' }
                  ]}
                />
              </Field>
            </div>
          </div>

          <JoinFooter
            note={
              needsLocation
                ? `Choose where in ${world.name} they will start.`
                : 'Enter as Character links the live sheet with a Game system; Copy creates a decoupled World NPC.'
            }
            busy={busy}
            onCancel={onClose}
          >
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void copyIntoWorldAsNpc()}
              disabled={busy || copyNeedsLocation}
            >
              Copy as {copyMode === 'archetype' ? 'Archetype' : 'World NPC'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => void enterAsCharacter()}
              disabled={busy || inWorld.has(active.id) || needsLocation}
            >
              {inWorld.has(active.id) ? 'Already in World' : 'Enter as Character'}
            </Button>
          </JoinFooter>
        </div>
      ) : (
        <div className="flex items-center justify-center border border-line/60 tone-panel-50 lg:col-span-7">
          <EmptyState title="Pick a character sheet" />
        </div>
      )}
    </div>
  )
}
