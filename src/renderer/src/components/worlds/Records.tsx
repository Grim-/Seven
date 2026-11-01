import { useEffect, useMemo, useState } from 'react'
import { Markdown } from '../chat/Markdown'
import { withReferences } from '../chat/References'
import { Lock, LockOpen, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import { recordKey, type WorldChanges, type WorldDisplayAs, type WorldEntity, type WorldEntry, type WorldField, type WorldMapValue, type WorldSchema, type WorldType } from '@shared/world'
import { ChangedBy } from '../agents/ChangedBy'
import { engine, on } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { errorText } from '../../lib/format'
import { Button, EmptyState, Input, SearchBox, Select, askText, ListRow, confirmDelete } from '../ui'
import { rowMenu } from '../../views/data/entryMenu'
import { cn } from '../../lib/cn'
import { MarkdownEditor } from '../data/MarkdownEditor'

const ACCENTS = ['#4ee1ff', '#a97bff', '#5ef2a4', '#ffb347', '#ff6b8a', '#7ea6ff']
const FALLBACK_AS: Record<string, WorldDisplayAs> = { number: 'stat', enum: 'badge', ref: 'chips', refs: 'chips', list: 'ledger', log: 'timeline', map: 'gauge' }

function accentOf(schema: WorldSchema, type: string): string {
  return schema.types[type]?.display?.accent ?? ACCENTS[Math.max(0, Object.keys(schema.types).indexOf(type)) % ACCENTS.length]
}

function asOf(f: WorldField, value: unknown): WorldDisplayAs {
  if (f.display?.as) return f.display.as
  if (f.kind === 'text') return typeof value === 'string' && value.length <= 48 && !value.includes('\n') ? 'stat' : 'prose'
  return FALLBACK_AS[f.kind] ?? 'prose'
}

interface LaidField {
  name: string
  f: WorldField
  as: WorldDisplayAs
  order: number
}

interface LaidGroup {
  id: string
  label: string
  layout: 'flow' | 'stats'
  column: 'left' | 'main' | 'rail'
  fields: LaidField[]
}

function layout(t: WorldType, e: WorldEntity): { groups: LaidGroup[]; badges: LaidField[] } {
  const declared = t.display?.groups ?? []
  const groups = new Map<string, LaidGroup>(declared.map((g) => [g.id, { id: g.id, label: g.label, layout: g.layout ?? 'flow', column: g.column ?? 'main', fields: [] }]))
  const fallback: LaidGroup = { id: '_record', label: 'Record', layout: 'flow', column: 'main', fields: [] }
  const badges: LaidField[] = []
  for (const [name, f] of Object.entries(t.fields)) {
    if (name === t.label) continue
    const as = asOf(f, e[name])
    if (as === 'hidden') continue
    const laid = { name, f, as, order: f.display?.order ?? 999 }
    if (as === 'badge' && f.display?.header !== false) {
      badges.push(laid)
      continue
    }
    ;(groups.get(f.display?.group ?? '') ?? fallback).fields.push(laid)
  }
  const list = [...groups.values(), fallback].filter((g) => g.fields.length)
  for (const g of list) {
    g.fields.sort((a, b) => a.order - b.order)
    if (!declared.find((d) => d.id === g.id)?.layout && g.fields.every((x) => x.as === 'stat')) g.layout = 'stats'
  }
  return { groups: list, badges }
}

type Save = (field: string, value: unknown) => Promise<void>

function LockNote({ f }: { f: WorldField }) {
  const lock = f.lock ?? 'open'
  return (
    <>
      {f.visible === false && <span className="font-mono text-[9.5px] uppercase text-purple">hidden from agents</span>}
      {lock !== 'open' && <span className="font-mono text-[9.5px] uppercase text-faint">{lock === 'locked' ? 'fixed' : lock === 'create_only' ? 'set once' : 'append only'}</span>}
    </>
  )
}

function ScalarEditor({ f, value, onSave, onCancel }: { f: WorldField; value: unknown; onSave: (v: unknown) => void; onCancel: () => void }) {
  const [v, setV] = useState(Array.isArray(value) ? value.join(', ') : String(value ?? ''))
  const [long] = useState(f.kind === 'text' && (v.length > 48 || v.includes('\n')))
  const commit = () => onSave(f.kind === 'number' ? Number(v) : f.kind === 'refs' ? v.split(',').map((x) => x.trim()).filter(Boolean) : v)
  return (
    <div className="flex items-start gap-1.5">
      {f.kind === 'enum' ? (
        <Select value={v} options={(f.values ?? []).map((x) => ({ value: x, label: x }))} onChange={setV} />
      ) : long ? (
        <MarkdownEditor compact autoFocus value={v} onValue={setV} className="w-full" />
      ) : (
        <Input value={v} type={f.kind === 'number' ? 'number' : 'text'} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      )}
      <button title="Save" onClick={commit} className="p-1 text-ok hover:text-white">
        <Check className="h-4 w-4" />
      </button>
      <button title="Cancel" onClick={onCancel} className="p-1 text-dim hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function EntriesView({ f, entries, onSave }: { f: WorldField; entries: WorldEntry[]; onSave: (v: WorldEntry[]) => Promise<void> }) {
  const [editing, setEditing] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [adding, setAdding] = useState('')
  const timeline = f.kind === 'log'
  const shown = entries.map((e, i) => ({ e, i }))
  if (timeline) shown.reverse()
  const set = (list: WorldEntry[]) => void onSave(list)
  const add = () => {
    const t = adding.trim()
    if (!t) return
    set([...entries, { text: t, ref: null, locked: false, ...(timeline ? { timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') } : {}), ...(f.weighted ? { weight: 5 } : {}) }])
    setAdding('')
  }
  return (
    <div className="flex flex-col gap-1">
      {shown.map(({ e, i }) => (
        <div key={i} className={cn('group flex items-start gap-2 text-[13px]', timeline && 'border-l border-line/50 pl-2.5')}>
          {timeline && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" style={{ opacity: f.weighted ? 0.3 + ((e.weight ?? 5) / 10) * 0.7 : 1 }} />}
          <div className="min-w-0 flex-1">
            {editing === i ? (
              <div className="flex gap-1.5">
                <Input value={text} onChange={(ev) => setText(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && (set(entries.map((x, j) => (j === i ? { ...x, text } : x))), setEditing(null))} />
                <button onClick={() => (set(entries.map((x, j) => (j === i ? { ...x, text } : x))), setEditing(null))} className="text-ok">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <span className="text-white/90">{withReferences(e.text)}</span>
            )}
            <div className="font-mono text-[10px] text-faint">
              {e.timestamp ?? ''}
              {f.weighted ? ` · weight ${e.weight ?? 5}` : ''}
              {e.ref ? ` · → ${e.ref}` : ''}
              {e.locked ? ' · fixed' : ''}
            </div>
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
            {f.weighted && (
              <Input
                type="number"
                value={e.weight ?? 5}
                className="h-6 w-12 text-[11px]"
                onChange={(ev) => set(entries.map((x, j) => (j === i ? { ...x, weight: Math.min(10, Math.max(1, Number(ev.target.value) || 5)) } : x)))}
              />
            )}
            <button title={e.locked ? 'Unfix (agents can edit it)' : 'Fix (agents can no longer edit or remove it)'} onClick={() => set(entries.map((x, j) => (j === i ? { ...x, locked: !x.locked } : x)))} className="text-dim hover:text-accent">
              {e.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
            </button>
            <button title="Edit" onClick={() => (setEditing(i), setText(e.text))} className="text-dim hover:text-white">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button title="Remove" onClick={() => set(entries.filter((_, j) => j !== i))} className="text-dim hover:text-alert">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <div className="flex gap-1.5 pt-1">
        <Input value={adding} placeholder={timeline ? 'Add to the log…' : 'Add an entry…'} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} className="h-7 text-[12px]" />
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={add}>
          Add
        </Button>
      </div>
    </div>
  )
}

function GaugeView({ f, value, onSave }: { f: WorldField; value: WorldMapValue; onSave: (v: WorldMapValue) => Promise<void> }) {
  const subs = Object.entries(f.value ?? {})
  const bar = subs.find(([, s]) => s.kind === 'number')
  const rows = Object.values(value)
  const setRow = (target: string, key: string, v: string | number) => void onSave({ ...value, [target]: { ...value[target], [key]: v, last_updated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') } })
  const addTarget = () =>
    askText(`Add a ${f.keyNoun ?? 'target'}`, 'Id', '', async (id) => {
      const t = id.trim().toLowerCase()
      if (t) await onSave({ ...value, [t]: { target: t, ...Object.fromEntries(subs.map(([k, s]) => [k, s.kind === 'number' ? Number(s.default ?? 0) : String(s.default ?? '')])), last_updated: null } })
    })
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const target = String(r.target)
        const n = bar ? Number(r[bar[0]] ?? 0) : 0
        const min = bar?.[1].min ?? 0
        const max = bar?.[1].max ?? 100
        const pct = max > min ? ((n - min) / (max - min)) * 100 : 0
        const zero = min < 0 && max > min ? ((0 - min) / (max - min)) * 100 : 0
        return (
          <div key={target} className="group flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[12.5px]">
              <span className="text-white">{target}</span>
              {bar && <span className="font-mono text-[11px] text-accent">{n}</span>}
              <button title="Remove" onClick={() => void onSave(Object.fromEntries(Object.entries(value).filter(([k]) => k !== target)))} className="ml-auto text-dim opacity-0 hover:text-alert group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {bar && (
              <div className="relative h-1.5 bg-white/10">
                <div className="absolute inset-y-0 bg-accent" style={min < 0 ? { left: `${Math.min(zero, pct)}%`, width: `${Math.abs(pct - zero)}%` } : { left: 0, width: `${pct}%` }} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {subs.map(([k, s]) => (
                <label key={k} className="flex items-center gap-1 text-[11px] text-faint">
                  {k}
                  <Input
                    defaultValue={String(r[k] ?? '')}
                    type={s.kind === 'number' ? 'number' : 'text'}
                    className="h-6 w-28 text-[11px]"
                    onBlur={(e) => e.target.value !== String(r[k] ?? '') && setRow(target, k, s.kind === 'number' ? Number(e.target.value) : e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )
      })}
      <Button size="sm" variant="ghost" icon={<Plus />} onClick={addTarget}>
        Add {f.keyNoun ?? 'target'}
      </Button>
    </div>
  )
}

function FieldValue({ name, f, as, value, onSave }: { name: string; f: WorldField; as: WorldDisplayAs; value: unknown; onSave: Save }) {
  const [editing, setEditing] = useState(false)
  if (f.kind === 'list' || f.kind === 'log') return <EntriesView f={f} entries={(value as WorldEntry[]) ?? []} onSave={(v) => onSave(name, v)} />
  if (f.kind === 'map') return <GaugeView f={f} value={(value as WorldMapValue) ?? {}} onSave={(v) => onSave(name, v)} />
  if (editing) return <ScalarEditor f={f} value={value} onSave={(v) => void onSave(name, v).then(() => setEditing(false))} onCancel={() => setEditing(false)} />
  const text = Array.isArray(value) ? value.join(', ') : value === null || value === undefined || value === '' ? '—' : String(value)
  return (
    <div className="group flex items-start gap-2">
      <div className="min-w-0 flex-1">
        {as === 'quote' ? (
          <div className="border-l-2 border-accent/60 pl-3 italic text-white/90">{text}</div>
        ) : as === 'chips' ? (
          <div className="flex flex-wrap gap-1">
            {(Array.isArray(value) ? value : value ? [value] : []).map((x) => (
              <span key={String(x)} className="border border-line/60 px-2 py-0.5 font-mono text-[11px] text-teal">
                {String(x)}
              </span>
            ))}
            {!value || (Array.isArray(value) && !value.length) ? <span className="text-faint">—</span> : null}
          </div>
        ) : (
          <Markdown text={text} className={cn('text-white/90', as === 'stat' ? 'text-[13px]' : 'text-[13.5px] leading-relaxed')} />
        )}
      </div>
      <button title="Edit" onClick={() => setEditing(true)} className="shrink-0 text-dim opacity-0 hover:text-white group-hover:opacity-100">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function FieldChange({ changes, name }: { changes: WorldChanges; name: string }) {
  const c = changes[name]
  return c ? <ChangedBy by={c.by} at={Date.parse(c.at)} /> : null
}

function Group({ g, e, changes, onSave, accent }: { g: LaidGroup; e: WorldEntity; changes: WorldChanges; onSave: Save; accent: string }) {
  if (g.layout === 'stats')
    return (
      <div className="border border-line/40 bg-black/40 p-2.5">
        <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: accent }}>
          {g.label}
        </div>
        <div className="flex flex-col gap-1">
          {g.fields.map((x) => (
            <div key={x.name} className="grid grid-cols-[7rem_1fr_auto] items-start gap-2 text-[12.5px]">
              <span className="truncate font-mono text-[10.5px] uppercase text-faint" title={x.f.describe}>
                {x.name.replace(/_/g, ' ')}
                {x.f.display?.unit ? ` (${x.f.display.unit})` : ''}
              </span>
              <FieldValue name={x.name} f={x.f} as={x.as} value={e[x.name]} onSave={onSave} />
              <FieldChange changes={changes} name={x.name} />
            </div>
          ))}
        </div>
      </div>
    )
  return (
    <>
      {g.fields.map((x) => (
        <div key={x.name} className="border border-line/40 bg-black/40 p-2.5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: accent }} title={x.f.describe}>
              {x.name.replace(/_/g, ' ')}
            </span>
            {Array.isArray(e[x.name]) && (x.f.kind === 'list' || x.f.kind === 'log') && <span className="font-mono text-[10px] text-faint">{(e[x.name] as unknown[]).length}</span>}
            <span className="ml-auto flex items-center gap-2">
              <FieldChange changes={changes} name={x.name} />
              <LockNote f={x.f} />
            </span>
          </div>
          <FieldValue name={x.name} f={x.f} as={x.as} value={e[x.name]} onSave={onSave} />
        </div>
      ))}
    </>
  )
}

function Detail({ worldId, schema, type, id, entity, changes, all, onDeleted }: { worldId: string; schema: WorldSchema; type: string; id: string; entity: WorldEntity; changes: WorldChanges; all: Record<string, Record<string, WorldEntity>>; onDeleted: () => void }) {
  const t = schema.types[type]
  const accent = accentOf(schema, type)
  const { groups, badges } = useMemo(() => layout(t, entity), [t, entity])
  const save: Save = async (field, value) => {
    try {
      await engine('worlds.put', { id: worldId, type, key: id, entity: { [field]: value } as WorldEntity })
    } catch (err) {
      toast.error('Could not save', errorText(err))
    }
  }
  const backrefs = Object.entries(t.backrefs ?? {}).map(([name, spec]) => {
    const hits = Object.entries(all[spec.from] ?? {})
      .filter(([, x]) => {
        const v = x[spec.via]
        return Array.isArray(v) ? (v as unknown[]).includes(id) : v === id
      })
      .map(([k]) => k)
    return { name, hits, empty: spec.empty }
  })
  const col = (c: LaidGroup['column']) => groups.filter((g) => g.column === c)
  const remove = () =>
    confirmDelete(`Delete ${t.noun} "${id}"?`, 'Agents linked to it will start over with a new record on their next write.', () => engine('worlds.remove', { id: worldId, type, key: id }), () => onDeleted())
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex items-center gap-3 border-b border-line/50 pb-2">
        <span className="text-[22px]" style={{ color: accent }}>
          {t.display?.glyph ?? '◈'}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[18px] font-semibold text-white">{String(entity[t.label] || id)}</div>
          <div className="font-mono text-[10.5px] text-faint">
            {t.noun} · {id}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {badges.map((b) => (
            <span key={b.name} className="border px-2 py-0.5 font-mono text-[10.5px] uppercase" style={{ borderColor: accent, color: accent }} title={b.name}>
              {Array.isArray(entity[b.name]) ? (entity[b.name] as unknown[]).length : String(entity[b.name] ?? '')}
            </span>
          ))}
          <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
            Delete
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-3">
        {(['left', 'main', 'rail'] as const).map((c) => {
          const hasL = col('left').length > 0
          const hasR = col('rail').length > 0 || backrefs.length > 0
          const side = hasL && hasR ? 3 : 4
          const span = c === 'main' ? 12 - (hasL ? side : 0) - (hasR ? side : 0) : side
          if (c === 'left' && !hasL) return null
          if (c === 'rail' && !hasR) return null
          if (c === 'main' && !col('main').length) return null
          return (
            <div key={c} className="flex min-w-0 flex-col gap-3" style={{ gridColumn: `span ${span} / span ${span}` }}>
              {col(c).map((g) => (
                <Group key={g.id} g={g} e={entity} changes={changes} onSave={save} accent={accent} />
              ))}
              {c === 'rail' &&
                backrefs.map((b) => (
                  <div key={b.name} className="border border-line/40 bg-black/40 p-2.5">
                    <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">{b.name} (referenced by)</div>
                    <div className="text-[12.5px] text-white/90">{b.hits.length ? b.hits.join(', ') : (b.empty ?? 'none')}</div>
                  </div>
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WorldRecords({ worldId, schema, initialType, initialKey }: { worldId: string; schema: WorldSchema; initialType?: string; initialKey?: string }) {
  const types = Object.keys(schema.types)
  const [type, setType] = useState(initialType && schema.types[initialType] ? initialType : (types[0] ?? ''))
  const [all, setAll] = useState<Record<string, Record<string, WorldEntity>>>({})
  const [changes, setChanges] = useState<Record<string, Record<string, WorldChanges>>>({})
  const [selected, setSelected] = useState<string | null>(initialType && schema.types[initialType] ? (initialKey ?? null) : null)
  const [query, setQuery] = useState('')
  useEffect(() => {
    const load = () =>
      void Promise.all(types.map((t) => Promise.all([engine('worlds.records', { id: worldId, type: t }), engine('worlds.changes', { id: worldId, type: t })]).then(([r, c]) => [t, r, c] as const)))
        .then((rows) => {
          setAll(Object.fromEntries(rows.map(([t, r]) => [t, r])))
          setChanges(Object.fromEntries(rows.map(([t, , c]) => [t, c])))
        })
        .catch(() => undefined)
    load()
    return on('worlds.changed', ({ id }) => id === worldId && load())
  }, [worldId, schema])
  const t = schema.types[type]
  const records = Object.entries(all[type] ?? {}).filter(([k, e]) => !query || `${k} ${String(e[t?.label ?? ''] ?? '')}`.toLowerCase().includes(query.toLowerCase()))
  const entity = selected ? all[type]?.[selected] : undefined
  const create = () =>
    askText(`New ${t?.noun ?? 'record'}`, 'Name', '', async (name) => {
      const key = recordKey(name)
      if (!key) return
      await engine('worlds.put', { id: worldId, type, key, entity: { [t.label]: name.trim() } })
      setSelected(key)
    })
  if (!t) return <EmptyState title="No types">This world's schema has no types.</EmptyState>
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {types.map((k) => (
          <button
            key={k}
            onClick={() => (setType(k), setSelected(null))}
            className={cn('flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]', type === k ? 'bg-white/5' : 'border-line/40 text-dim hover:text-white')}
            style={type === k ? { borderColor: accentOf(schema, k), color: accentOf(schema, k) } : undefined}
          >
            {schema.types[k].display?.glyph ?? '◈'} {schema.types[k].plural} <span className="text-faint">{Object.keys(all[k] ?? {}).length}</span>
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex w-56 shrink-0 flex-col gap-1.5">
          <SearchBox value={query} onChange={setQuery} />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {records.map(([k, e]) => (
              <ListRow key={k} active={selected === k} accent={accentOf(schema, type)} onClick={() => setSelected(k)} onMenu={rowMenu('world', `${worldId}/${type}/${k}`, String(e[t.label] || k), () => setSelected(k))} title={String(e[t.label] || k)} subtitle={k} tone="tag" />
            ))}
          </div>
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={create}>
            New {t.noun}
          </Button>
        </div>
        {entity && selected ? (
          <Detail key={`${type}:${selected}`} worldId={worldId} schema={schema} type={type} id={selected} entity={entity} changes={changes[type]?.[selected] ?? {}} all={all} onDeleted={() => setSelected(null)} />
        ) : (
          <div className="flex-1">
            <EmptyState title={`No ${t.noun} selected`}>Pick one on the left, or make a new one.</EmptyState>
          </div>
        )}
      </div>
    </div>
  )
}
