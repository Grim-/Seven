import { regionPath } from '@shared/maps'
import type { WorldMapUse } from '@shared/maps'
import { BrowsePick, type BrowseOption } from '../ui/BrowsePick'
import { useRegionRecords } from '../maps/usePlaceRecords'

export function WorldRegionPick({
  world,
  value,
  onChange,
  excludeKey,
  placeholder = 'No region',
  className
}: {
  world: string
  value: string | null
  onChange: (region: string | null) => void
  excludeKey?: string
  placeholder?: string
  className?: string
}) {
  const regions = useRegionRecords(world)
  const name = (key: string) => String(regions[key]?.Name || key)
  const options: BrowseOption[] = Object.keys(regions)
    .filter((key) => key !== excludeKey)
    .map((key) => ({
      value: key,
      label: name(key),
      group: regionPath(regions, key).slice(0, -1).map(name).join(' › ') || 'Regions'
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label))
  return <BrowsePick value={value} options={options} placeholder={placeholder} onChange={onChange} className={className} />
}

export function WorldMapPick({
  uses,
  mapNameOf,
  value,
  onChange,
  placeholder = 'Select map',
  className
}: {
  uses: WorldMapUse[]
  mapNameOf: (id: string) => string
  value: string | null
  onChange: (mapId: string) => void
  placeholder?: string
  className?: string
}) {
  const options: BrowseOption[] = uses.map((u) => ({
    value: u.map,
    label: mapNameOf(u.map),
    group: 'World Maps',
    note: `${Object.keys(u.regionShapes ?? {}).length} reg · ${Object.keys(u.shapes).length} plc`
  }))
  return (
    <BrowsePick
      value={value}
      options={options}
      placeholder={placeholder}
      clearable={false}
      onChange={(next) => {
        if (next) onChange(next)
      }}
      className={className}
    />
  )
}
