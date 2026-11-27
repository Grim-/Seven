import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import {
  WORLD_COLUMNS,
  WORLD_DISPLAY_AS,
  WORLD_KINDS,
  WORLD_LAYOUTS,
  WORLD_LOCKS,
  inspectSchema,
  type WorldDisplayAs,
  type WorldField,
  type WorldFieldKind,
  type WorldMapSub,
  type WorldSchema,
  type WorldType
} from '@shared/world'
import { engine } from '../../lib/ipc'
import { Button, Field, Input, SaveState, Select, ShellTabs, Toggle, askText, useAutosavedState, ListRow } from '../ui'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'

type Tab = 'fields' | 'type' | 'display' | 'backrefs'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const opts = (list: readonly string[], blank?: string) => [...(blank !== undefined ? [{ value: '', label: blank }] : []), ...list.map((v) => ({ value: v, label: v }))]

function moveKey<T>(obj: Record<string, T>, key: string, delta: number): Record<string, T> {
  const keys = Object.keys(obj)
  const i = keys.indexOf(key)
  const j = i + delta
  if (i < 0 || j < 0 || j >= keys.length) return obj
  ;[keys[i], keys[j]] = [keys[j], keys[i]]
  return Object.fromEntries(keys.map((k) => [k, obj[k]]))
}

function renameKey<T>(obj: Record<string, T>, from: string, to: string): Record<string, T> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]))
}

function newField(kind: WorldFieldKind): WorldField {
  switch (kind) {
    case 'enum':
      return { kind, values: ['first', 'second'] }
    case 'ref':
    case 'refs':
      return { kind, to: '', resolve: true }
    case 'map':
      return { kind, keyNoun: 'target', value: { affinity: { kind: 'number', default: 0, min: -100, max: 100 } } }
    default:
      return { kind }
  }
}

function newType(): WorldType {
  return {
    noun: 'thing',
    plural: 'things',
    label: 'Name',
    describe: '',
    fields: { Name: { kind: 'text', lock: 'create_only', describe: 'The canonical name.' } },
    display: { accent: '#4ee1ff', glyph: '◈', groups: [] }
  }
}

function NumberInput({ value, onChange, placeholder }: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string }) {
  return <Input type="number" value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
}

