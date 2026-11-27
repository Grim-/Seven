import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import type { WorldMapUse } from '@shared/maps'
import { hitDetail, type LibraryHit } from '@shared/types'
import { showName } from '@shared/ids'
import { EmptyState, ListRow, SearchListPanel } from '../ui'
import { useLibraryFind } from '../../lib/useLibraryFind'
import { listKeys } from '../../lib/listKeys'
import { failed } from '../../lib/notify'
import { entryMenuAt } from '../../views/data/entryMenu'
import { SheetJoin, joinWorld } from './SheetJoin'

export function LibrarySheetPick({ world, uses, onClose, onAdded }: { world: WorldMeta; uses: WorldMapUse[]; onClose: () => void; onAdded: (sheet: string) => void }) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [map, setMap] = useState('')
  const hits = useLibraryFind(query, 'sheet', 200)
  const list = hits ?? []
  const inWorld = useMemo(() => new Set(uses.flatMap((u) => Object.keys(u.stand))), [uses])
  const active = list.find((h) => h.id === picked) ?? list.find((h) => !inWorld.has(h.id)) ?? list[0] ?? null
  const target = map || uses[0]?.map || ''

  const quickAdd = (hit: LibraryHit) =>
    void joinWorld(world, hit.id, hit.title, target || null)
      .then(() => {
        onAdded(hit.id)
        onClose()
      })
      .catch(failed('Could not add the character'))

  const keys = listKeys(list, active, (h) => setPicked(h.id), (h) => !inWorld.has(h.id) && quickAdd(h))

  return (
    <div className="grid min-h-[460px] grid-cols-1 gap-4 lg:grid-cols-12">
      <SearchListPanel
        query={query}
        onQuery={setQuery}
        placeholder="Search character sheets"
        count={hits === null ? 'Looking…' : `${list.length} sheets`}
        aside={`${inWorld.size} in this world`}
        onKeyDown={keys}
        className="lg:col-span-5"
      >
        {list.map((h) => (
          <ListRow
            key={h.id}
            active={active?.id === h.id}
            onClick={() => setPicked(h.id)}
            onMenu={(e) => entryMenuAt(e, 'sheet', h.id, h.title, inWorld.has(h.id) ? [] : [{ label: `Add to ${world.name}`, icon: <UserPlus />, onSelect: () => quickAdd(h) }])}
            title={showName(h.title)}
            subtitle={hitDetail(h)}
            meta={inWorld.has(h.id) ? 'In world' : undefined}
          />
        ))}
        {hits !== null && !list.length && <EmptyState title={query ? 'No match' : 'No character sheets'}>{query ? 'Try another name.' : 'Make one in Characters, or use New from Bestiary.'}</EmptyState>}
      </SearchListPanel>

      {active ? (
        <SheetJoin key={active.id} world={world} sheet={active.id} title={active.title} uses={uses} map={target} onMap={setMap} onClose={onClose} onAdded={onAdded} />
      ) : (
        <div className="flex items-center justify-center border border-line tone-panel-60 lg:col-span-7">
          <EmptyState title="Pick a sheet" />
        </div>
      )}
    </div>
  )
}
