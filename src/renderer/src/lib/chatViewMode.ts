import { create } from 'zustand'
import { setCinema } from './cinema'
import { setTabletopMode, useSurfaceSwitcher } from '../components/chat/tabletopStore'

export type ChatViewMode = 'default' | 'tabletop' | 'cinema'

export interface ChatViewModeDef {
  id: ChatViewMode
  index: number
  label: string
  summary: string
  tags: string[]
}

export const CHAT_VIEW_MODES: ChatViewModeDef[] = [
  {
    id: 'default',
    index: 1,
    label: 'Default',
    summary: 'Standard thread with chat list & side panel',
    tags: ['Thread', 'Chat List', 'Side Panel']
  },
  {
    id: 'tabletop',
    index: 2,
    label: 'Tabletop',
    summary: 'Floating thread over SurfaceTops & slates',
    tags: ['SurfaceTop', 'Slates', 'Board']
  },
  {
    id: 'cinema',
    index: 3,
    label: 'Cinema',
    summary: 'Fullscreen immersive thread & HUD rail',
    tags: ['Fullscreen', 'HUD', 'Edge Rail']
  }
]

interface ChatViewSwitcherStore {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useChatViewSwitcher = create<ChatViewSwitcherStore>((set) => ({
  open: false,
  setOpen: (open) => {
    if (open) useSurfaceSwitcher.getState().setOpen(false)
    set({ open })
  },
  toggle: () =>
    set((s) => {
      const next = !s.open
      if (next) useSurfaceSwitcher.getState().setOpen(false)
      return { open: next }
    })
}))

const ORDER: Record<ChatViewMode, ChatViewMode> = {
  default: 'tabletop',
  tabletop: 'cinema',
  cinema: 'default'
}

const APPLY: Record<ChatViewMode, () => void> = {
  default: () => {
    setCinema(false)
    setTabletopMode({ windowed: false, peekTable: false })
  },
  tabletop: () => {
    setCinema(false)
    setTabletopMode({ windowed: true, peekTable: false })
  },
  cinema: () => {
    setTabletopMode({ windowed: false, peekTable: false })
    setCinema(true)
  }
}

export function resolveChatViewMode(cinema: boolean, tabletopWindowed: boolean): ChatViewMode {
  if (cinema) return 'cinema'
  if (tabletopWindowed) return 'tabletop'
  return 'default'
}

export function setChatViewMode(mode: ChatViewMode): void {
  APPLY[mode]()
}

export function cycleChatViewMode(cinema: boolean, tabletopWindowed: boolean): ChatViewMode {
  const next = ORDER[resolveChatViewMode(cinema, tabletopWindowed)]
  setChatViewMode(next)
  return next
}
