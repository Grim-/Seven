import { useMemo, useState } from 'react'
import { Check, ClipboardCopy, Copy, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Page, CollectionRecord, CollectionViewKind, FieldDef, FieldValue, ViewOptions } from '@shared/types'
import { COLLECTION_VIEWS } from '@shared/types'
import { AlertBox, Button, EmptyState, Field, Modal, Select, ShellTabs, openMenu, DoneEditing, useAutosavedState, confirmDelete } from '../ui'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { usePage } from '../../store/data'
import { cn } from '../../lib/cn'
import { VIEW_LABELS } from '@shared/widgets'
import { applyOptions } from '@shared/records'
import { CalendarBody } from './CalendarView'
import { ChartBody } from './ChartView'
import { Chip, FieldInput, FieldValueView, checkField, chipColor, isDone, isEmpty, isTickField, primaryField, toggled } from './fields'
import { failed, copyText } from '../../lib/notify'
import { useBusy } from '../../lib/useBusy'


function update(pageId: string, recordId: string, values: Record<string, FieldValue>): Promise<void> {
  return engine('data.records.update', { pageId, recordId, values }).then(() => undefined, failed('Could not save'))
}

export function RecordEditor({ page, record, onClose }: { page: Page; record: CollectionRecord | null; onClose: () => void }) {
  const editor = useAutosavedState<Record<string, FieldValue>>(() => ({ ...(record?.values ?? {}) }), (next) => engine('data.records.update', { pageId: page.id, recordId: record!.id, values: next }), { when: () => Boolean(record) })
  const values = editor.value
  const [busy, run] = useBusy()
  const [error, setError] = useState<string | null>(null)
  const shown = (err: unknown) => setError(errorText(err))
  const close = () => void editor.flush().then(onClose)

  const add = () =>
    void run(async () => {
      setError(null)
      await engine('data.records.add', { pageId: page.id, values: Object.fromEntries(Object.entries(values).filter(([, v]) => !isEmpty(v))), at: null })
      onClose()
    }, shown)

  const remove = () =>
    void run(async () => {
      await engine('data.records.delete', { pageId: page.id, recordIds: [record!.id] })
      onClose()
    }, shown)

  return (
    <Modal
      open
      title={record ? `${page.title} · ${record.id}` : `Add to ${page.title}`}
      onClose={close}
      footer={
        <>
          {record && (
            <Button variant="danger" icon={<Trash2 />} disabled={busy} onClick={remove} className="mr-auto">
              Delete
            </Button>
          )}
          {record ? (
            <DoneEditing saver={editor} onDone={onClose} size="md" />
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" disabled={busy} onClick={add}>
                Add
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
        {page.fields.map((f) => (
          <Field key={f.name} label={`${f.name}${f.required ? ' *' : ''}`} hint={f.type === 'asset' ? 'A file id from Seven, e.g. a_...' : undefined}>
            <FieldInput
              field={f}
              value={values[f.name]}
              onChange={(v) => editor.set((cur) => ({ ...cur, [f.name]: v }))}
            />
          </Field>
        ))}
        {error && <AlertBox>{error}</AlertBox>}
      </div>
    </Modal>
  )
}

function Tick({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center border transition-colors',
        checked ? 'border-ok bg-ok/15 text-ok' : 'border-line text-transparent hover:border-accent'
      )}
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  )
}

function recordMenu(e: React.MouseEvent, page: Page, edit: (r: CollectionRecord) => void): void {
  const id = (e.target as HTMLElement).closest('[data-record]')?.getAttribute('data-record')
  const index = id ? page.records.findIndex((r) => r.id === id) : -1
  if (index < 0) return
  const record = page.records[index]
  const primary = primaryField(page)
  const name = primary ? String(record.values[primary.name] ?? '') : ''
  openMenu(e, name.slice(0, 60) || record.id, [
    { label: 'Edit', icon: <Pencil />, onSelect: () => edit(record) },
    { label: 'Duplicate', icon: <Copy />, onSelect: () => void engine('data.records.add', { pageId: page.id, values: { ...record.values }, at: index + 1 }).catch(failed('Could not duplicate')) },
    ...(name ? [{ label: 'Copy text', icon: <ClipboardCopy />, onSelect: () => void copyText(name, 'Copied', name.slice(0, 60)) }] : []),
    { label: '', separator: true },
    {
      label: 'Delete',
      icon: <Trash2 />,
      danger: true,
      onSelect: () =>
        confirmDelete(`Delete ${name.slice(0, 60) || 'this item'}?`, `It is removed from ${page.title}.`, () => engine('data.records.delete', { pageId: page.id, recordIds: [record.id] }))
    }
  ])
}

export interface BodyProps {
  page: Page
  records: CollectionRecord[]
  fields: FieldDef[]
  options: ViewOptions
  compact: boolean
  onOpen: (record: CollectionRecord) => void
}

function optionField(page: Page, name: unknown, type: FieldDef['type']): FieldDef | undefined {
  const named = typeof name === 'string' ? page.fields.find((f) => f.name === name && f.type === type) : undefined
  return named ?? page.fields.find((f) => f.type === type)
}

export { Tick, update }

function InlineSelect({ page, record, field }: { page: Page; record: CollectionRecord; field: FieldDef }) {
  const value = typeof record.values[field.name] === 'string' ? (record.values[field.name] as string) : ''
  return (
    <select
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => void update(page.id, record.id, { [field.name]: e.target.value || null })}
      className="h-6 max-w-40 border border-line/60 bg-black/60 px-1 text-[12px] text-white/90 hover:border-accent"
    >
      <option value="">—</option>
      {field.options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function RemoveButton({ page, record }: { page: Page; record: CollectionRecord }) {
  return (
    <button
      title="Remove"
      onClick={(e) => {
        e.stopPropagation()
        void engine('data.records.delete', { pageId: page.id, recordIds: [record.id] }).catch(failed('Could not remove'))
      }}
      className="p-0.5 text-faint opacity-0 hover:text-alert group-hover:opacity-100"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}

function FieldCell({ page, record, field }: { page: Page; record: CollectionRecord; field: FieldDef }) {
  if (field.type === 'boolean') return <Tick checked={record.values[field.name] === true} onClick={() => void update(page.id, record.id, { [field.name]: !(record.values[field.name] === true) })} />
  if (field.type === 'select' && field.options.length) return <InlineSelect page={page} record={record} field={field} />
  return <FieldValueView field={field} value={record.values[field.name]} />
}

function TableBody({ page, records, fields, compact, onOpen }: BodyProps) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-line/60">
            {fields.map((f) => (
              <th key={f.name} className="whitespace-nowrap px-2.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-accent-soft">
                {f.name}
              </th>
            ))}
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} data-record={r.id} onClick={() => onOpen(r)} className="group cursor-pointer border-b border-line/20 hover:bg-white/[0.03]">
              {fields.map((f) => (
                <td key={f.name} className={cn('px-2.5 align-top text-white/90', compact ? 'py-1' : 'py-1.5')}>
                  <FieldCell page={page} record={r} field={f} />
                </td>
              ))}
              <td className="px-1 align-top">
                <RemoveButton page={page} record={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Secondary({ fields: visible, record, skip, page }: { fields: FieldDef[]; record: CollectionRecord; skip: string[]; page?: Page }) {
  const fields = visible.filter((f) => !skip.includes(f.name) && f.type !== 'boolean' && (!isEmpty(record.values[f.name]) || (page && f.type === 'select' && f.options.length > 0)))
  if (!fields.length) return null
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-dim">
      {fields.map((f) => (
        <span key={f.name} className="inline-flex items-center gap-1.5">
          {f.type !== 'select' && f.type !== 'tags' && <span className="font-mono text-[10px] uppercase tracking-wider text-faint">{f.name}</span>}
          {page && f.type === 'select' && f.options.length ? <InlineSelect page={page} record={record} field={f} /> : <FieldValueView field={f} value={record.values[f.name]} />}
        </span>
      ))}
    </div>
  )
}

function ListBody({ page, records, fields, onOpen }: BodyProps) {
  const primary = primaryField(page)
  return (
    <ul className="flex flex-col">
      {records.map((r) => (
        <li key={r.id} data-record={r.id} onClick={() => onOpen(r)} className="group flex cursor-pointer items-start gap-2 border-b border-line/20 px-1 py-1.5 hover:bg-white/[0.03]">
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] text-white">
              <FieldValueView field={primary} value={r.values[primary.name]} />
            </div>
            <Secondary fields={fields} record={r} skip={[primary.name]} page={page} />
          </div>
          <RemoveButton page={page} record={r} />
        </li>
      ))}
    </ul>
  )
}

function ItemTitle({ page, record, field, done }: { page: Page; record: CollectionRecord; field: FieldDef; done: boolean }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const value = record.values[field.name]
  if (editing && field.type === 'text')
    return (
      <input
        autoFocus
        value={text}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (text !== (value ?? '')) void update(page.id, record.id, { [field.name]: text })
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setText(String(value ?? ''))
            setEditing(false)
          }
        }}
        className="w-full border-b border-accent/60 bg-transparent text-[13.5px] text-white outline-none"
      />
    )
  return (
    <div
      onClick={(e) => {
        if (field.type !== 'text') return
        e.stopPropagation()
        setText(String(value ?? ''))
        setEditing(true)
      }}
      className={cn('cursor-text text-[13.5px] text-white', done && 'line-through')}
    >
      {isEmpty(value) ? <span className="text-faint">Untitled</span> : <FieldValueView field={field} value={value} />}
    </div>
  )
}

