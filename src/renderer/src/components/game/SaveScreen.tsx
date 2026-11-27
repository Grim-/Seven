import { DoorOpen, Play, Trash2 } from 'lucide-react'
import type { GameSave } from '@shared/game/save'
import type { PlaceVisitor } from '@shared/maps'
import { showName } from '@shared/ids'
import { Button, EmptyState, Eyebrow, InlineTitle, askConfirm, confirmDelete } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLibraryData, useLive } from '../../lib/useLive'
import { openEntry } from '../../lib/library'
import type { EntrySurfaceProps, KindScreenProps } from '../../registries/kinds'
import { EntryCard, Facts, Loading } from '../entries/EntryCard'
import { SheetPortrait } from '../data/SheetPortrait'

function useSave(id: string): GameSave | null {
  return useLive(() => engine('saves.get', { id }), 'saves.changed')
}

function useWorldName(world: string | undefined): string | null {
  const list = useLive(() => engine('worlds.list'), 'worlds.changed')
  return list?.find((w) => w.id === world)?.name ?? null
}

function usePeople(save: GameSave | null): PlaceVisitor[] {
  const ids = save ? Object.keys(save.characters) : []
  return useLibraryData(() => (ids.length ? engine('places.visitors', { sheets: ids }) : Promise.resolve([] as PlaceVisitor[])), `save.people.${ids.join(',')}`) ?? []
}

function Loaded({ save, select }: { save: GameSave; select: KindScreenProps['select'] }) {
  const world = useWorldName(save.world)
  const people = usePeople(save)
  const play = () =>
    void engine('saves.select', { world: save.world, id: save.id })
      .then(() => openEntry('world', save.world))
      .catch(failed('Could not open the save'))
  const takeOut = (v: PlaceVisitor) =>
    askConfirm(`Take ${showName(v.name)} out of ${save.name}?`, 'Their game state comes with them onto their sheet, and they leave this world.', 'Take out', () => void engine('saves.takeOut', { sheet: v.sheet }).catch(failed('Could not take them out')))
  const remove = () => confirmDelete(`Delete ${save.name}?`, 'Everything that happened in it is gone for good. Its characters leave first, taking their state onto their sheets.', () => engine('saves.remove', { id: save.id }), () => select({ kind: 'game_save', id: 'all' }))
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <InlineTitle value={save.name} onSave={(name) => void engine('saves.rename', { id: save.id, name }).catch(failed('Could not rename the save'))} />
          <span className="border border-line/50 px-1.5 font-label text-[10px] caps-12 text-dim">Save</span>
          <span className="flex-1" />
          <Button size="sm" variant="primary" icon={<Play />} disabled={!world} onClick={play}>
            Play
          </Button>
          <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
            Delete
          </Button>
        </div>
        <Facts rows={[['World', world ?? `${save.world} (gone)`], ['Flags', Object.keys(save.flags).join(', ') || 'none'], ['Used once-only triggers', String(save.used.length)]]} />
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Characters</Eyebrow>
          {people.length ? (
            people.map((v) => (
              <div key={v.sheet} className="flex items-center gap-2.5 border border-line/40 bg-ink/[0.015] p-2">
                <SheetPortrait image={v.image} className="h-9 w-9" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{showName(v.name)}</span>
                <Button size="sm" variant="ghost" icon={<DoorOpen />} onClick={() => takeOut(v)}>
                  Take out
                </Button>
              </div>
            ))
          ) : (
            <span className="text-[12px] text-faint">Nobody. Put characters on its map in Play to bring them in.</span>
          )}
        </div>
      </div>
    </div>
  )
}

export function SaveScreen({ id, select }: KindScreenProps) {
  const save = useSave(id ?? '')
  if (!id) return null
  if (!save) return <EmptyState title="Loading">One moment.</EmptyState>
  return <Loaded key={save.id} save={save} select={select} />
}

function SaveCard({ id, short }: { id: string; short: boolean }) {
  const save = useSave(id)
  const world = useWorldName(save?.world)
  const people = usePeople(save)
  if (!save) return <Loading />
  const rows: [string, string][] = [['World', world ?? save.world], ['Characters', people.map((v) => showName(v.name)).join(', ') || 'none']]
  return (
    <EntryCard title={save.name} tag="Save" aside={<span className="font-ui text-[11px] text-faint">{save.id}</span>}>
      <Facts rows={short ? rows.slice(0, 1) : rows} />
    </EntryCard>
  )
}

export function SaveChat({ id }: EntrySurfaceProps) {
  return <SaveCard id={id} short={false} />
}

export function SaveWidget({ id }: EntrySurfaceProps) {
  return <SaveCard id={id} short />
}
