import { create } from 'zustand'
import type { DownloadItem } from '@shared/types'
import { engine } from '../lib/ipc'
import { failed } from '../lib/notify'
import { useApp } from './app'
import { useModels } from './models'

interface DownloadsState {
  list: DownloadItem[]
  refresh: () => Promise<void>
  setList: (list: DownloadItem[]) => void
}

export const useDownloads = create<DownloadsState>((set, get) => ({
  list: [],
  refresh: async () => set({ list: await engine('downloads.list') }),
  setList: (list) => {
    const before = new Map(get().list.map((d) => [d.id, d.state]))
    set({ list })
    if (list.some((d) => d.state === 'done' && before.has(d.id) && before.get(d.id) !== 'done'))
      void useModels
        .getState()
        .scan(useApp.getState().settings?.modelFolders ?? [])
        .catch(failed('Could not rescan your model folders'))
  }
}))
