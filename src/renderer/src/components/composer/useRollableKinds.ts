import { useEffect, useState } from 'react'
import { engine } from '../../lib/ipc'
import { noteFailure } from '../../store/problems'

export function useRollableKinds(): Set<string> {
  const [kinds, setKinds] = useState<Set<string>>(new Set())
  useEffect(() => {
    let live = true
    void engine('library.kinds')
      .then((list) => live && setKinds(new Set(list.filter((k) => k.rollable).map((k) => k.kind))))
      .catch(noteFailure('composer', 'Could not load the kinds'))
    return () => {
      live = false
    }
  }, [])
  return kinds
}
