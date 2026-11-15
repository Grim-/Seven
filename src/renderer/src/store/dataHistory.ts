import { create } from 'zustand'
import type { LibrarySection } from '@shared/types'
import { engine } from '../lib/ipc'
import { kindUi } from '../registries/kinds'
import type { DataSelection } from './data'
import { useWindows } from './windows'

export type DataOverview = 'everything' | 'recent'

export interface DataNavSnapshot {
  selection: DataSelection | null
  overview: DataOverview
}

const MAX_HISTORY = 40

function sameSelection(a: DataSelection | null, b: DataSelection | null): boolean {
  return a === b || (!!a && !!b && a.kind === b.kind && a.id === b.id)
}

function isTransient(selection: DataSelection | null): boolean {
  return !!selection && selection.id.startsWith('_')
}

async function resolveCandidate(
  candidate: DataNavSnapshot,
  sections: LibrarySection[] | null,
  current: DataSelection | null
): Promise<DataNavSnapshot | null> {
  if (sameSelection(candidate.selection, current)) return null
  const sel = candidate.selection
  if (!sel) return candidate
  const displayKind = kindUi(sel.kind).showsAs ?? sel.kind
  if (sections && !sections.some((s) => s.kind === displayKind)) return null
  if (sel.id === 'all') return candidate
  if (isTransient(sel)) return null
  return engine('library.preview', { entry: `@${sel.kind}:${sel.id}` }).then(
    () => candidate,
    () => null
  )
}

interface DataHistoryState {
  past: DataNavSnapshot[]
  overview: DataOverview
  restoring: boolean
  checking: boolean
  setOverview: (overview: DataOverview) => void
  pushPrev: (snap: DataNavSnapshot, current: DataSelection | null) => void
  forgetEntry: (kind: string, id: string) => void
  forgetKindEntries: (kind: string) => void
  goBack: (sections: LibrarySection[] | null) => Promise<void>
}

export const useDataHistory = create<DataHistoryState>((set, get) => ({
  past: [],
  overview: 'everything',
  restoring: false,
  checking: false,

  setOverview: (overview) => set({ overview }),

  pushPrev: (snap, current) => {
    if (isTransient(snap.selection) || sameSelection(snap.selection, current)) return
    set((s) => {
      const top = s.past[s.past.length - 1]
      if (top && sameSelection(top.selection, snap.selection)) return s
      const next = [...s.past, snap]
      return { past: next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next }
    })
  },

  forgetEntry: (kind, id) =>
    set((s) => ({
      past: s.past.filter((item) => !item.selection || item.selection.kind !== kind || item.selection.id !== id)
    })),

  forgetKindEntries: (kind) =>
    set((s) => ({
      past: s.past.filter((item) => !item.selection || item.selection.kind !== kind || item.selection.id === 'all')
    })),

  goBack: async (sections) => {
    if (get().checking) return
    const snapshot = get().past
    if (!snapshot.length) return
    const startEpoch = navEpoch
    set({ checking: true })
    try {
      const current = (useWindows.getState().locations.data as DataSelection | null | undefined) ?? null
      const stack = [...snapshot]
      let firstPopped: DataNavSnapshot | undefined
      let target: DataNavSnapshot | null = null
      while (stack.length > 0) {
        const candidate = stack.pop()!
        firstPopped ??= candidate
        const valid = await resolveCandidate(candidate, sections, current)
        if (navEpoch !== startEpoch) return
        if (valid) {
          target = valid
          break
        }
      }
      if (!target) {
        const fallbackKind = firstPopped?.selection?.kind
        const fallbackDisplay = fallbackKind ? (kindUi(fallbackKind).showsAs ?? fallbackKind) : undefined
        const kindExists = !!fallbackDisplay && (!sections || sections.some((s) => s.kind === fallbackDisplay))
        const rootSelection = kindExists && fallbackKind ? { kind: fallbackKind, id: 'all' } : null
        target = sameSelection(rootSelection, current)
          ? { selection: null, overview: 'everything' }
          : { selection: rootSelection, overview: firstPopped?.overview ?? 'everything' }
      }
      set({ past: stack, restoring: true, overview: target.overview })
      try {
        useWindows.getState().set('data', target.selection)
      } finally {
        set({ restoring: false })
      }
    } finally {
      set({ checking: false })
    }
  }
}))

let navEpoch = 0
let tracked = useWindows.getState().locations.data as DataSelection | null | undefined

useWindows.subscribe((state) => {
  const next = state.locations.data as DataSelection | null | undefined
  if (next === tracked) return
  const prev = tracked
  tracked = next
  const store = useDataHistory.getState()
  if (store.restoring) return
  navEpoch += 1
  if (prev === undefined || next === undefined) return
  store.pushPrev({ selection: prev, overview: store.overview }, next)
})
