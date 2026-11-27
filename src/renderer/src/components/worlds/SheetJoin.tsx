import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import type { PlaceVisitor, WorldMapUse } from '@shared/maps'
import { recordHealth } from '@shared/game/components'
import { showName } from '@shared/ids'
import { Button, Fact, FactGrid, Field, FieldGrid } from '../ui'
import { engine } from '../../lib/ipc'
import { useLibraryData } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { SheetPortrait } from '../data/SheetPortrait'
import { AbilityScoreGrid } from '../dnd/AbilityScoreGrid'
import { FactionSelect } from '../factions/FactionSelect'
import { useGameCatalog } from '../game/useGameCatalog'
import { JoinFooter } from './JoinFooter'
import { useWhereabouts } from './useWhereabouts'
import { WorldMapUseSelect } from './WorldMapUseSelect'

export async function joinWorld(world: WorldMeta, sheet: string, title: string, map: string | null, faction?: { from: string | null; to: string | null }): Promise<void> {
  await engine('worlds.addCharacter', { id: world.id, sheet, map })
  if (faction && faction.to !== faction.from) await engine('sheets.setFaction', { id: sheet, faction: faction.to })
  toast.success('Character Added', `${showName(title)} joined ${world.name}.`)
}

export function SheetJoin({
  world,
  sheet,
  title,
  uses,
  map,
  onMap,
  onClose,
  onAdded
}: {
  world: WorldMeta
  sheet: string
  title: string
  uses: WorldMapUse[]
  map: string
  onMap: (map: string) => void
  onClose: () => void
  onAdded: (sheet: string) => void
}) {
  const [faction, setFaction] = useState<string | null | undefined>(undefined)
  const [adding, setAdding] = useState(false)
  const catalog = useGameCatalog()
  const here = useWhereabouts(sheet)
  const visitor: PlaceVisitor | null = useLibraryData(() => engine('places.visitors', { sheets: [sheet] }), `world-join.${sheet}`)?.[0] ?? null
  const hp = visitor ? (recordHealth(visitor.game, catalog) ?? visitor.dnd?.hp) : null
  const current = visitor?.faction ?? null
  const chosen = faction === undefined ? current : faction
  const already = here?.world === world.id
  const status = already ? `Already in ${world.name}.` : here ? `Leaves ${here.worldName} and joins ${world.name}.` : `Joins ${world.name} as this same sheet. Nothing is copied.`

  const add = async () => {
    setAdding(true)
    try {
      await joinWorld(world, sheet, title, map || null, { from: current, to: chosen })
      onAdded(sheet)
      onClose()
    } catch (err) {
      failed('Could not add the character')(err)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col justify-between gap-4 border border-line tone-panel-60 p-4 lg:col-span-7">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 border border-line/60 tone-surface-60 p-3">
          <SheetPortrait image={visitor?.image ?? null} className="h-14 w-14" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[14px] font-bold text-ink">{showName(title)}</span>
            {visitor?.line && <span className="truncate text-[11.5px] text-dim">{visitor.line}</span>}
          </div>
        </div>

        <FactGrid>
          <Fact label="Hit points">{hp ? `${hp.cur} / ${hp.max}` : 'Unset'}</Fact>
          <Fact label="Armor class">{visitor?.dnd?.ac ?? 'Unset'}</Fact>
          <Fact label="Speed">{visitor?.dnd?.speed !== undefined ? `${visitor.dnd.speed} ft` : 'Unset'}</Fact>
          <Fact label="Now in">{here ? [here.worldName, here.mapName, here.placeName].filter(Boolean).join(' › ') : 'No world'}</Fact>
        </FactGrid>

        {visitor?.dnd?.stats && <AbilityScoreGrid stats={visitor.dnd.stats} />}

        <FieldGrid>
          <Field label="Faction" tip="Sets who they side with in this world. Saved to the sheet.">
            <FactionSelect value={chosen} onChange={setFaction} className="h-8 text-[11.5px]" />
          </Field>
          {uses.length > 0 && (
            <Field label="Map">
              <WorldMapUseSelect uses={uses} value={map} onChange={onMap} className="h-8 text-[11.5px]" />
            </Field>
          )}
        </FieldGrid>
      </div>

      <JoinFooter note={status} busy={adding} onCancel={onClose}>
        <Button size="sm" variant="primary" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => void add()} disabled={already || adding}>
          {adding ? 'Adding…' : 'Add to World'}
        </Button>
      </JoinFooter>
    </div>
  )
}
