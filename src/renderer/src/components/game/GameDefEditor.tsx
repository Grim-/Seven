import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import type { DefType, GameDef } from '@shared/game/defs/defs'
import type { ParamSchema } from '@shared/game/core/params'
import { Input, Textarea } from '../ui'
import { cn } from '../../lib/cn'
import { ParamTokens, shownInline } from './ParamTokens'
import { SectionTag } from './SectionTag'

const OTHER = 'Properties'

function sectionsOf(params: ParamSchema): [string, ParamSchema][] {
  const out = new Map<string, ParamSchema>()
  for (const [key, spec] of Object.entries(params)) {
    const name = spec.section ?? OTHER
    out.set(name, { ...(out.get(name) ?? {}), [key]: spec })
  }
  return [...out]
}

export function GameDefEditor({ type, def, made, onChange }: { type: DefType; def: GameDef; made: boolean; onChange: (next: GameDef) => void }) {
  const [showNotes, setShowNotes] = useState(Boolean(def.notes))
  const setValues = (values: Record<string, unknown>) => onChange({ ...def, values: { ...def.values, ...values } })
  const sections = sectionsOf(type.params)
  const rows = sections.filter(([, schema]) => !Object.values(schema).some(shownInline))
  const blocks = sections.filter(([, schema]) => Object.values(schema).some(shownInline))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 border border-line tone-panel-60 p-3">
        <div className="flex items-center gap-3">
          <Input autoFocus={!def.name} value={def.name} onChange={(e) => onChange({ ...def, name: e.target.value })} placeholder={`Name of the ${type.label.toLowerCase()}`} className="h-9 min-w-0 flex-1 text-[15px] font-semibold" />
          <span className="font-ui text-[12px] text-accent/80" title={made ? 'Its id. Rules, formulas and items use it.' : 'Its id, made from the name.'}>
            {def.id || 'id'}
          </span>
          <button type="button" title={showNotes ? 'Hide notes' : 'Notes'} onClick={() => setShowNotes(!showNotes)} className={cn('grid h-8 w-8 place-items-center border', showNotes || def.notes ? 'border-accent/60 text-accent' : 'border-line text-dim hover:text-ink')}>
            <BookOpen className="h-3.5 w-3.5" />
          </button>
        </div>
        {showNotes && <Textarea value={def.notes} placeholder="Notes" onChange={(e) => onChange({ ...def, notes: e.target.value })} className="min-h-16 text-[12.5px]" />}
        {rows.map(([name, schema]) => (
          <div key={name} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/40 pt-2.5">
            <span className="w-40 shrink-0 font-label text-[10.5px] font-bold caps-12 text-accent">{name}</span>
            <ParamTokens schema={schema} values={def.values} onChange={setValues} title={name} />
          </div>
        ))}
      </div>
      {blocks.map(([name, schema]) => (
        <section key={name} className="flex flex-col gap-2.5">
          <SectionTag>{name}</SectionTag>
          <ParamTokens schema={schema} values={def.values} onChange={setValues} title={name} />
        </section>
      ))}
    </div>
  )
}
