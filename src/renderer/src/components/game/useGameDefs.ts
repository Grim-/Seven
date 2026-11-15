import { useEffect, useState } from 'react'
import type { GameDef } from '@shared/game/defs/defs'
import { engine, on } from '../../lib/ipc'
import { noteFailure } from '../../store/problems'

export function useGameDefs(type: string): { list: GameDef[] | null; failed: boolean } {
  const [state, setState] = useState<{ list: GameDef[] | null; failed: boolean }>({ list: null, failed: false })
  useEffect(() => {
    let live = true
    const load = () =>
      void engine('game.list', { type })
        .then((list) => live && setState({ list, failed: false }))
        .catch(noteFailure('game', 'Could not list the game definitions', () => live && setState({ list: null, failed: true })))
    load()
    const off = on('game.changed', load)
    return () => {
      live = false
      off()
    }
  }, [type])
  return state
}
