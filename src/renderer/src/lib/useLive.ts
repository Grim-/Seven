import { noteFailure } from '../store/problems'
import { useEffect, useState } from 'react'
import type { EventName } from '@shared/protocol'
import { on } from './ipc'
import { onLibraryChange } from './library'

export function useLive<T>(fetch: () => Promise<T>, event: EventName, deps?: unknown[]): T | null {
  const [value, setValue] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      void fetch()
        .then((v) => live && setValue(v))
        .catch(noteFailure('app', 'Could not load live data'))
    load()
    const off = on(event, load)
    return () => {
      live = false
      off()
    }
  }, [event, ...(deps ?? [])])
  return value
}

export function useLibraryData<T>(fetch: () => Promise<T>, key: string): T | null {
  const [value, setValue] = useState<T | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      void fetch()
        .then((v) => live && setValue(v))
        .catch(noteFailure('app', 'Could not load live data'))
    load()
    const off = onLibraryChange(load)
    return () => {
      live = false
      off()
    }
  }, [key])
  return value
}
