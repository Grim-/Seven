import { create } from 'zustand'

const useOpenSheet = create<{ id: string | null }>(() => ({ id: null }))

export interface SheetHandle {
  open: boolean
  show: () => void
  close: () => void
  toggle: () => void
}

export function useSheet(id: string): SheetHandle {
  const open = useOpenSheet((s) => s.id === id)
  return {
    open,
    show: () => useOpenSheet.setState({ id }),
    close: () => useOpenSheet.setState((s) => (s.id === id ? { id: null } : s)),
    toggle: () => useOpenSheet.setState((s) => ({ id: s.id === id ? null : id }))
  }
}
