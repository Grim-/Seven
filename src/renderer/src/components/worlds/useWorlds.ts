import { useEffect, useState } from 'react'
import type { WorldMeta } from '@shared/world'
import { engine, on } from '../../lib/ipc'
import { noteFailure } from '../../store/problems'

export function useWorlds(): WorldMeta[] {
  const [list, setList] = useState<WorldMeta[]>([])
  useEffect(() => {
    const load = () =>
      void engine('worlds.list')
        .then(setList)
        .catch(noteFailure('worlds', 'Could not list the worlds'))
    load()
    return on('worlds.changed', load)
  }, [])
  return list
}