function FieldForm({ schema, typeKey, name, f, onChange, onRename }: { schema: WorldSchema; typeKey: string; name: string; f: WorldField; onChange: (f: WorldField) => void; onRename: (to: string) => void }) {
  const types = Object.keys(schema.types)
  const groups = schema.types[typeKey].display?.groups ?? []
  const set = (patch: Partial<WorldField>) => onChange({ ...f, ...patch })
  const setDisplay = (patch: Partial<NonNullable<WorldField['display']>>) => set({ display: Object.fromEntries(Object.entries({ ...f.display, ...patch }).filter(([, v]) => v !== undefined && v !== '')) })
  const subs = Object.entries(f.value ?? {})
  const setSub = (key: string, sub: WorldMapSub | null, rename?: string) => {
    let value = { ...(f.value ?? {}) }
    if (sub === null) delete value[key]
    else value[key] = sub
    if (rename && rename !== key) value = renameKey(value, key, rename)
    set({ value })
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Name">
        <Input key={name} defaultValue={name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== name && onRename(e.target.value.trim())} />
      </Field>
      <Field label="Kind">
        <Select value={f.kind} options={opts(WORLD_KINDS)} onChange={(k) => onChange({ ...newField(k as WorldFieldKind), describe: f.describe, lock: f.lock, visible: f.visible, display: f.display, formerly: f.formerly })} />
      </Field>
      <Field label="Description" className="col-span-2" hint="The model sees this; say what goes in the field.">
        <Input value={f.describe ?? ''} onChange={(e) => set({ describe: e.target.value })} />
      </Field>
      <Field label="Agents may">
        <Select
          value={f.lock ?? 'open'}
          options={WORLD_LOCKS.map((l) => ({ value: l, label: l === 'open' ? 'Change it freely' : l === 'create_only' ? 'Set it once, at creation' : l === 'append_only' ? 'Only add entries' : 'Never change it (fixed)' }))}
          onChange={(v) => set({ lock: v === 'open' ? undefined : (v as WorldField['lock']) })}
        />
      </Field>
      <Field label="Seen by agents">
        <Toggle checked={f.visible !== false} onChange={(v) => set({ visible: v ? undefined : false })} label={f.visible === false ? 'Hidden (author only)' : 'Visible'} />
      </Field>
      {(f.kind === 'text' || f.kind === 'enum') && (
        <Field label="Default">
          <Input value={String(f.default ?? '')} onChange={(e) => set({ default: e.target.value || undefined })} />
        </Field>
      )}
      {f.kind === 'number' && (
        <Field label="Default, min, max">
          <div className="grid grid-cols-3 gap-1.5">
            <NumberInput value={typeof f.default === 'number' ? f.default : undefined} onChange={(v) => set({ default: v })} placeholder="0" />
            <NumberInput value={f.min} onChange={(v) => set({ min: v })} placeholder="min" />
            <NumberInput value={f.max} onChange={(v) => set({ max: v })} placeholder="max" />
          </div>
        </Field>
      )}
      {f.kind === 'enum' && (
        <Field label="Values" className="col-span-2" hint="Comma separated.">
          <Input value={(f.values ?? []).join(', ')} onChange={(e) => set({ values: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
        </Field>
      )}
      {(f.kind === 'ref' || f.kind === 'refs') && (
        <>
          <Field label="Points to">
            <Select value={f.to ?? ''} options={opts(types, 'Choose a type')} onChange={(v) => set({ to: v })} />
          </Field>
          <Field label="Show the target's name">
            <Toggle checked={f.resolve === true} onChange={(v) => set({ resolve: v || undefined })} />
          </Field>
        </>
      )}
      {(f.kind === 'list' || f.kind === 'log') && (
        <>
          <Field label="Entries link to">
            <Select value={f.entryRef?.to ?? ''} options={opts(types, 'Nothing')} onChange={(v) => set({ entryRef: v ? { to: v, resolve: true } : undefined })} />
          </Field>
          {f.kind === 'log' && (
            <Field label="Weighted 1-10">
              <Toggle checked={f.weighted === true} onChange={(v) => set({ weighted: v || undefined })} />
            </Field>
          )}
        </>
      )}
      {f.kind === 'map' && (
        <>
          <Field label="Keyed by" hint="What each entry is about, e.g. character.">
            <Input value={f.keyNoun ?? ''} onChange={(e) => set({ keyNoun: e.target.value })} />
          </Field>
          <div />
          <div className="col-span-2 flex flex-col gap-1.5">
            <div className="font-label text-[10.5px] caps-14 text-accent-soft">Values kept per entry</div>
            {subs.map(([k, s]) => (
              <div key={k} className="grid grid-cols-[8rem_6rem_1fr_1fr_1fr_auto] items-center gap-1.5">
                <Input defaultValue={k} onBlur={(e) => e.target.value.trim() && setSub(k, s, e.target.value.trim())} />
                <Select value={s.kind} options={opts(['number', 'text'])} onChange={(v) => setSub(k, { ...s, kind: v as 'number' | 'text' })} />
                {s.kind === 'number' ? (
                  <>
                    <NumberInput value={typeof s.default === 'number' ? s.default : undefined} onChange={(v) => setSub(k, { ...s, default: v })} placeholder="default" />
                    <NumberInput value={s.min} onChange={(v) => setSub(k, { ...s, min: v })} placeholder="min" />
                    <NumberInput value={s.max} onChange={(v) => setSub(k, { ...s, max: v })} placeholder="max" />
                  </>
                ) : (
                  <div className="col-span-3">
                    <Input value={s.describe ?? ''} placeholder="description" onChange={(e) => setSub(k, { ...s, describe: e.target.value })} />
                  </div>
                )}
                <button onClick={() => setSub(k, null)} className="text-dim hover:text-alert">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => askText('New value', 'Name', '', (n) => void (n.trim() && setSub(n.trim(), { kind: 'number', default: 0 })))}>
              Add value
            </Button>
          </div>
        </>
      )}
      <Field label="Shown as">
        <Select value={f.display?.as ?? ''} options={opts(WORLD_DISPLAY_AS, 'Automatic')} onChange={(v) => setDisplay({ as: (v || undefined) as WorldDisplayAs | undefined })} />
      </Field>
      <Field label="Group">
        <Select value={f.display?.group ?? ''} options={[{ value: '', label: 'Record (default)' }, ...groups.map((g) => ({ value: g.id, label: g.label || g.id }))]} onChange={(v) => setDisplay({ group: v || undefined })} />
      </Field>
      <Field label="Order in group">
        <NumberInput value={f.display?.order} onChange={(v) => setDisplay({ order: v })} />
      </Field>
      <Field label="Unit">
        <Input value={f.display?.unit ?? ''} onChange={(e) => setDisplay({ unit: e.target.value || undefined })} />
      </Field>
      {f.formerly?.length ? (
        <Field label="Formerly called" className="col-span-2" hint="Old names whose data is read into this field.">
          <Input value={f.formerly.join(', ')} onChange={(e) => set({ formerly: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
        </Field>
      ) : null}
    </div>
  )
}

export function SchemaEditor({ worldId }: { worldId: string }) {
  const autosave = useAutosavedState<WorldSchema | null>(null, (s) => engine('worlds.saveSchema', { id: worldId, schema: s! }), { when: (s) => s !== null && !inspectSchema(s).errors.length })
  const schema = autosave.value
  const [typeKey, setTypeKey] = useState('')
  const [fieldName, setFieldName] = useState('')
  const [tab, setTab] = useState<Tab>('fields')
  useEffect(() => {
    void engine('worlds.schema', { id: worldId })
      .then((s) => {
        autosave.reset(clone(s))
        setTypeKey(Object.keys(s.types)[0] ?? '')
      })
      .catch(failed('Could not read the schema'))
  }, [worldId])
  const check = useMemo(() => (schema ? inspectSchema(schema) : { errors: [], warnings: [] }), [schema])
  if (!schema) return null
  const t = schema.types[typeKey]
  const update = (fn: (s: WorldSchema) => void) => {
    const next = clone(schema)
    fn(next)
    autosave.set(next)
  }
  const setType = (patch: Partial<WorldType>) => update((s) => void (s.types[typeKey] = { ...s.types[typeKey], ...patch }))
  const renameType = (to: string) => {
    const key = to.trim().toLowerCase()
    if (!key || key === typeKey || schema.types[key]) return
    update((s) => {
      s.types = renameKey(s.types, typeKey, key)
      for (const tt of Object.values(s.types)) {
        for (const f of Object.values(tt.fields)) {
          if (f.to === typeKey) f.to = key
          if (f.entryRef?.to === typeKey) f.entryRef.to = key
        }
        for (const b of Object.values(tt.backrefs ?? {})) if (b.from === typeKey) b.from = key
      }
    })
    setTypeKey(key)
  }
  const renameField = (to: string) => {
    if (!t || t.fields[to]) return
    update((s) => {
      const tt = s.types[typeKey]
      const f = tt.fields[fieldName]
      f.formerly = [...new Set([...(f.formerly ?? []), fieldName])]
      tt.fields = renameKey(tt.fields, fieldName, to)
      if (tt.label === fieldName) tt.label = to
      for (const other of Object.values(s.types)) for (const b of Object.values(other.backrefs ?? {})) if (b.from === typeKey && b.via === fieldName) b.via = to
    })
    setFieldName(to)
  }
  const groups = t?.display?.groups ?? []
  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="flex w-44 shrink-0 flex-col gap-1">
        {Object.entries(schema.types).map(([k, tt]) => (
          <ListRow
            key={k}
            active={k === typeKey}
            accent={tt.display?.accent ?? '#4ee1ff'}
            onClick={() => (setTypeKey(k), setFieldName(''))}
            icon={<span style={{ color: tt.display?.accent ?? '#4ee1ff' }}>{tt.display?.glyph ?? '◈'}</span>}
            title={k}
            meta={Object.keys(tt.fields).length}
          />
        ))}
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => askText('New type', 'Key (lower case)', '', (k) => {
          const key = k.trim().toLowerCase().replace(/\s+/g, '_')
          if (!key || schema.types[key]) return
          update((s) => void (s.types[key] = newType()))
          setTypeKey(key)
        })}>
          Add type
        </Button>
        <div className="mt-auto flex flex-col gap-1.5 border-t border-line/40 pt-2">
          <div className="max-h-48 overflow-y-auto font-ui text-[10.5px]">
            {check.errors.map((e) => (
              <div key={e} className="text-alert">✕ {e}</div>
            ))}
            {check.warnings.map((w) => (
              <div key={w} className="text-accent-soft">! {w}</div>
            ))}
            {!check.errors.length && !check.warnings.length && <div className="text-ok">✓ No problems</div>}
          </div>
          <SaveState status={autosave.status} error={autosave.error} blocked={check.errors[0] ?? null} />
        </div>
      </div>
      {t ? (
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <ShellTabs<Tab> value={tab} onChange={setTab} options={[{ value: 'fields', label: 'Fields' }, { value: 'type', label: 'Type' }, { value: 'display', label: 'Display' }, { value: 'backrefs', label: 'Backrefs' }]} />
          {tab === 'fields' && (
            <div className="flex gap-3">
              <div className="flex w-52 shrink-0 flex-col gap-0.5">
                {Object.entries(t.fields).map(([n, f]) => (
                  <div key={n} className={cn('group flex items-center gap-1 px-2 py-1', n === fieldName ? 'bg-ink/5 text-ink' : 'text-dim hover:text-ink')}>
                    <button onClick={() => setFieldName(n)} className="min-w-0 flex-1 truncate text-left text-[12.5px]">
                      {n} <span className="font-ui text-[10px] text-faint">{f.kind}{f.lock && f.lock !== 'open' ? ' · ' + f.lock.replace('_', ' ') : ''}{f.visible === false ? ' · hidden' : ''}</span>
                    </button>
                    <span className="flex opacity-0 group-hover:opacity-100">
                      <button onClick={() => update((s) => void (s.types[typeKey].fields = moveKey(s.types[typeKey].fields, n, -1)))} className="text-dim hover:text-ink"><ArrowUp className="h-3 w-3" /></button>
                      <button onClick={() => update((s) => void (s.types[typeKey].fields = moveKey(s.types[typeKey].fields, n, 1)))} className="text-dim hover:text-ink"><ArrowDown className="h-3 w-3" /></button>
                      <button onClick={() => (update((s) => void delete s.types[typeKey].fields[n]), n === fieldName && setFieldName(''))} className="text-dim hover:text-alert"><Trash2 className="h-3 w-3" /></button>
                    </span>
                  </div>
                ))}
                <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => askText('New field', 'Name', '', (n) => {
                  const name = n.trim().replace(/\s+/g, '_')
                  if (!name || t.fields[name]) return
                  update((s) => void (s.types[typeKey].fields[name] = { kind: 'text' }))
                  setFieldName(name)
                })}>
                  Add field
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                {t.fields[fieldName] ? (
                  <FieldForm schema={schema} typeKey={typeKey} name={fieldName} f={t.fields[fieldName]} onChange={(f) => update((s) => void (s.types[typeKey].fields[fieldName] = f))} onRename={renameField} />
                ) : (
                  <div className="text-[12.5px] text-faint">Pick a field to edit it.</div>
                )}
              </div>
            </div>
          )}
          {tab === 'type' && (
            <div className="grid max-w-2xl grid-cols-2 gap-3">
              <Field label="Key" hint="Used in ids and tools. Renaming updates refs to it.">
                <Input key={typeKey} defaultValue={typeKey} onBlur={(e) => renameType(e.target.value)} />
              </Field>
              <Field label="Name field">
                <Select value={t.label} options={opts(Object.keys(t.fields))} onChange={(v) => setType({ label: v })} />
              </Field>
              <Field label="Noun">
                <Input value={t.noun} onChange={(e) => setType({ noun: e.target.value })} />
              </Field>
              <Field label="Plural">
                <Input value={t.plural} onChange={(e) => setType({ plural: e.target.value })} />
              </Field>
              <Field label="Description" className="col-span-2" hint="The model sees this.">
                <Input value={t.describe ?? ''} onChange={(e) => setType({ describe: e.target.value })} />
              </Field>
              <div className="col-span-2">
                <Button variant="ghost" icon={<Trash2 />} disabled={Object.keys(schema.types).length < 2} onClick={() => (update((s) => void delete s.types[typeKey]), setTypeKey(Object.keys(schema.types).find((k) => k !== typeKey) ?? ''))}>
                  Delete this type
                </Button>
              </div>
            </div>
          )}
          {tab === 'display' && (
            <div className="flex max-w-3xl flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Accent">
                  <input type="color" value={t.display?.accent ?? '#4ee1ff'} onChange={(e) => setType({ display: { ...t.display, accent: e.target.value } })} className="h-8 w-16 cursor-pointer border border-line/50 bg-transparent" />
                </Field>
                <Field label="Glyph">
                  <Input value={t.display?.glyph ?? ''} maxLength={2} onChange={(e) => setType({ display: { ...t.display, glyph: e.target.value } })} />
                </Field>
              </div>
              <div className="font-label text-[10.5px] caps-14 text-accent-soft">Groups</div>
              {groups.map((g, i) => {
                const setGroup = (patch: Partial<typeof g>) => setType({ display: { ...t.display, groups: groups.map((x, j) => (j === i ? { ...x, ...patch } : x)) } })
                return (
                  <div key={i} className="grid grid-cols-[8rem_1fr_7rem_7rem_auto] items-center gap-1.5">
                    <Input value={g.id} onChange={(e) => setGroup({ id: e.target.value })} placeholder="id" />
                    <Input value={g.label} onChange={(e) => setGroup({ label: e.target.value })} placeholder="label" />
                    <Select value={g.layout ?? 'flow'} options={opts(WORLD_LAYOUTS)} onChange={(v) => setGroup({ layout: v as 'flow' | 'stats' })} />
                    <Select value={g.column ?? 'main'} options={opts(WORLD_COLUMNS)} onChange={(v) => setGroup({ column: v as 'main' | 'left' | 'rail' })} />
                    <button onClick={() => setType({ display: { ...t.display, groups: groups.filter((_, j) => j !== i) } })} className="text-dim hover:text-alert">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setType({ display: { ...t.display, groups: [...groups, { id: `group${groups.length + 1}`, label: 'Group', layout: 'flow', column: 'main' }] } })}>
                Add group
              </Button>
            </div>
          )}
          {tab === 'backrefs' && (
            <div className="flex max-w-3xl flex-col gap-2">
              <div className="text-[12.5px] text-dim">A backref lists the records of another type that point at this one, e.g. who is at a location.</div>
              {Object.entries(t.backrefs ?? {}).map(([n, b]) => {
                const setB = (patch: Partial<typeof b>) => setType({ backrefs: { ...t.backrefs, [n]: { ...b, ...patch } } })
                const from = schema.types[b.from]
                return (
                  <div key={n} className="grid grid-cols-[8rem_8rem_8rem_1fr_auto] items-center gap-1.5">
                    <Input defaultValue={n} onBlur={(e) => e.target.value.trim() && e.target.value !== n && setType({ backrefs: renameKey(t.backrefs ?? {}, n, e.target.value.trim()) })} />
                    <Select value={b.from} options={opts(Object.keys(schema.types))} onChange={(v) => setB({ from: v, via: '' })} />
                    <Select value={b.via} options={opts(Object.entries(from?.fields ?? {}).filter(([, f]) => f.kind === 'ref' || f.kind === 'refs').map(([k]) => k), 'via field')} onChange={(v) => setB({ via: v })} />
                    <Input value={b.empty ?? ''} placeholder="text when there are none" onChange={(e) => setB({ empty: e.target.value || undefined })} />
                    <button onClick={() => setType({ backrefs: Object.fromEntries(Object.entries(t.backrefs ?? {}).filter(([k]) => k !== n)) })} className="text-dim hover:text-alert">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
              <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => askText('New backref', 'Name', '', (n) => void (n.trim() && setType({ backrefs: { ...t.backrefs, [n.trim()]: { from: Object.keys(schema.types)[0], via: '' } } })))}>
                Add backref
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-[12.5px] text-faint">Pick a type.</div>
      )}
    </div>
  )
}
