import { useState } from 'react'
import { X } from 'lucide-react'

const SUGGESTED = ['Age', 'Pronouns', 'Race', 'Class', 'Occupation', 'Backstory', 'Personality', 'Quirks', 'Fears', 'Secrets', 'Skills', 'Inventory', 'Catchphrases', 'Voice']

export function AddFieldBar({ fields, kept, onAdd, onClose }: { fields: string[]; kept: string[]; onAdd: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line/40 tone-panel-40 px-5 py-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) {
            onAdd(name.trim())
            setName('')
          }
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Field name, then Enter"
        className="h-8 w-56 border border-line tone-well-60 px-2.5 text-[13px] text-ink outline-none focus:border-accent"
      />
      {SUGGESTED.filter((s) => !fields.includes(s)).map((s) => (
        <button key={s} onClick={() => onAdd(s)} className="border border-line/50 px-2 py-0.5 font-ui text-[11px] text-accent-soft hover:border-accent hover:text-ink">
          + {s}
        </button>
      ))}
      {kept.map((h) => (
        <button key={h} title="Off the sheet; its text was kept" onClick={() => onAdd(h)} className="border border-secondary/50 px-2 py-0.5 font-ui text-[11px] text-secondary hover:border-secondary hover:text-ink">
          ↩ {h}
        </button>
      ))}
      <button title="Close" onClick={onClose} className="ml-auto text-dim hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
