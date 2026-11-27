import { useEffect, useState } from 'react'
import type { KindInfo } from '@shared/types'
import { engine, on } from './ipc'
import { useApp } from '../store/app'
import { failed } from './notify'
import { noteFailure } from '../store/problems'

const fetchKinds = () => engine('library.kinds')

export type KindInfoList = Awaited<ReturnType<typeof fetchKinds>>

let cache: KindInfoList | null = null
let pending: Promise<KindInfoList> | null = null

export function loadKindInfos(): Promise<KindInfoList> {
  if (cache) return Promise.resolve(cache)
  pending ??= fetchKinds()
    .then((list) => (cache = list))
    .finally(() => (pending = null))
  return pending
}

export function useKindInfos(enabled = true): KindInfoList {
  const [list, setList] = useState<KindInfoList>(cache ?? [])
  useEffect(() => {
    if (!enabled) return
    let live = true
    const load = () =>
      void loadKindInfos()
        .then((l) => live && setList(l))
        .catch(() => undefined)
    load()
    const off = on('tools.changed', () => {
      cache = null
      load()
    })
    return () => {
      live = false
      off()
    }
  }, [enabled])
  return list
}

export function useKindList(): KindInfo[] {
  const [list, setList] = useState<KindInfo[]>([])
  useEffect(() => {
    const load = () =>
      void engine('library.kindInfo')
        .then(setList)
        .catch(noteFailure('library', 'Could not list the kinds'))
    load()
    return on('tools.changed', load)
  }, [])
  return list
}

export function saveTrayKinds(next: string[]): void {
  void useApp
    .getState()
    .updateSettings({ trayKinds: next })
    .catch(failed('Could not change the buttons'))
}
