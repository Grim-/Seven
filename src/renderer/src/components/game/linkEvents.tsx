import { createContext, useContext, type ReactNode } from 'react'
import { GAME_SIGNALS } from '@shared/game/core'

const LinkEventsContext = createContext<string[]>([])

export function LinkEventsProvider({ events, children }: { events: string[]; children: ReactNode }) {
  return <LinkEventsContext.Provider value={events}>{children}</LinkEventsContext.Provider>
}

export interface SignalOption {
  value: string
  label: string
  group: string
  note: string
}

export function useSignalOptions(): SignalOption[] {
  const linked = useContext(LinkEventsContext)
  return [
    ...linked.map((e) => ({ value: e, label: e, group: 'Link events', note: 'Sent down a link into this thing.' })),
    ...GAME_SIGNALS.map((s) => ({ value: s.id, label: s.id ? `${s.label} (${s.id})` : s.label, group: s.group, note: s.note }))
  ]
}
