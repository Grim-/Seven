import type { ReactNode } from 'react'
import { ANY, type Facet, type FacetValues } from '../../lib/facets'
import { Segmented } from './Segmented'
import { SliderNumber } from './SliderNumber'

export function FacetBar<T>({ facets, values, onChange, children }: { facets: Facet<T>[]; values: FacetValues; onChange: (id: string, value: string | number) => void; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
      {facets.map((f) => (
        <div key={f.id} className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-faint">{f.label}</span>
          {f.kind === 'choice' ? (
            <Segmented value={String(values[f.id] ?? ANY)} options={f.options} onChange={(v) => onChange(f.id, v)} />
          ) : (
            <>
              <SliderNumber value={Math.min(f.max, Number(values[f.id] ?? f.max))} min={f.step} max={f.max} step={f.step} onChange={(v) => onChange(f.id, v)} className="w-44" />
              <span className="font-mono text-[11px] text-dim">{Number(values[f.id] ?? f.max) >= f.max ? 'Any' : `${values[f.id]} ${f.unit}`}</span>
            </>
          )}
        </div>
      ))}
      {children && <span className="font-mono text-[11px] text-faint">{children}</span>}
    </div>
  )
}
