import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { inspectSchema, type WorldBinding, type WorldMeta, type WorldSchema } from '@shared/world'
import { engine, on } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { errorText, formatRelative } from '../../lib/format'
import { Button, EmptyState, Field, Input, LoadingScreen, Panel, SaveState, Select, askText, useAutosavedState, confirmDelete } from '../ui'
import { entryMenuAt } from '../../views/data/entryMenu'
import { cn } from '../../lib/cn'
import { WorldRecords } from './Records'
import { WorldBoard } from './Board'
import { SchemaEditor } from './SchemaEditor'
import { WorldMaps } from '../maps/WorldMaps'
import { WorldPlay } from './WorldPlay'
import { setWhere } from '../maps/placeActions'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { ShellTabs } from '../ui'
import { failed } from '../../lib/notify'

export function useWorlds(): WorldMeta[] {
  const [list, setList] = useState<WorldMeta[]>([])
  useEffect(() => {
    const load = () =>
      void engine('worlds.list')
        .then(setList)
        .catch(() => undefined)
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
  const [first, firstType, firstKey] = (initial ?? '').split('/')
  const [selected, setSelected] = useState<string | null>(first || null)
  const [tab, setTab] = useState<'play' | 'records' | 'maps' | 'board' | 'schema'>(first && firstType ? 'records' : 'play')
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
    confirmDelete(`Delete ${w.name}?`, 'Every record and the board go with it. Agents linked to it lose their place.', () => engine('worlds.delete', { id: w.id }))
  return (
    <Panel
      className="min-w-0 flex-1"
      title="Worlds"
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
                    { value: 'play', label: 'Play' },
                    { value: 'records', label: 'Records' },
                    { value: 'maps', label: 'Maps' },
                    { value: 'board', label: `Board ${world.posts}` },
                    { value: 'schema', label: 'Schema' }
                  ]}
                />
                <span className="font-mono text-[10px] text-faint">{world.updatedAt ? `changed ${formatRelative(world.updatedAt)}` : ''}</span>
                <span className="ml-auto flex items-center gap-1.5" title="Rolls you make in this world are for this character unless you pick another">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Your character</span>
                  <SheetSelect value={world.player} onChange={(sheet) => void engine('worlds.setPlayer', { id: world.id, sheet }).catch(failed('Could not set your character'))} className="h-7 w-40 text-[12px]" />
                </span>
                <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => remove(world)}>
                  Delete world
                </Button>
              </div>
              {tab === 'records' && !schema && <LoadingScreen title={world.name} steps={[{ label: 'Records', done: false }]} />}
              {tab === 'records' && schema && <WorldRecords key={world.id} worldId={world.id} schema={schema} initialType={world.id === first ? firstType : undefined} initialKey={world.id === first ? firstKey : undefined} />}
              {tab === 'play' && <WorldPlay key={world.id} world={world.id} />}
              {tab === 'maps' && (
                <WorldMaps
                  key={world.id}
                  worldId={world.id}
                  onStart={(place) => {
                    if (!world.player) return
                    void setWhere(world.player, place).then(() => setTab('play'), failed('Could not start there'))
                  }}
                />
              )}
              {tab === 'board' && <WorldBoard key={world.id} worldId={world.id} />}
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
      .catch(() => setIds([]))
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
