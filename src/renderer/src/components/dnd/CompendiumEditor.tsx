import { compendiumInfo, type CompendiumEntry, type CompendiumKind, type FactValue } from '@shared/compendium'
import { Field, Input } from '../ui'
import { MarkdownEditor } from '../data/MarkdownEditor'

export function CompendiumEditor({ kind, entry, onChange }: { kind: CompendiumKind; entry: CompendiumEntry; onChange: (next: CompendiumEntry) => void }) {
  const facts = compendiumInfo(kind)?.facts ?? []
  const fact = (key: string, value: FactValue | undefined) => {
    const next = { ...entry.facts }
    if (value === undefined || value === '' || value === false) delete next[key]
    else next[key] = value
    onChange({ ...entry, facts: next })
  }
  return (
    <div className="flex flex-col gap-3">
      <Field label="Name">
        <Input autoFocus={!entry.name} value={entry.name} onChange={(e) => onChange({ ...entry, name: e.target.value })} placeholder="Name" />
      </Field>
      {facts.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-3 gap-y-2">
          {facts.map((f) =>
            f.type === 'check' ? (
              <label key={f.key} className="flex items-center gap-2 pt-5 text-[13px] text-dim">
                <input type="checkbox" checked={entry.facts[f.key] === true} onChange={(e) => fact(f.key, e.target.checked)} className="h-4 w-4 accent-[rgb(255,201,25)]" />
                {f.label}
              </label>
            ) : (
              <Field key={f.key} label={f.label}>
                <Input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={entry.facts[f.key] === undefined ? '' : String(entry.facts[f.key])}
                  onChange={(e) => fact(f.key, f.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
                  className="h-8 text-[13px]"
                />
              </Field>
            )
          )}
        </div>
      )}
      <Field label="Description" group>
        <MarkdownEditor value={entry.text} onValue={(text) => onChange({ ...entry, text })} placeholder="What it is and what it does" />
      </Field>
    </div>
  )
}
