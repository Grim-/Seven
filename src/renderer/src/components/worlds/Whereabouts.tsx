import { ChevronDown, Globe, LogOut, MapPin } from 'lucide-react'
import { destinationKey } from '@shared/whereabouts'
import { splitNpcRef } from '@shared/worldNpcs'
import { BrowseList, type BrowseOption } from '../ui/BrowsePick'
import { Popover, openMenu, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { openEntry } from '../../lib/library'
import { cn } from '../../lib/cn'
import { useDestinations, useWhereabouts } from './useWhereabouts'

export function Whereabouts({ sheet, className }: { sheet: string; className?: string }) {
  const here = useWhereabouts(sheet)
  const all = useDestinations()
  const npcRef = splitNpcRef(sheet)
  const visible = npcRef ? all.filter((d) => d.world === npcRef.world) : all
  const options: BrowseOption[] = visible.map((d) =>
    d.place ? { value: destinationKey(d), label: d.placeName, group: d.worldName, note: d.mapName } : { value: destinationKey(d), label: d.mapName, group: `${d.worldName} · maps` }
  )
  const current = here ? destinationKey({ world: here.world, map: here.map ?? '', place: here.place ?? '' }) : null
  const move = (key: string) => {
    const d = all.find((x) => destinationKey(x) === key)
    if (d) void engine('worlds.moveCharacter', { sheet, world: d.world, map: d.map, place: d.place }).catch(failed('Could not move them'))
  }
  const takeOut = () => void engine('worlds.removeCharacter', { sheet }).catch(failed('Could not take them out of the world'))
  const items: MenuItem[] = here
    ? [
        { label: `Open ${here.worldName}`, icon: <Globe />, onSelect: () => openEntry('world', here.world) },
        { label: 'Take out of the world', icon: <LogOut />, danger: true, onSelect: takeOut }
      ]
    : []
  const trail = here ? [here.worldName, here.mapName, here.placeName].filter(Boolean).join(' › ') : 'Not in a world'
  return (
    <div onContextMenu={items.length ? (e) => openMenu(e, trail, items) : undefined} className={cn('flex min-w-0 items-stretch', className)}>
      <Popover
        align="start"
        className="w-[min(30rem,92vw)] p-3"
        rootClassName="min-w-0 flex-1"
        triggerClassName={cn('flex h-full min-h-8 w-full min-w-0 items-center gap-2 border tone-well-40 px-2.5 text-left text-[12.5px] hover:border-accent/70', here ? 'border-secondary/50' : 'border-line/60')}
        trigger={
          <>
            <MapPin className={cn('h-3.5 w-3.5 shrink-0', here ? 'text-secondary' : 'text-faint')} />
            <span title={here ? `Save: ${here.saveName}` : undefined} className={cn('min-w-0 flex-1 truncate', here ? 'text-ink' : 'text-faint')}>
              {trail}
            </span>
            {here?.when && <span className="shrink-0 font-data text-[11px] text-accent">{here.when}</span>}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-dim" />
          </>
        }
      >
        {(close) => (
          <BrowseList
            options={options}
            value={current}
            placeholder="Move to a world, map or place"
            clearLabel="Take out of the world"
            onClear={
              here
                ? () => {
                    takeOut()
                    close()
                  }
                : undefined
            }
            onPick={(key) => {
              move(key)
              close()
            }}
          />
        )}
      </Popover>
    </div>
  )
}
