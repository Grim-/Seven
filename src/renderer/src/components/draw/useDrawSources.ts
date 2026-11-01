import { useEffect, useState } from 'react'
import type { LibraryHit } from '@shared/types'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'

export function useDrawSources(): LibraryHit[] | null {
  const [list, setList] = useState<LibraryHit[] | null>(null)
  useEffect(() => {
    let live = true
    engine('library.drawable', {})
      .then((hits) => live && setList(hits))
      .catch((err) => {
        if (!live) return
        setList([])
        failed('Could not list what can be drawn from')(err)
      })
    return () => {
      live = false
    }
  }, [])
  return list
}
