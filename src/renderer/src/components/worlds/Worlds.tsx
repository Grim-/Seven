import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Play, Plus, Trash2 } from 'lucide-react'
import { inspectSchema, type WorldBinding, type WorldMeta, type WorldSchema } from '@shared/world'
import { engine, on } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { errorText, formatRelative } from '../../lib/format'
import { Button, EmptyState, Field, Input, Panel, SaveState, Select, TagInput, askText, useAutosavedState, confirmDelete } from '../ui'
import { entryMenuAt } from '../../views/data/entryMenu'
import { cn } from '../../lib/cn'
import { WorldBoard } from './Board'
import { SchemaEditor } from './SchemaEditor'
import { WorldMaps } from '../maps/WorldMaps'
import { WorldEntities } from './WorldEntities'
import { WorldOpening } from './WorldOpening'
import { WorldPlaces } from './WorldPlaces'
import { useApp } from '../../store/app'
import { useTools } from '../../store/tools'
import { setWhere } from '../maps/placeActions'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { ShellTabs } from '../ui'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'

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
  const autosave = useAutosavedState<string>('', (t) => engine('worlds.saveSchema', { id: world.id, schema: JSON.parse(t) as WorldSchema }), { when: valid })
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
  const check = parsed.schema ? inspectSchema(parsed.schema) : { errors: [parsed.error ?? 'Not valid JSON'], warnings: [] }
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => autosave.set(e.target.value)}
        spellCheck={false}
        className="min-h-64 flex-1 resize-none border border-line/60 bg-black/60 p-3 font-mono text-[12px] leading-relaxed text-white"
      />
      <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto font-mono text-[11.5px]">
        {check.errors.map((e) => (
          <div key={e} className="text-alert">✕ {e}</div>
        ))}
        {check.warnings.map((w) => (
          <div key={w} className="text-accent-soft">! {w}</div>
        ))}
        {!check.errors.length && !check.warnings.length && <div className="text-ok">✓ No problems</div>}
      </div>
      <div className="flex justify-end">
        <SaveState status={autosave.status} error={autosave.error} blocked={check.errors[0] ?? null} />
      </div>
    </div>
  )
}

export function WorldsPanel({ initial = null }: { initial?: string | null }) {
  const list = useWorlds()
  const playEnabled = useTools((s) => s.list.some((m) => m.id === 'play' && m.state === 'on'))
  const [first, firstType, firstKey] = (initial ?? '').split('/')
  const [selected, setSelected] = useState<string | null>(first || null)
  const [tab, setTab] = useState<'maps' | 'places' | 'entities' | 'board' | 'opening' | 'schema'>(
    first && firstType === 'place' ? 'places' : first && firstType ? 'entities' : 'maps'
  )
  const [schemaMode, setSchemaMode] = useState<'visual' | 'json'>('visual')
  const [schema, setSchema] = useState<WorldSchema | null>(null)
  const world = list.find((w) => w.id === selected) ?? list[0] ?? null
  useEffect(() => {
    if (!world) return setSchema(null)
    void engine('worlds.schema', { id: world.id })
      .then(setSchema)
      .catch((err) => {
        setSchema(null)
        failed('Could not read the world')(err)
      })
  }, [world?.id, world?.updatedAt])
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
      .then((list) => {
        const n = list.saves.length
        confirmDelete(`Delete ${w.name}?`, `Every record goes with it${n ? `, and its ${n === 1 ? 'save' : `${n} saves`}: their characters leave first, taking their state onto their sheets` : ''}. Agents linked to it lose their place.`, () => engine('worlds.delete', { id: w.id }))
      })
      .catch(failed('Could not read its saves'))
  return (
    <Panel
      className="min-w-0 flex-1"
      title="World Editor"
      actions={
        <Button size="sm" variant="badge" icon={<Plus />} onClick={create}>
          New world
        </Button>
      }
      bodyClassName="flex min-h-0 flex-col gap-3 p-3"
    >
      {!list.length ? (
        <EmptyState title="No worlds yet">A world holds records (characters, places, anything your schema defines) and a shared board. Agents linked to a record live in it.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {list.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelected(w.id)}
                onContextMenu={(e) =>
                  entryMenuAt(e, 'world', w.id, w.name, [
                    { label: 'Open', icon: <FolderOpen />, onSelect: () => setSelected(w.id) },
                    { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => remove(w) }
                  ])
                }
                className={cn('border px-3 py-1.5 text-left', world?.id === w.id ? 'border-accent bg-accent/10' : 'border-line/50 hover:border-line')}
              >
                <div className="text-[13px] text-white">{w.name}</div>
                <div className="font-mono text-[10px] text-faint">
                  {w.types.map((t) => `${t.count} ${t.plural}`).join(' · ')} · {w.posts} posts
                  {w.tags.length > 0 && ` · ${w.tags.map((t) => `#${t}`).join(' ')}`}
                </div>
              </button>
            ))}
          </div>
          {world && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center gap-2">
                <ShellTabs
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'maps', label: 'Maps' },
                    { value: 'places', label: 'Places' },
                    { value: 'entities', label: 'Entities & Lore' },
                    { value: 'board', label: `Board ${world.posts}` },
                    { value: 'opening', label: 'Opening' },
                    { value: 'schema', label: 'Schema' }
                  ]}
                />
                <span className="font-mono text-[10px] text-faint">{world.updatedAt ? `changed ${formatRelative(world.updatedAt)}` : ''}</span>
                <span className="ml-auto" />
                <span className="w-56" title="Tags for this world, such as fantasy or story-world">
                  <TagInput value={world.tags} suggestions={[...new Set(list.flatMap((w) => w.tags))]} onChange={(tags) => void engine('worlds.setTags', { id: world.id, tags }).catch(failed('Could not save the tags'))} />
                </span>
                <span className="flex items-center gap-1.5" title="Rolls you make in this world are for this character unless you pick another">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Your character</span>
                  <SheetSelect value={world.player} onChange={(sheet) => void engine('worlds.setPlayer', { id: world.id, sheet }).catch(failed('Could not set your character'))} className="h-7 w-40 text-[12px]" />
                </span>
                {playEnabled && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Play className="h-3.5 w-3.5" />}
                    onClick={() => {
                      useApp.getState().setView('play')
                    }}
                    title="Switch to Play mode to play this world"
                  >
                    Play World
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => remove(world)}>
                  Delete world
                </Button>
              </div>
              {tab === 'maps' && (
                <WorldMaps
                  key={world.id}
                  worldId={world.id}
                  onStart={(place) => {
                    const player = world.player
                    if (!player) return toast.info('No active player', 'Select or create a character first.')
                    void setWhere(player, place)
                      .then(() => {
                        if (playEnabled) {
                          toast.success('Starting location set', 'Character is ready. Entering Play mode...')
                          useApp.getState().setView('play')
                        } else {
                          toast.success('Starting location set', 'Character starting place updated.')
                        }
                      })
                      .catch(failed('Could not start there'))
                  }}
                />
              )}
              {tab === 'places' && <WorldPlaces key={world.id} world={world} initialKey={world.id === first && firstType === 'place' ? firstKey : undefined} />}
              {tab === 'entities' && (
                <WorldEntities
                  key={world.id}
                  world={world}
                  schema={schema}
                  initialType={world.id === first ? firstType : undefined}
                  initialKey={world.id === first ? firstKey : undefined}
                />
              )}
              {tab === 'board' && <WorldBoard key={world.id} worldId={world.id} />}
              {tab === 'opening' && <WorldOpening key={world.id} world={world} />}
              {tab === 'schema' && (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <ShellTabs value={schemaMode} onChange={setSchemaMode} options={[{ value: 'visual', label: 'Visual' }, { value: 'json', label: 'JSON' }]} />
                  {schemaMode === 'visual' ? <SchemaEditor key={world.id} worldId={world.id} /> : <SchemaJson key={world.id} world={world} />}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  )
}

