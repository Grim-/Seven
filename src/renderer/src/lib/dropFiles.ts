import { create } from 'zustand'
import type { AssetMeta } from '@shared/types'
import type { PortablePeekResult } from '@shared/portability'
import { engine } from './ipc'
import { failed } from './notify'
import { addPaths, importToLibrary } from './importFiles'
import { showInData } from './library'
import type { DroppedFile } from './useFileDrop'
import { toast } from '../store/toasts'
import { useApp } from '../store/app'
import { arrivePortable } from '../components/portability/portabilityStore'

export const usePlacing = create<{ queue: { id: number; dropped: DroppedFile[] }[] }>(() => ({ queue: [] }))

let placings = 0

export function nextPlacing(): void {
  usePlacing.setState((s) => ({ queue: s.queue.slice(1) }))
}

function shown(added: AssetMeta[]): void {
  if (!added.length) return
  toast.success(`Added ${added.length} file${added.length === 1 ? '' : 's'}`, added.map((a) => a.name).join(', '), { label: 'Open', onSelect: () => showInData({ kind: 'file', id: added[0].id }) })
}

export async function importInto(dropped: DroppedFile[], folder: string): Promise<void> {
  try {
    const parent = folder.trim() ? await engine('data.pages.makeFolders', { path: folder }) : null
    shown(await addPaths(dropped.map((d) => d.path), parent))
  } catch (err) {
    failed(`Could not make the folder ${folder}`)(err)
  }
}

export function placePictures(dropped: DroppedFile[], ask: boolean): void {
  if (!dropped.length) return
  const prefs = useApp.getState().settings?.droppedPictures
  if (ask || !prefs || prefs.ask) usePlacing.setState((s) => ({ queue: [...s.queue, { id: ++placings, dropped }] }))
  else void importInto(dropped, prefs.folder)
}

const hasExt = (d: DroppedFile, ext: string) => d.file.name.toLowerCase().endsWith(ext)
const isPicture = (d: DroppedFile) => d.file.type.startsWith('image/')
const isPng = (d: DroppedFile) => d.file.type === 'image/png' || hasExt(d, '.png')
const isBundle = (d: DroppedFile) => hasExt(d, '.sevenpack') || hasExt(d, '.zip')
const isJson = (d: DroppedFile) => d.file.type === 'application/json' || hasExt(d, '.json')

export async function dropFiles(dropped: DroppedFile[], ask: boolean, targetKind: string | null = null): Promise<void> {
  const candidates = dropped.filter((d) => isPng(d) || isBundle(d) || isJson(d))
  const candidatePaths = new Set(candidates.map((d) => d.path))
  const nonPortablePictures = dropped.filter((d) => isPicture(d) && !candidatePaths.has(d.path))
  const rest = dropped.filter((d) => !isPicture(d) && !candidatePaths.has(d.path))

  if (rest.length) {
    const { files } = await importToLibrary(rest.map((d) => d.path))
    shown(files)
  }

  const found = candidates.length
    ? await engine('portability.peek', { sources: candidates.map((d) => ({ path: d.path })), targetKind }).catch((err) => {
        failed('Could not inspect the dropped file')(err)
        return [] as PortablePeekResult[]
      })
    : []

  const ordinaryPngs: DroppedFile[] = []
  const portablePeeks: PortablePeekResult[] = []

  for (const d of candidates) {
    const peek = found.find((p) => 'path' in p.source && p.source.path === d.path)
    if (isPng(d)) {
      if (peek && !peek.error && (peek.about || peek.locked || peek.text !== null || peek.items.length > 0)) {
        portablePeeks.push(peek)
      } else {
        ordinaryPngs.push(d)
      }
      continue
    }
    if (peek) portablePeeks.push(peek)
  }

  if (portablePeeks.length) {
    arrivePortable(portablePeeks, { dropped: candidates, targetKind, ask })
  }
  placePictures([...nonPortablePictures, ...ordinaryPngs], ask)
}
