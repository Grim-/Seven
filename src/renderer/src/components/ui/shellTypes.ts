import type { ReactNode } from 'react'
import type { MenuItem } from './ContextMenu'
import type { Tone } from './feedback'

export interface ShellTrait {
  key: string
  label: string
  tone?: Tone
  hint?: string
}

export interface ShellItem {
  key: string
  title: string
  subtitle?: string
  excerpt?: string
  icon: ReactNode
  tile?: ReactNode
  thumb?: ReactNode
  face?: ReactNode
  count?: number
  updatedAt?: number
  aside?: string
  action?: ReactNode
  traits?: ShellTrait[]
  color?: string | null
  tag?: string
  kind?: string
  tags?: string[]
  group?: number
  target?: boolean
}

export interface ShellAdd {
  label: string
  icon: ReactNode
  onClick: (e: React.MouseEvent) => void
  children?: MenuItem[]
}

export interface ShellSort {
  id: string
  title: string
  icon: ReactNode
  compare: (a: ShellItem, b: ShellItem) => number
}

export interface ShellGroup {
  label: string
  note?: string
  adds?: ShellAdd[]
}

export type ShellLayout = 'tiles' | 'cards' | 'list' | 'gallery' | 'deck'

export type ShellColumnKey = 'type' | 'name' | 'contents' | 'aside'

export interface ShellColumnSort {
  column: ShellColumnKey
  dir: 'asc' | 'desc'
}

export interface ShellBinding {
  props: React.HTMLAttributes<HTMLElement> & { draggable?: boolean }
  over: boolean
  dragging: boolean
  picked: boolean
}

export interface ShellViewProps {
  shellId?: string
  items: ShellItem[]
  adds: ShellAdd[]
  bind: (item: ShellItem) => ShellBinding
  scale: number
  asideLabel: string
  columnSort?: ShellColumnSort | null
  onColumnSort?: (column: ShellColumnKey) => void
}
