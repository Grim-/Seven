import { eventPlace } from '@shared/game/worldEvents'
import { failed } from '../../lib/notify'
import { Eyebrow } from '../ui'
import { EventRow } from './EventRow'
import { openMetaScene } from './useMetaScene'
import { isWaiting, useWorldEvents } from './useWorldEvents'

export function PlaceEvents({ world, place }: { world: string; place: string }) {
  const here = useWorldEvents(world).filter((ev) => isWaiting(ev) && eventPlace(ev) === place)
  const openScene = (eventId: string) => {
    void openMetaScene(world, eventId).catch(failed('Could not open meta-narrative scene'))
  }
  return (
    <div className="flex flex-col gap-1.5 border border-line/60 tone-surface-60 p-3 font-ui text-[11.5px]">
      <Eyebrow className={here.length ? 'text-accent' : undefined}>Active events here ({here.length})</Eyebrow>
      {here.length ? (
        here.map((ev) => <EventRow key={ev.id} worldId={world} ev={ev} onTable={openScene} />)
      ) : (
        <span className="text-[12px] text-faint">Nothing is happening here right now.</span>
      )}
    </div>
  )
}
