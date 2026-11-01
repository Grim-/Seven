import type { CardLayout, CardValue } from '@shared/cards'
import { Field, Input, NumberField, Select, TextCards } from '../ui'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { PictureField } from '../pictures/PictureField'
import { cn } from '../../lib/cn'

export function ValueFields({ layout, values, onChange }: { layout: CardLayout; values: Record<string, CardValue>; onChange: (field: string, value: CardValue) => void }) {
  if (!layout.fields.length) return <div className="text-[12.5px] text-dim">{layout.name} has no fields yet. Add them on the layout.</div>
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
      {layout.fields.map((f) => {
        const v = values[f.id] ?? null
        const wide = f.type === 'longtext' || f.type === 'list' || f.type === 'picture'
        return (
          <Field key={f.id} label={f.label} group={f.type === 'list' || f.type === 'picture'} className={cn(wide && 'col-span-full')}>
            {f.type === 'number' ? (
              <NumberField value={typeof v === 'number' ? v : undefined} onChange={(n) => onChange(f.id, n ?? null)} allowEmpty />
            ) : f.type === 'longtext' ? (
              <MarkdownEditor compact value={typeof v === 'string' ? v : ''} onValue={(text) => onChange(f.id, text)} />
            ) : f.type === 'choice' ? (
              <Select value={typeof v === 'string' ? v : ''} options={[{ value: '', label: '—' }, ...f.options.map((o) => ({ value: o, label: o }))]} onChange={(o) => onChange(f.id, o || null)} />
            ) : f.type === 'picture' ? (
              <PictureField value={typeof v === 'string' && v ? v : null} onChange={(id) => onChange(f.id, id)} />
            ) : f.type === 'list' ? (
              <TextCards<string> values={Array.isArray(v) ? v : []} onChange={(list) => onChange(f.id, list)} addLabel={`Add to ${f.label}`} editor={(item, set) => <Input value={item} onChange={(e) => set(e.target.value)} />} />
            ) : (
              <Input value={typeof v === 'string' || typeof v === 'number' ? String(v) : ''} onChange={(e) => onChange(f.id, e.target.value)} />
            )}
          </Field>
        )
      })}
    </div>
  )
}
