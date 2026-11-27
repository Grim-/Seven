import { useState } from 'react'
import { ArrowRight, Eye, Plus, Trash2, UserPlus } from 'lucide-react'
import { localPlaceMermaid, placeBreadcrumbNames, placePath } from '@shared/maps'
import { PLACE_TYPE_KEY, type WorldEntity, type WorldEntry } from '@shared/world'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { Button, EmptyState, Eyebrow, Field, Input, Popover, Select, confirmDelete, openMenu } from '../ui'
import { PlayList } from '../play/PlayList'
import { placePlay } from '../play/playHolder'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { CharacterRow } from '../maps/CharacterRow'
import { characterItems, setWhere } from '../maps/placeActions'
import { usePresence } from '../maps/usePresence'
import { usePlaceRecords, useRegionRecords } from '../maps/usePlaceRecords'
import { ObjectPlayManager } from '../maps/ObjectPlayManager'
import { EntryPicker } from '../library/EntryPicker'
import { LinkTextarea } from '../data/LinkTextarea'
import { PlaceEvents } from '../worldEvents/PlaceEvents'
import { ZoneMapCanvas, centerOfForm } from './ZoneMapStage'

function normalizeExits(raw: unknown): WorldEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((e) => {
      if (typeof e === 'string') return { text: e, ref: null, locked: false }
      if (!e || typeof e !== 'object') return null
      const r = e as { text?: unknown; ref?: unknown; locked?: unknown }
      return {
        text: typeof r.text === 'string' ? r.text : '',
        ref: typeof r.ref === 'string' && r.ref ? r.ref : null,
        locked: r.locked === true
      }
    })
    .filter((e): e is WorldEntry => e !== null && (Boolean(e.text) || Boolean(e.ref)))
}

