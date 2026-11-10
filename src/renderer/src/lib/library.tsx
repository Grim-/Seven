import { useEffect, useRef, useState } from 'react'
import { icons, Box, type LucideProps } from 'lucide-react'
import type { LibrarySection } from '@shared/types'
import type { EventName } from '@shared/protocol'
import { engine, on } from './ipc'
import type { DataSelection } from '../store/data'
import { useApp } from '../store/app'
import { kindUi, noteKindFamilies } from '../registries/kinds'
import { openChat as openConversation } from './conversation'
import { useWindows } from '../store/windows'

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
  'mapObjects.changed',
  'triggerActions.changed',
  'maps.changed',
  'saves.changed'
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

export function useLibrary(query: string, perKind: number, skip: string[] = [], only: string[] | null = null): { sections: LibrarySection[] | null; reload: () => void } {
  const [sections, setSections] = useState<LibrarySection[] | null>(null)
  const latest = useRef(0)
  const load = () => {
    const n = ++latest.current
    void engine('library.overview', { query, perKind, skip, ...(only ? { kinds: only } : {}) })
      .then((s) => {
        noteKindFamilies(s)
        if (n === latest.current) setSections(s)
      })
      .catch(() => n === latest.current && setSections([]))
  }
  useEffect(() => {
    load()
    return onLibraryChange(load)
  }, [query, perKind, skip.join('\n'), only?.join('\n')])
  return { sections, reload: load }
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
  useWindows.getState().set('data', selection)
  if (!show) return
  useWindows.getState().focus('data')
  useApp.getState().setView('data')
}

export function openEntry(kind: string, id: string): void {
  const ui = kindUi(kind)
  if (ui.open) return ui.open(id)
  showInData({ kind, id })
}

export function openChat(id: string): void {
  openConversation(id)
}

