import { create } from 'zustand'
import type { AssetMeta } from '@shared/types'
import type { CarrySummary } from '@shared/carry'
import { engine } from './ipc'
import { failed } from './notify'
import { addPaths, importToLibrary } from './importFiles'
import { showInData } from './library'
import type { DroppedFile } from './useFileDrop'
import { toast } from '../store/toasts'
import { useApp } from '../store/app'
import { arriveDropped } from '../components/carry/carryStore'

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

const isPicture = (d: DroppedFile) => d.file.type.startsWith('image/')

export async function dropFiles(dropped: DroppedFile[], ask: boolean): Promise<void> {
  const pictures = dropped.filter(isPicture)
  const rest = dropped.filter((d) => !isPicture(d))
  if (rest.length) {
    const { files } = await importToLibrary(rest.map((d) => d.path))
    shown(files)
  }
  const pngs = pictures.filter((d) => d.file.type === 'image/png')
  const found = pngs.length
    ? await engine('carry.peek', { sources: pngs.map((d) => ({ path: d.path })) }).catch((err) => {
        failed('Could not read what the picture carries')(err)
        return [] as CarrySummary[]
      })
    : []
  const carrying = new Set(found.flatMap((f) => ('path' in f.source ? [f.source.path] : [])))
  arriveDropped(found, pngs, ask)
  placePictures(pictures.filter((d) => !carrying.has(d.path)), ask)
}
