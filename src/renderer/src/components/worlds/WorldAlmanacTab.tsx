import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useLive } from '../../lib/useLive'
import { AlmanacScreen } from '../almanac/AlmanacScreen'
import { Button, EmptyState } from '../ui'

export function WorldAlmanacTab({ world }: { world: WorldMeta }) {
  const save = useLive(() => engine('saves.current', { world: world.id }), 'saves.changed', [world.id]) ?? null
  const almanacs = useLive(() => engine('almanacs.list'), 'almanacs.changed', [world.id]) ?? []
  const [creating, setCreating] = useState(false)

  const matchedAlmanac = useMemo(() => {
    if (save?.almanacId) {
      const hit = almanacs.find((a) => a.id === save.almanacId)
      if (hit) return hit
    }
    return almanacs.find((a) => a.worldId === world.id) ?? null
  }, [almanacs, save?.almanacId, world.id])

  const createAlmanac = async () => {
    setCreating(true)
    try {
      await engine('almanacs.save', {
        almanac: {
          title: save ? `${world.name} — ${save.name}` : `${world.name} Chronicle`,
          worldId: world.id,
          saveId: save?.id ?? null,
          currentTime: save?.clock.time ?? world.launch?.startingTime ?? 8 * 3600
        }
      })
    } catch (err) {
      failed('Could not create world almanac')(err)
    } finally {
      setCreating(false)
    }
  }

  if (!matchedAlmanac) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmptyState title={`No Almanac for ${world.name} yet`}>
          Your Almanac tracks the campaign chronicle, world clock, story threads, broadsheet dispatches, and archived scenes for this world.
          <div className="mt-3 flex justify-center">
            <Button size="sm" variant="primary" icon={<Plus />} disabled={creating} onClick={() => void createAlmanac()}>
              {creating ? 'Creating…' : 'Start Campaign Almanac'}
            </Button>
          </div>
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <AlmanacScreen
        kind="almanac"
        id={matchedAlmanac.id}
        select={() => undefined}
      />
    </div>
  )
}
