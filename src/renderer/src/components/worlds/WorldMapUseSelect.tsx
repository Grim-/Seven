import type { WorldMapUse } from '@shared/maps'
import { Select } from '../ui'

export function WorldMapUseSelect({ uses, value, onChange, className }: { uses: WorldMapUse[]; value: string; onChange: (map: string) => void; className?: string }) {
  return <Select value={value} options={uses.map((u) => ({ value: u.map, label: u.map }))} onChange={onChange} className={className} />
}