function AddItem({ page, field }: { page: Page; field: FieldDef | undefined }) {
  const [text, setText] = useState('')
  const add = async () => {
    const title = text.trim()
    if (!title) return
    setText('')
    try {
      await engine('data.records.add', { pageId: page.id, values: field ? { [field.name]: title } : { title }, at: null })
    } catch (err) {
      setText(title)
      toast.error('Could not add', errorText(err))
    }
  }
  return (
    <li className="flex items-center gap-2.5 px-1 py-1.5">
      <Plus className="h-4 w-4 shrink-0 text-faint" />
      <input
        value={text}
        placeholder="Add an item"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void add()}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] text-white outline-none placeholder:text-faint"
      />
    </li>
  )
}

function ChecklistBody({ page, records, fields, options, onOpen }: BodyProps) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const named = typeof options.checkField === 'string' ? page.fields.find((f) => f.name === options.checkField && isTickField(f)) : undefined
  const check = named ?? checkField(page)
  const primary = primaryField(page)
  if (!check) return <div className="p-2 text-[12.5px] text-dim">A checklist needs a yes/no field, or a choice field with a Done option. This page has neither.</div>
  const visible = options.hideDone === true ? records.filter((r) => !isDone(check, r.values[check.name])) : records
  const sorted = options.sort ? visible : [...visible].sort((a, b) => Number(isDone(check, a.values[check.name])) - Number(isDone(check, b.values[check.name])))
  const drop = (target: string) => {
    const id = dragging
    setDragging(null)
    setOver(null)
    if (!id || id === target) return
    const to = page.records.findIndex((r) => r.id === target)
    if (to === -1) return
    void engine('data.records.move', { pageId: page.id, recordId: id, to }).catch(failed('Could not move'))
  }
  const remove = (id: string) => void engine('data.records.delete', { pageId: page.id, recordIds: [id] }).catch(failed('Could not remove'))
  return (
    <ul className="flex flex-col">
      {sorted.map((r) => {
        const done = isDone(check, r.values[check.name])
        return (
          <li
            key={r.id} data-record={r.id}
            draggable
            onDragStart={() => setDragging(r.id)}
            onDragEnd={() => {
              setDragging(null)
              setOver(null)
            }}
            onDragOver={(e) => {
              if (!dragging) return
              e.preventDefault()
              setOver(r.id)
            }}
            onDrop={() => drop(r.id)}
            className={cn(
              'group flex items-start gap-2.5 border-b border-line/20 px-1 py-1.5 hover:bg-white/[0.03]',
              over === r.id && dragging !== r.id && 'border-t-2 border-t-accent',
              dragging === r.id && 'opacity-40'
            )}
          >
            <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-faint opacity-0 group-hover:opacity-100" />
            <span className="pt-0.5">
              <Tick checked={done} onClick={() => void update(page.id, r.id, { [check.name]: toggled(check, r.values[check.name]) })} />
            </span>
            <div className={cn('min-w-0 flex-1', done && 'opacity-50')}>
              <ItemTitle page={page} record={r} field={primary} done={done} />
              <Secondary fields={fields} record={r} skip={[primary.name, check.name]} />
            </div>
            <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
              <button title="Edit fields" onClick={() => onOpen(r)} className="p-0.5 text-dim hover:text-accent">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button title="Remove" onClick={() => remove(r.id)} className="p-0.5 text-dim hover:text-alert">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        )
      })}
      <AddItem page={page} field={primary} />
    </ul>
  )
}

