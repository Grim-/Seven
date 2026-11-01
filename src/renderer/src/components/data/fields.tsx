import { Check, ExternalLink, FileIcon } from 'lucide-react'
import type { Page, FieldDef, FieldValue } from '@shared/types'
import { ChipInput, Input, Select, Toggle } from '../ui'
import { assetUrl, useAsset } from '../../store/data'
import { cn } from '../../lib/cn'

const CHIP_COLORS = ['text-accent border-accent/40', 'text-cyan border-cyan/40', 'text-teal border-teal/40', 'text-purple border-purple/40', 'text-ok border-ok/40', 'text-alert border-alert/40']

export function chipColor(value: string): string {
  let h = 0
  for (const c of value) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return CHIP_COLORS[h % CHIP_COLORS.length]
}

export function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={cn('inline-flex h-5 items-center border px-1.5 font-mono text-[10.5px] uppercase tracking-wider', tone ?? 'border-line text-dim')}>{children}</span>
}

export function primaryField(page: Page): FieldDef {
  return page.fields.find((f) => f.type === 'text' && f.required) ?? page.fields.find((f) => f.type === 'text') ?? page.fields[0]
}

const DONE = /^(done|complete|completed|finished|closed)$/i

export function doneOption(field: FieldDef): string | null {
  return field.type === 'select' ? (field.options.find((o) => DONE.test(o.trim())) ?? null) : null
}

export function isTickField(field: FieldDef | undefined): boolean {
  return Boolean(field && (field.type === 'boolean' || doneOption(field)))
}

export function checkField(page: Page): FieldDef | undefined {
  return page.fields.find((f) => f.type === 'boolean') ?? page.fields.find((f) => doneOption(f) !== null)
}

export function isDone(field: FieldDef, value: FieldValue | undefined): boolean {
  return field.type === 'boolean' ? value === true : value === doneOption(field)
}

export function toggled(field: FieldDef, value: FieldValue | undefined): FieldValue {
  if (field.type === 'boolean') return value !== true
  const done = doneOption(field)
  return isDone(field, value) ? (field.options.find((o) => o !== done) ?? null) : done
}

export function isEmpty(value: FieldValue | undefined): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)
}

function formatDate(value: string): string {
  const [date, time] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return time ? `${label} ${time}` : label
}

function AssetInline({ id }: { id: string }) {
  const asset = useAsset(id)
  if (asset === undefined) return <span className="text-faint">…</span>
  if (!asset) return <span className="text-faint">missing file</span>
  if (asset.kind === 'image') return <img src={assetUrl(asset)} alt={asset.name} className="h-10 max-w-24 border border-line/50 object-cover" />
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-white/85">
      <FileIcon className="h-3.5 w-3.5 text-dim" />
      {asset.name}
    </span>
  )
}

export function FieldValueView({ field, value }: { field: FieldDef; value: FieldValue | undefined }) {
  if (isEmpty(value)) return <span className="text-faint">—</span>
  switch (field.type) {
    case 'boolean':
      return value ? <Check className="h-4 w-4 text-ok" /> : <span className="text-faint">—</span>
    case 'tags':
      return (
        <span className="flex flex-wrap gap-1">
          {(value as string[]).map((t) => (
            <Chip key={t} tone={chipColor(t)}>
              {t}
            </Chip>
          ))}
        </span>
      )
    case 'select':
      return <Chip tone={chipColor(String(value))}>{String(value)}</Chip>
    case 'date':
      return <span className="font-mono text-[12px]">{formatDate(String(value))}</span>
    case 'number':
      return <span className="font-mono text-[12.5px]">{String(value)}</span>
    case 'url':
      return (
        <a href={String(value)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan hover:underline">
          <span className="max-w-56 truncate">{String(value).replace(/^https?:\/\//, '')}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      )
    case 'asset':
      return <AssetInline id={String(value)} />
    default:
      return <span className="whitespace-pre-wrap break-words">{String(value)}</span>
  }
}

export function FieldInput({ field, value, onChange }: { field: FieldDef; value: FieldValue | undefined; onChange: (value: FieldValue) => void }) {
  switch (field.type) {
    case 'boolean':
      return <Toggle checked={value === true} onChange={onChange} label={value ? 'Yes' : 'No'} />
    case 'number':
      return (
        <Input
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
    case 'date':
      return (
        <Input
          type={String(value ?? '').includes('T') ? 'datetime-local' : 'date'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          className="[color-scheme:dark]"
        />
      )
    case 'select':
      return (
        <Select
          value={String(value ?? '')}
          options={[{ value: '', label: '—' }, ...field.options.map((o) => ({ value: o, label: o }))]}
          onChange={(v) => onChange(v || null)}
        />
      )
    case 'tags':
      return <ChipInput value={Array.isArray(value) ? value : []} onChange={onChange} placeholder="Type one and press Enter" />
    default:
      return <Input value={value === null || value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)} />
  }
}
