import { create } from 'zustand'
import type { CarrySummary } from '@shared/carry'
import type { AssetMeta } from '@shared/types'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import type { DroppedFile } from '../../lib/useFileDrop'

export interface CarryTarget {
  entry: string
  title: string
}

export interface Arrival {
  id: number
  found: CarrySummary
  dropped: DroppedFile | null
  ask: boolean
}

export const useCarry = create<{ saving: CarryTarget | 'data' | null; arrived: Arrival[] }>(() => ({ saving: null, arrived: [] }))

let arrivals = 0

function arrive(found: Omit<Arrival, 'id'>[]): void {
  if (found.length) useCarry.setState((s) => ({ arrived: [...s.arrived, ...found.map((a) => ({ ...a, id: ++arrivals }))] }))
}

export function openCarry(target: CarryTarget | null): void {
  useCarry.setState({ saving: target ?? 'data' })
}

export function closeCarry(): void {
  useCarry.setState({ saving: null })
}

export function nextArrived(): void {
  useCarry.setState((s) => ({ arrived: s.arrived.slice(1) }))
}

export function checkCarried(added: AssetMeta[]): void {
  const ids = added.filter((a) => a.mime === 'image/png').map((a) => a.id)
  if (!ids.length) return
  void engine('carry.peek', { sources: ids.map((asset) => ({ asset })) })
    .then((found) => arrive(found.map((f) => ({ found: f, dropped: null, ask: false }))))
    .catch(failed('Could not read what the picture carries'))
}

export function arriveDropped(found: CarrySummary[], dropped: DroppedFile[], ask: boolean): void {
  arrive(found.map((f) => ({ found: f, dropped: dropped.find((d) => 'path' in f.source && d.path === f.source.path) ?? null, ask })))
}
