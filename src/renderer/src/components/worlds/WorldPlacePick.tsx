import { placePath } from '@shared/maps'
import { BrowsePick, type BrowseOption } from '../ui/BrowsePick'
import { usePlaceRecords, useRegionRecords } from '../maps/usePlaceRecords'

export function WorldPlacePick({
  world,
  value,
  onChange,
  placeholder = 'Everywhere',
  className
}: {
  world: string
  value: string | null
  onChange: (place: string | null) => void
  placeholder?: string
  className?: string
}) {
  const places = usePlaceRecords(world)
  const regions = useRegionRecords(world)
  const name = (key: string) => String(places[key]?.Name || key)
  const options: BrowseOption[] = Object.keys(places)
    .map((key) => {
      const regionKey = typeof places[key]?.Region === 'string' ? (places[key].Region as string) : ''
      const regionName = regionKey && regions[regionKey] ? String(regions[regionKey].Name || regionKey) : ''
      const parents = placePath(places, key).slice(0, -1).map(name)
      const group = [regionName, ...parents].filter(Boolean).join(' › ') || 'Top level'
      return { value: key, label: name(key), group }
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label))
  return <BrowsePick value={value} options={options} placeholder={placeholder} onChange={onChange} className={className} />
}
