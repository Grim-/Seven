import type { CardField, CardValue } from '@shared/cards'
import { Field, Input, NumberField, Select, TextCards } from '../ui'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { PictureField } from '../pictures/PictureField'

const isLong = (f: CardField) => f.type === 'longtext' || (f.type === 'text' && (f.place === 'body' || f.place === 'rows'))

export function ValueField({ field, value, onChange }: { field: CardField; value: CardValue; onChange: (value: CardValue) => void }) {
  const v = value
  return (
    <Field label={field.label} group={field.type === 'list' || field.type === 'picture'}>
      {field.type === 'number' ? (
        <NumberField value={typeof v === 'number' ? v : undefined} onChange={(n) => onChange(n ?? null)} allowEmpty />
      ) : isLong(field) ? (
        <MarkdownEditor compact value={typeof v === 'string' ? v : ''} onValue={(text) => onChange(text)} />
      ) : field.type === 'choice' ? (
        <Select value={typeof v === 'string' ? v : ''} options={[{ value: '', label: '—' }, ...field.options.map((o) => ({ value: o, label: o }))]} onChange={(o) => onChange(o || null)} />
      ) : field.type === 'picture' ? (
        <PictureField value={typeof v === 'string' && v ? v : null} onChange={(id) => onChange(id)} />
      ) : field.type === 'list' ? (
        <TextCards<string> values={Array.isArray(v) ? v : []} onChange={(list) => onChange(list)} addLabel={`Add to ${field.label}`} editor={(item, set) => <Input value={item} onChange={(e) => set(e.target.value)} />} />
      ) : (
        <Input value={typeof v === 'string' || typeof v === 'number' ? String(v) : ''} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  )
}
