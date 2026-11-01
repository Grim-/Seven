import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { Channel, type EventMessage, type SevenApi } from '@shared/protocol'

const listeners = new Map<string, Set<(payload: unknown) => void>>()

ipcRenderer.on(Channel.event, (_event, message: EventMessage) => {
  const set = listeners.get(message.event)
  if (!set) return
  for (const callback of set) callback(message.payload)
})

const seven: SevenApi = {
  engine: (name, params) => ipcRenderer.invoke(Channel.engine, name, params),
  main: (name, params) => ipcRenderer.invoke(Channel.main, name, params),
  on: (event, callback) => {
    let set = listeners.get(event)
    if (!set) {
      set = new Set()
      listeners.set(event, set)
    }
    const fn = callback as (payload: unknown) => void
    set.add(fn)
    return () => {
      set.delete(fn)
    }
  },
  pathForFile: (file) => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('seven', seven)
