import type { ReactNode } from 'react'
import { ANY, type FilterValues, type PropertyFilter } from '../../lib/propertyFilters'
import { BrowsePick, type BrowseOption } from './BrowsePick'
import { Segmented } from './Segmented'
import { SliderNumber } from './SliderNumber'

export function FilterBar<T>({ filters, values, onChange, children }: { filters: PropertyFilter<T>[]; values: FilterValues; onChange: (id: string, value: string | number) => void; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
      {filters.map((f) => {
        const cur = String(values[f.id] ?? ANY)
        const useRich = f.kind === 'choice' && (f.layout === 'select' || (f.layout !== 'segmented' && f.options.length > 6))
        const browseOptions: BrowseOption[] =
          f.kind === 'choice'
            ? f.options
                .filter((o) => o.value !== ANY)
                .map((o) => ({
                  value: o.value,
                  label: o.label,
                  group: o.group ?? f.label,
                  ...(o.note ? { note: o.note } : {})
                }))
            : []
        const allLabel = f.kind === 'choice' ? (f.options.find((o) => o.value === ANY)?.label ?? 'All') : 'All'
        return (
          <div key={f.id} className="flex items-center gap-2">
            <span className="font-label text-[10px] font-bold caps-16 text-faint">{f.label}</span>
            {f.kind === 'choice' ? (
              useRich ? (
                <BrowsePick
                  value={cur === ANY ? null : cur}
                  options={browseOptions}
                  placeholder={allLabel}
                  onChange={(v) => onChange(f.id, v ?? ANY)}
                  className="min-w-[10.5rem] max-w-[16rem]"
                />
              ) : (
                <Segmented value={cur} options={f.options} onChange={(v) => onChange(f.id, v)} />
              )
            ) : (
              <>
                <SliderNumber value={Math.min(f.max, Number(values[f.id] ?? f.max))} min={f.step} max={f.max} step={f.step} onChange={(v) => onChange(f.id, v)} className="w-44" />
                <span className="font-data text-[11px] text-dim">{Number(values[f.id] ?? f.max) >= f.max ? 'Any' : `${values[f.id]} ${f.unit}`}</span>
              </>
            )}
          </div>
        )
      })}
      {children && <span className="font-ui text-[11px] text-faint">{children}</span>}
    </div>
  )
}