function CardsBody({ page, records, fields, compact, onOpen }: BodyProps) {
  const primary = primaryField(page)
  const check = checkField(page)
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-[repeat(auto-fill,minmax(170px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))]')}>
      {records.map((r) => (
        <div key={r.id} data-record={r.id} onClick={() => onOpen(r)} className="notch-sm group cursor-pointer border border-line/60 bg-black/50 p-2.5 hover:border-accent">
          <div className="mb-1.5 flex items-start gap-2">
            {check && <Tick checked={isDone(check, r.values[check.name])} onClick={() => void update(page.id, r.id, { [check.name]: toggled(check, r.values[check.name]) })} />}
            <div className="min-w-0 flex-1 text-[13.5px] font-semibold text-white">
              <FieldValueView field={primary} value={r.values[primary.name]} />
            </div>
            <RemoveButton page={page} record={r} />
          </div>
          <div className="flex flex-col gap-1">
            {fields
              .filter((f) => f.name !== primary.name && f.name !== check?.name && (!isEmpty(r.values[f.name]) || (f.type === 'select' && f.options.length > 0)))
              .map((f) => (
                <div key={f.name} className="flex items-start gap-2 text-[12px]">
                  <span className="w-16 shrink-0 truncate font-mono text-[10px] uppercase tracking-wider text-faint">{f.name}</span>
                  <span className="min-w-0 flex-1 text-white/85">
                    <FieldCell page={page} record={r} field={f} />
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function BoardBody({ page, records, fields, options, onOpen }: BodyProps) {
  const group = optionField(page, options.groupBy, 'select')
  const primary = primaryField(page)
  const [over, setOver] = useState<string | null>(null)
  if (!group) return <div className="p-2 text-[12.5px] text-dim">A board groups records by a select field. This page has none.</div>
  const columns = [...group.options, '']
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {columns.map((col) => {
        const items = records.filter((r) => (r.values[group.name] ?? '') === col)
        if (col === '' && !items.length) return null
        return (
          <div
            key={col || '__none'}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(col)
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              const id = e.dataTransfer.getData('text/seven-record')
              if (id) void update(page.id, id, { [group.name]: col || null })
            }}
            className={cn('flex w-56 shrink-0 flex-col gap-1.5 border bg-black/40 p-2', over === col ? 'border-accent' : 'border-line/40')}
          >
            <div className="flex items-center justify-between">
              {col ? <Chip tone={chipColor(col)}>{col}</Chip> : <Chip>None</Chip>}
              <span className="font-mono text-[10.5px] text-faint">{items.length}</span>
            </div>
            {items.map((r) => (
              <div
                key={r.id} data-record={r.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/seven-record', r.id)}
                onClick={() => onOpen(r)}
                className="cursor-grab border border-line/50 bg-card px-2 py-1.5 hover:border-accent active:cursor-grabbing"
              >
                <div className="text-[13px] text-white">
                  <FieldValueView field={primary} value={r.values[primary.name]} />
                </div>
                <Secondary fields={fields} record={r} skip={[primary.name, group.name]} />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

const BODIES: Record<CollectionViewKind, (props: BodyProps) => React.ReactNode> = {
  table: TableBody,
  list: ListBody,
  checklist: ChecklistBody,
  cards: CardsBody,
  board: BoardBody,
  calendar: CalendarBody,
  chart: ChartBody
}

export function CollectionBody({
  page,
  view,
  recordIds,
  options = {},
  compact = false
}: {
  page: Page
  view: CollectionViewKind
  recordIds: string[] | null
  options?: ViewOptions
  compact?: boolean
}) {
  const [editing, setEditing] = useState<CollectionRecord | null>(null)
  const records = useMemo(() => {
    const base = recordIds ? page.records.filter((r) => new Set(recordIds).has(r.id)) : page.records
    return applyOptions(page.fields, base, options)
  }, [page, recordIds, options])
  const fields = useMemo(() => {
    const wanted = Array.isArray(options.fields) ? (options.fields as string[]) : null
    const picked = wanted ? page.fields.filter((f) => wanted.includes(f.name)) : []
    return picked.length ? picked : page.fields
  }, [page, options])
  const Body = BODIES[view] ?? TableBody
  const alwaysDraw = view === 'calendar' || view === 'chart' || (view === 'checklist' && !recordIds)
  return (
    <>
      {records.length || alwaysDraw ? (
        <div className="contents" onContextMenu={(e) => recordMenu(e, page, setEditing)}>
          <Body page={page} records={records} fields={fields} options={options} compact={compact} onOpen={setEditing} />
        </div>
      ) : (
        <div className="px-1 py-2 text-[12.5px] text-dim">
          {recordIds ? 'These items are no longer on the page.' : page.records.length ? 'No items match.' : 'No items yet.'}
        </div>
      )}
      {editing && <RecordEditor page={page} record={page.records.find((r) => r.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
    </>
  )
}

export function ViewSwitcher({ value, onChange, compact = false }: { value: CollectionViewKind; onChange: (v: CollectionViewKind) => void; compact?: boolean }) {
  if (compact)
    return (
      <Select
        value={value}
        options={COLLECTION_VIEWS.map((v) => ({ value: v, label: VIEW_LABELS[v] }))}
        onChange={(v) => onChange(v as CollectionViewKind)}
        className="h-7 w-28 font-mono text-[11px] uppercase tracking-wider"
      />
    )
  return <ShellTabs value={value} options={COLLECTION_VIEWS.map((v) => ({ value: v, label: VIEW_LABELS[v] }))} onChange={onChange} />
}

export function LiveCollection({
  collectionId,
  view: initialView,
  recordIds,
  options,
  onOpen
}: {
  collectionId: string
  view: CollectionViewKind
  recordIds: string[] | null
  options?: ViewOptions
  onOpen?: () => void
}) {
  const page = usePage(collectionId)
  const [view, setView] = useState<CollectionViewKind>(initialView)
  const [showAll, setShowAll] = useState(false)
  const [adding, setAdding] = useState(false)
  if (page === undefined) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  if (!page) return <EmptyState title="Deleted">This page no longer exists.</EmptyState>
  const partial = recordIds !== null && recordIds.length < page.records.length
  const subset = partial && !showAll ? recordIds : null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-white">{page.title}</span>
        <span className="font-mono text-[11px] text-faint">
          {subset ? `${subset.length} of ${page.records.length}` : `${page.records.length} item${page.records.length === 1 ? '' : 's'}`}
        </span>
        {partial && (
          <button className="font-mono text-[10.5px] uppercase tracking-wider text-accent hover:text-white" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show these' : 'Show all'}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <ViewSwitcher compact value={view} onChange={setView} />
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setAdding(true)}>
            Add
          </Button>
          {onOpen && (
            <Button size="sm" variant="ghost" onClick={onOpen}>
              Open
            </Button>
          )}
        </div>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <CollectionBody page={page} view={view} recordIds={subset} options={options} compact />
      </div>
      {adding && <RecordEditor page={page} record={null} onClose={() => setAdding(false)} />}
    </div>
  )
}
