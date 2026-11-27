import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { Channel, type EventMessage, type SevenApi } from '@shared/protocol'
import { START_COLOR_KEYS, startColorsFromArgs } from '@shared/startColors'

const start = startColorsFromArgs(process.argv)

function paintStart(): void {
  if (!start) return
  for (const k of START_COLOR_KEYS) document.documentElement.style.setProperty(`--boot-${k}`, start[k])
}

if (document.documentElement) paintStart()
else document.addEventListener('DOMContentLoaded', paintStart, { once: true })

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
