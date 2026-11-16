import { create } from 'zustand'
import type { PortabilityFormat, PortablePeekResult } from '@shared/portability'
import { engine, main } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import type { DroppedFile } from '../../lib/useFileDrop'

export interface ExportBasketItem {
  key: string
  kind: string
  id: string | null
  title?: string
}

export interface PortableExportState {
  mode: 'items' | 'text'
  items: ExportBasketItem[]
  text: string
  defaultFormat?: PortabilityFormat
}

export interface PortableArrival {
  id: number
  peek: PortablePeekResult
  targetKind: string | null
  dropped: DroppedFile | null
  ask: boolean
}

let basketSeq = 0
let arrivalSeq = 0

function makeKey(kind: string, id: string | null): string {
  return `${kind}:${id ?? '*all*'}:${++basketSeq}`
}

export const usePortability = create<{
  exporting: PortableExportState | null
  arrived: PortableArrival[]
}>(() => ({
  exporting: null,
  arrived: []
}))

export function openPortableExport(opts: {
  kind?: string
  entries?: string[]
  items?: { kind: string; id: string | null; title?: string }[]
  mode?: 'items' | 'text'
  defaultFormat?: PortabilityFormat
} = {}): void {
  const items: ExportBasketItem[] = []
  if (opts.items) {
    for (const item of opts.items) {
      items.push({ key: makeKey(item.kind, item.id), kind: item.kind, id: item.id, title: item.title })
    }
  } else if (opts.kind && opts.entries?.length) {
    for (const entryId of opts.entries) {
      items.push({ key: makeKey(opts.kind, entryId), kind: opts.kind, id: entryId })
    }
  } else if (opts.kind) {
    items.push({ key: makeKey(opts.kind, null), kind: opts.kind, id: null })
  }
  usePortability.setState({
    exporting: {
      mode: opts.mode ?? (items.length ? 'items' : 'text'),
      items,
      text: '',
      defaultFormat: opts.defaultFormat
    }
  })
}

export function closePortableExport(): void {
  usePortability.setState({ exporting: null })
}

export function arrivePortable(
  peeks: PortablePeekResult[],
  opts: { dropped?: DroppedFile[]; targetKind?: string | null; ask?: boolean } = {}
): void {
  if (!peeks.length) return
  const dropped = opts.dropped ?? []
  const targetKind = opts.targetKind ?? null
  const ask = opts.ask ?? false
  const next: PortableArrival[] = peeks.map((peek) => ({
    id: ++arrivalSeq,
    peek,
    targetKind,
    dropped: dropped.find((d) => 'path' in peek.source && d.path === peek.source.path) ?? null,
    ask
  }))
  usePortability.setState((s) => ({ arrived: [...s.arrived, ...next] }))
}

export function updatePortableArrival(id: number, patch: Partial<PortableArrival>): void {
  usePortability.setState((s) => ({
    arrived: s.arrived.map((a) => (a.id === id ? { ...a, ...patch } : a))
  }))
}

export function nextPortableArrival(): void {
  usePortability.setState((s) => ({ arrived: s.arrived.slice(1) }))
}

export async function openPortableImportFromFiles(targetKind: string | null = null): Promise<void> {
  try {
    const paths = await main('dialog.openFiles')
    if (!paths.length) return
    const peeks = await engine('portability.peek', {
      sources: paths.map((path) => ({ path })),
      targetKind
    })
    if (!peeks.length) {
      toast.info('Nothing to import', 'No portable Seven export was found in the selected file.')
      return
    }
    arrivePortable(peeks, { targetKind })
  } catch (err) {
    failed('Could not open the selected file')(err)
  }
}
