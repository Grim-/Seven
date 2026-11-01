import { create } from 'zustand'

export type WindowApp = 'chats' | 'data' | 'view'

interface WindowsState {
  apps: Record<string, WindowApp>
  locations: Record<string, unknown>
  focused: string | null
  chat: string | null
  home: string | null
  register: (id: string, app: WindowApp) => void
  set: (id: string, location: unknown) => void
  focus: (id: string) => void
  setHome: (id: string) => void
}

export const useWindows = create<WindowsState>((set, get) => ({
  apps: {},
  locations: {},
  focused: null,
  chat: null,
  home: null,
  register: (id, app) => {
    if (get().apps[id] === app) return
    set((s) => ({ apps: { ...s.apps, [id]: app } }))
  },
  set: (id, location) => set((s) => ({ locations: { ...s.locations, [id]: location } })),
  focus: (id) => set((s) => ({ focused: id, chat: s.apps[id] === 'chats' ? id : s.chat })),
  setHome: (id) => set((s) => ({ home: id, chat: s.chat ?? id }))
}))

export function windowsOf(app: WindowApp): string[] {
  const { apps } = useWindows.getState()
  return Object.keys(apps).filter((id) => apps[id] === app)
}