export function PlaceEditor({
  world,
  placeKey,
  onDeleted
}: {
  world: string
  placeKey: string
  onOpenMap?: (mapId: string) => void
  onDeleted?: () => void
}) {
  const places = usePlaceRecords(world)
  const regions = useRegionRecords(world)
  const mapUses = useLive(() => engine('worlds.maps', { id: world }), 'worlds.changed') ?? []
  const mapList = useLive(() => engine('maps.list'), 'maps.changed') ?? []
  const hereMap = usePresence(world)
  const player = useWorldPlayer(world)
  const [newExitLabel, setNewExitLabel] = useState('')
  const [newExitTarget, setNewExitTarget] = useState('')
  const [targetMapId, setTargetMapId] = useState('')
  const active = places[placeKey]
  if (!active) return null
  const keys = Object.keys(places)
  const mapNameOf = (id: string) => mapList.find((m) => m.id === id)?.name ?? id

  const activeMapUse =
    mapUses.find((u) => Boolean(u.shapes[placeKey])) ??
    mapUses.find((u) => u.map === targetMapId) ??
    mapUses[0] ??
    null
  const activeForm = activeMapUse ? (activeMapUse.shapes[placeKey] ?? null) : null
  const activeSpawn = activeMapUse ? (activeMapUse.spawns?.[placeKey] ?? (activeForm ? centerOfForm(activeForm) : null)) : null

  const updateField = (key: string, patch: WorldEntity) => {
    void engine('worlds.put', { id: world, type: PLACE_TYPE_KEY, key, entity: patch }).catch(failed('Could not save place'))
  }

  const handleDelete = (key: string) => {
    const label = String(places[key]?.Name || key)
    confirmDelete(`Delete "${label}"?`, 'Places inside it will move up one level, and its zone and spawn point will be removed from maps.', () =>
      engine('worlds.remove', { id: world, type: PLACE_TYPE_KEY, key }).then(() => onDeleted?.())
    )
  }

  const exits = normalizeExits(active.Exits)
  const here = hereMap[placeKey] ?? []
  const mermaid = localPlaceMermaid(places, placeKey)
  const parentOptions = [
    { value: '', label: '— Not inside another place —' },
    ...keys
      .filter((k) => k !== placeKey)
      .map((k) => ({
        value: k,
        label: placePath(places, k)
          .map((p) => String(places[p]?.Name || p))
          .join(' › ')
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ]
  const regionOptions = [
    { value: '', label: '— Select region —' },
    ...Object.entries(regions)
      .map(([k, r]) => ({ value: k, label: String(r.Name || k) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  ]

  const addExit = () => {
    const label = newExitLabel.trim() || 'door'
    const ref = newExitTarget.trim() || null
    updateField(placeKey, { Exits: [...exits, { text: label, ref, locked: false }] })
    setNewExitLabel('')
    setNewExitTarget('')
  }

  const removeExit = (idx: number) => updateField(placeKey, { Exits: exits.filter((_, i) => i !== idx) })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-start justify-between gap-3 border-b border-line/50 pb-3">
        <div>
          <div className="font-ui text-[10.5px] text-dim">
            {placeBreadcrumbNames(places, regions, placeKey).join(' › ')} · <span className="text-secondary-ink">@world:{world}/place/{placeKey}</span>
          </div>
          <h2 className="mt-0.5 text-[17px] font-semibold text-ink">{String(active.Name || placeKey)}</h2>
        </div>
        <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => handleDelete(placeKey)}>
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="Name" className="sm:col-span-2">
          <Input value={String(active.Name ?? '')} onChange={(e) => updateField(placeKey, { Name: e.target.value })} />
        </Field>
        <Field label="Region / Area">
          <Select
            value={typeof active.Region === 'string' ? active.Region : ''}
            options={regionOptions}
            onChange={(v) => updateField(placeKey, { Region: v || null })}
          />
        </Field>
        <Field label="Inside (Parent Place)">
          <Select
            value={typeof active.Inside === 'string' ? active.Inside : ''}
            options={parentOptions}
            onChange={(v) => updateField(placeKey, { Inside: v || null })}
          />
        </Field>
      </div>

      {mapUses.length > 1 && activeMapUse && (
        <div className="max-w-xs">
          <Field label="Map">
            <Select
              value={activeMapUse.map}
              options={mapUses.map((u) => ({ value: u.map, label: mapNameOf(u.map) }))}
              onChange={setTargetMapId}
            />
          </Field>
        </div>
      )}

      {activeMapUse ? (
        <ZoneMapCanvas
          world={world}
          use={activeMapUse}
          places={places}
          regions={regions}
          targetKind="place"
          targetKey={placeKey}
          targetLabel={String(active.Name || placeKey)}
          form={activeForm}
          onFormChange={(nextForm) => {
            const nextSpawn = activeMapUse.spawns?.[placeKey] ?? centerOfForm(nextForm)
            void engine('worlds.saveMapUse', {
              id: world,
              use: {
                ...activeMapUse,
                shapes: { ...activeMapUse.shapes, [placeKey]: nextForm },
                spawns: { ...(activeMapUse.spawns ?? {}), [placeKey]: nextSpawn }
              }
            }).catch(failed('Could not save place zone'))
          }}
          spawn={activeSpawn}
          onSpawnChange={(nextSpawn) => {
            void engine('worlds.saveMapUse', {
              id: world,
              use: { ...activeMapUse, spawns: { ...(activeMapUse.spawns ?? {}), [placeKey]: nextSpawn } }
            }).catch(failed('Could not save spawn point'))
          }}
        />
      ) : (
        <EmptyState title="Attach a map first">Attach a map to this world so this place has a zone and character spawn point.</EmptyState>
      )}

      <Field label="Looks (Visual Description)">
        <LinkTextarea
          rolls={false}
          value={String(active.Looks ?? '')}
          onValue={(v) => updateField(placeKey, { Looks: v })}
          rows={3}
          placeholder="Lighting, architecture, materials, atmosphere at a glance..."
        />
      </Field>

      <Field label="Now (Current Scene State)">
        <LinkTextarea
          rolls={false}
          value={String(active.Now ?? '')}
          onValue={(v) => updateField(placeKey, { Now: v })}
          rows={2}
          placeholder="What is happening here right now..."
        />
      </Field>

      <PlaceEvents world={world} place={placeKey} />

      <div className="flex flex-col gap-2 border border-line/50 tone-surface-60 p-3">
        <div className="flex items-center justify-between">
          <Eyebrow>Exits (1-Hop Local Connections)</Eyebrow>
        </div>
        {exits.length === 0 ? (
          <div className="text-[12px] text-faint">No exits defined yet. Add doorways, passages, or paths leading directly from here.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {exits.map((ex, idx) => (
              <div key={idx} className="flex items-center gap-2 border border-line/40 tone-card-40 px-2.5 py-1.5 text-[12px]">
                <input
                  value={ex.text}
                  onChange={(e) => {
                    const next = [...exits]
                    next[idx] = { ...ex, text: e.target.value }
                    updateField(placeKey, { Exits: next })
                  }}
                  className="min-w-0 flex-1 bg-transparent text-ink outline-none"
                  placeholder="Exit description (e.g. heavy oak door)"
                />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-dim" />
                <Select
                  value={ex.ref ?? ''}
                  options={[
                    { value: '', label: '— Unlinked —' },
                    ...keys
                      .filter((k) => k !== placeKey)
                      .map((k) => ({ value: k, label: String(places[k]?.Name || k) }))
                  ]}
                  onChange={(v) => {
                    const next = [...exits]
                    next[idx] = { ...ex, ref: v || null }
                    updateField(placeKey, { Exits: next })
                  }}
                  className="w-44"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = [...exits]
                    next[idx] = { ...ex, locked: !ex.locked }
                    updateField(placeKey, { Exits: next })
                  }}
                  className={
                    ex.locked
                      ? 'border border-alert/40 bg-alert/15 px-1.5 py-0.5 font-ui text-[9.5px] text-alert'
                      : 'border border-line/40 px-1.5 py-0.5 font-ui text-[9.5px] text-dim hover:text-ink'
                  }
                >
                  {ex.locked ? 'LOCKED' : 'OPEN'}
                </button>
                <button type="button" onClick={() => removeExit(idx)} className="text-dim hover:text-alert">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2">
          <Input
            value={newExitLabel}
            onChange={(e) => setNewExitLabel(e.target.value)}
            placeholder="New exit label (e.g. stone archway)"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && addExit()}
          />
          <Select
            value={newExitTarget}
            options={[
              { value: '', label: '— Target Place —' },
              ...keys
                .filter((k) => k !== placeKey)
                .map((k) => ({ value: k, label: String(places[k]?.Name || k) }))
            ]}
            onChange={setNewExitTarget}
            className="w-44"
          />
          <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={addExit}>
            Add Exit
          </Button>
        </div>
      </div>

      {mermaid && (
        <div className="flex flex-col gap-1.5 border border-line/40 tone-panel-40 p-3">
          <div className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5 text-secondary-ink" />
            <Eyebrow>Agent Local Topology Preview (1-Hop)</Eyebrow>
          </div>
          <pre className="overflow-x-auto font-ui text-[11px] text-dim">{mermaid}</pre>
        </div>
      )}

      <div className="flex flex-col gap-2 border border-line/50 tone-surface-60 p-3">
        <div className="flex items-center justify-between">
          <Eyebrow>Characters Here ({here.length})</Eyebrow>
          <Popover
            trigger={
              <span className="inline-flex items-center gap-1 font-ui text-[10.5px] text-accent hover:text-ink">
                <UserPlus className="h-3 w-3" /> Place Character
              </span>
            }
            title="Place character here"
          >
            {(close) => (
              <EntryPicker
                kind="sheet"
                title="Place character here"
                inline
                onClose={close}
                onPick={(hit) => {
                  void setWhere(hit.id, placeKey, world).catch(failed('Could not place character'))
                  close()
                }}
              />
            )}
          </Popover>
        </div>
        {here.length === 0 ? (
          <div className="text-[12px] text-faint">Nobody is currently at this place.</div>
        ) : (
          <div className="flex flex-col gap-1">
            {here.map((v) => (
              <CharacterRow
                key={v.sheet}
                visitor={v}
                onMenu={(e) => openMenu(e, v.name, characterItems(v, places, placeKey, world))}
              />
            ))}
          </div>
        )}
      </div>

      <Field label="Files & Linked Assets">
        <LinkTextarea
          rolls={false}
          value={String(active.Files ?? '')}
          onValue={(v) => updateField(placeKey, { Files: v })}
          rows={2}
          placeholder="@page:notes @sheet:innkeeper"
        />
      </Field>

      <PlayList play={placePlay(world, placeKey, active, player, here.flatMap((v) => (v.agent ? [v.agent] : [])))} />
      <ObjectPlayManager
        world={world}
        character={player}
        actionsText={String(active.Actions ?? '')}
        decisionsText={String(active.Decisions ?? '')}
        onChangeActions={(Actions) => updateField(placeKey, { Actions })}
        onChangeDecisions={(Decisions) => updateField(placeKey, { Decisions })}
      />
    </div>
  )
}
