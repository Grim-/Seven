import { usePlaces } from '../store/places'
import { createContext, useContext, useLayoutEffect, type ReactNode } from 'react'
import { useWindows, type WindowApp } from '../store/windows'

const WindowContext = createContext<string | null>(null)

export function WindowProvider({ id, app, focused = false, children }: { id: string; app: WindowApp; focused?: boolean; children: ReactNode }) {
  useLayoutEffect(() => {
    useWindows.getState().register(id, app)
    if (focused) useWindows.getState().focus(id)
  }, [id, app, focused])
  return <WindowContext.Provider value={id}>{children}</WindowContext.Provider>
}

export function useWindowId(): string {
  const id = useContext(WindowContext)
  if (!id) throw new Error('useWindowId needs a WindowProvider')
  return id
}

export function useRememberedLocation<T>(fallback: T): [T, (next: T) => void] {
  const id = useWindowId()
  const key = `location.${id}`
  const remembered = usePlaces((s) => s.places[key] as T | undefined)
  const [value, set] = useLocation<T | undefined>(undefined)
  const save = (next: T) => {
    set(next)
    usePlaces.getState().save(key, next)
  }
  return [value !== undefined ? value : remembered !== undefined ? remembered : fallback, save]
}

export function useLocation<T>(fallback: T): [T, (next: T) => void] {
  const id = useWindowId()
  const value = useWindows((s) => (id in s.locations ? (s.locations[id] as T) : fallback))
  return [value, (next: T) => useWindows.getState().set(id, next)]
}
