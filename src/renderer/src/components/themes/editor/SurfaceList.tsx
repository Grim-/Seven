import { useMemo, useState } from 'react'
import { Crosshair } from 'lucide-react'
import { skinSurfaces } from '@shared/themeLook'
import { Button, ListRow, SearchBox } from '../../ui'

export function SurfaceList({ value, onChange, styled, picking, onPick }: { value: string; onChange: (id: string) => void; styled: Record<string, unknown>; picking: boolean; onPick: () => void }) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const shown = skinSurfaces().filter((s) => !q || s.label.toLowerCase().includes(q) || s.id.includes(q))
    return [...new Set(shown.map((s) => s.group))].map((group) => ({ group, list: shown.filter((s) => s.group === group) }))
  }, [query])
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SearchBox value={query} onChange={setQuery} placeholder="Find a surface" />
      <Button size="sm" variant={picking ? 'primary' : 'secondary'} icon={<Crosshair />} onClick={onPick}>
        {picking ? 'Click any part of Seven…' : 'Pick on screen'}
      </Button>
      <div className="flex flex-col gap-2">
        {groups.map(({ group, list }) => (
          <div key={group} className="flex flex-col">
            <span className="type-eyebrow px-1 pb-1 text-faint">{group}</span>
            {list.map((s) => (
              <ListRow key={s.id} active={s.id === value} onClick={() => onChange(s.id)} title={s.label} subtitle={s.id} meta={styled[s.id] ? <span title="Styled" className="h-1.5 w-1.5 bg-accent" /> : undefined} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
