import { useEffect, useState } from 'react'
import type { GameSave, WorldSaves } from '@shared/game/save'
import { engine, on } from '../../lib/ipc'
import { noteFailure } from '../../store/problems'

function useWorldValue<T>(world: string, load: () => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    const fetch = () =>
      void load()
        .then((v) => live && setValue(v))
        .catch(noteFailure('play', 'Could not load the saves'))
    fetch()
    const off = on('saves.changed', (e) => e.world === world && fetch())
    return () => {
      live = false
      off()
    }
  }, [world])
  return value
}

export function useWorldSaves(world: string): WorldSaves | null {
  return useWorldValue(world, () => engine('saves.list', { world }))
}

export function useCurrentSave(world: string): GameSave | null {
  return useWorldValue(world, () => engine('saves.current', { world }))
}
