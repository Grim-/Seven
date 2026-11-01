import { useState, type MouseEvent } from 'react'
import { ExternalLink, Plus, Unlink } from 'lucide-react'
import { EmptyState, Popover, ShellTabs, confirmDelete, openMenu, type MenuItem } from '../ui'
import { EntryPicker } from '../library/EntryPicker'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { openEntry } from '../../lib/library'
import { failed } from '../../lib/notify'
import { useWorldMaps } from './useMap'
import { WorldMapView } from './WorldMapView'

export function WorldMaps({ worldId, onStart }: { worldId: string; onStart: (place: string) => void }) {
  const uses = useWorldMaps(worldId)
  const names = useLive(() => engine('maps.list'), 'maps.changed')
  const [shown, setShown] = useState<string | null>(null)
  const current = uses?.find((u) => u.map === shown)?.map ?? uses?.[0]?.map ?? null
  const nameOf = (id: string) => names?.find((m) => m.id === id)?.name ?? id
  const use = (map: string) =>
    void engine('worlds.useMap', { id: worldId, map })
      .then(() => setShown(map))
      .catch(failed('Could not use the map'))
  const items = (map: string): MenuItem[] => [
    { label: 'Open in Maps', icon: <ExternalLink />, onSelect: () => openEntry('map', map) },
    { label: 'Stop using', icon: <Unlink />, danger: true, onSelect: () => confirmDelete(`Stop using ${nameOf(map)}?`, "This world's places drawn on it come off; the map itself stays in Maps.", () => engine('worlds.dropMap', { id: worldId, map }), undefined, 'Stop using') }
  ]
  const tabMenu = (e: MouseEvent, map: string) => openMenu(e, nameOf(map), items(map))
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <ShellTabs value={current ?? ''} options={(uses ?? []).map((u) => ({ value: u.map, label: nameOf(u.map) }))} onChange={setShown} onMenu={tabMenu}>
        <Popover trigger={<span className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent hover:text-white"><Plus className="h-3.5 w-3.5" />Use a map</span>} title="Use a map from Maps">
          {(close) => <EntryPicker kind="map" title="Use a map" inline onClose={close} onPick={(hit) => (use(hit.id), close())} />}
        </Popover>
        {current && (
          <button type="button" onClick={() => openEntry('map', current)} className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim hover:text-accent">
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Maps
          </button>
        )}
      </ShellTabs>
      {uses && !uses.length && <EmptyState title="No maps yet">Use a map from Maps to draw this world's places on it. Maps are made, imported and edited in Maps; a world only links to them.</EmptyState>}
      {current && <WorldMapView key={current} world={worldId} mapId={current} onStart={onStart} />}
    </div>
  )
}