export function WorldLink({ value, onChange, agentName }: { value: WorldBinding | null | undefined; onChange: (v: WorldBinding | null) => void; agentName: string }) {
  const list = useWorlds()
  const world = list.find((w) => w.id === value?.worldId) ?? null
  const [ids, setIds] = useState<string[]>([])
  const type = value?.type ?? world?.types[0]?.key ?? ''
  useEffect(() => {
    if (!world || !type) return setIds([])
    void engine('worlds.records', { id: world.id, type })
      .then((r) => setIds(Object.keys(r)))
      .catch(noteFailure('worlds', 'Could not list the records', () => setIds([])))
  }, [world?.id, type, world?.updatedAt])
  const id = value?.id ?? ''
  const missing = !!world && !!id && !ids.includes(id)
  const createRecord = async () => {
    if (!world || !value) return
    try {
      const schema = await engine('worlds.schema', { id: world.id })
      const label = schema.types[value.type]?.label
      await engine('worlds.put', { id: world.id, type: value.type, key: value.id, entity: label ? { [label]: agentName } : {} })
      toast.success('Record created', `${value.type} "${value.id}"`)
    } catch (err) {
      toast.error('Could not create the record', errorText(err))
    }
  }
  return (
    <Field label="World" className="col-span-2" hint="The record this agent is in its world. It can read every record, but only change its own.">
      <div className="grid grid-cols-3 gap-2">
        <Select
          value={value?.worldId ?? ''}
          options={[{ value: '', label: 'Not in a world' }, ...list.map((w) => ({ value: w.id, label: w.name }))]}
          onChange={(v) => {
            const w = list.find((x) => x.id === v)
            onChange(w ? { worldId: w.id, type: w.types[0]?.key ?? '', id: id || agentName.trim().toLowerCase().replace(/\s+/g, '_') } : null)
          }}
        />
        <Select
          value={type}
          options={(world?.types ?? []).map((t) => ({ value: t.key, label: t.key }))}
          onChange={(v) => value && onChange({ ...value, type: v })}
        />
        <Input list="world-record-ids" value={id} placeholder="record id" onChange={(e) => value && onChange({ ...value, id: e.target.value.trim().toLowerCase() })} />
        <datalist id="world-record-ids">
          {ids.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </div>
      {missing && (
        <div className="mt-1.5 flex items-center gap-2 text-[12px] text-accent-soft">
          There is no {type} "{id}" yet; the agent's first world_remember will create it.
          <Button size="sm" variant="ghost" onClick={() => void createRecord()}>
            Create it now
          </Button>
        </div>
      )}
    </Field>
  )
}
