import { noteFailure } from '../store/problems'
import { useEffect, useRef, useState } from 'react'
import { icons, Box, type LucideProps } from 'lucide-react'
import type { LibrarySection } from '@shared/types'
import type { EventName } from '@shared/protocol'
import { engine, on } from './ipc'
import type { DataSelection } from '../store/data'
import { useApp } from '../store/app'
import { kindUi, noteKindFamilies } from '../registries/kinds'
import { openChat as openConversation } from './conversation'
import { recordOpenedEntry } from './recentData'
import { useWindows } from '../store/windows'
import { create } from 'zustand'

const EVENTS: EventName[] = [
  'page.changed',
  'asset.changed',
  'workout.changed',
  'python.changed',
  'worlds.changed',
  'mind.changed',
  'styles.changed',
  'commands.changed',
  'tags.changed',
  'sessions.changed',
  'tools.changed',
  'agents.changed',
  'reminders.changed',
  'dashboard.changed',
  'stories.changed',
  'themes.changed',
  'timeline.changed',
  'routines.changed',
  'dnd.changed',
  'game.changed',
  'decisions.changed',
  'storyActions.changed',
  'factions.changed',
  'npcs.changed',
  'knowledge.changed',
  'mapObjects.changed',
  'triggerActions.changed',
  'maps.changed',
  'saves.changed',
  'almanacs.changed'
]

export function onLibraryChange(fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const fire = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(fn, 250)
  }
  const offs = EVENTS.map((e) => on(e, fire))
  return () => {
    if (timer) clearTimeout(timer)
    offs.forEach((off) => off())
  }
}

const kept = new Map<string, LibrarySection[]>()
const stale = new Set<string>()
let watching = false

function watchKept(): void {
  if (watching) return
  watching = true
  onLibraryChange(() => {
    for (const key of kept.keys()) stale.add(key)
  })
}

export function useLibrary(query: string, perKind: number, skip: string[] = [], only: string[] | null = null, enabled = true): { sections: LibrarySection[] | null; reload: () => void } {
  const key = query ? null : JSON.stringify([perKind, skip, only])
  const [sections, setSections] = useState<LibrarySection[] | null>(() => (key ? (kept.get(key) ?? null) : null))
  const latest = useRef(0)
  const load = () => {
    const n = ++latest.current
    void engine('library.overview', { query, perKind, skip, ...(only ? { kinds: only } : {}) })
      .then((s) => {
        noteKindFamilies(s)
        if (key) {
          kept.set(key, s)
          stale.delete(key)
        }
        if (n === latest.current) setSections(s)
      })
      .catch((err: unknown) => {
        if (n === latest.current) setSections([])
        noteFailure('library', 'Could not load the library')(err)
      })
  }
  useEffect(() => {
    if (!enabled) return
    watchKept()
    const have = key ? kept.get(key) : undefined
    if (have) setSections(have)
    if (!have || stale.has(key!)) load()
    return onLibraryChange(load)
  }, [query, perKind, skip.join('\n'), only?.join('\n'), enabled])
  return { sections: enabled ? sections : null, reload: load }
}

function pascal(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('')
}

export function KindIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = (icons as Record<string, typeof Box>)[pascal(name)] ?? Box
  return <Icon {...props} />
}

export function showInData(selection: DataSelection | null, show = true): void {
  if (selection && selection.id !== 'all') recordOpenedEntry(selection.kind, selection.id)
  useWindows.getState().set('data', selection)
  if (!show) return
  useWindows.getState().focus('data')
  useApp.getState().setView('data')
}

export function openEntry(kind: string, id: string): void {
  recordOpenedEntry(kind, id)
  const ui = kindUi(kind)
  if (ui.open) return ui.open(id)
  showInData({ kind, id })
}

const usePendingPart = create<{ at: { kind: string; id: string; part: string } | null }>(() => ({ at: null }))

export function opensAt(kind: string, part: string): boolean {
  return kindUi(kind).opensAt?.(part) ?? false
}

export function openEntryAt(kind: string, id: string, part: string): void {
  usePendingPart.setState({ at: { kind, id, part } })
  openEntry(kind, id)
}

export function useOpenedAt(kind: string, id: string, apply: (part: string) => void): void {
  const at = usePendingPart((s) => (s.at && s.at.kind === kind && s.at.id === id ? s.at : null))
  useEffect(() => {
    if (!at) return
    apply(at.part)
    usePendingPart.setState((s) => (s.at === at ? { at: null } : s))
  }, [at])
}

export function openChat(id: string): void {
  openConversation(id)
}

