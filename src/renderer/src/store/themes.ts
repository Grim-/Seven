import { noteFailure } from './problems'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { DEFAULT_THEME_ID, NO_AMBIENCE, SEVEN_THEME, type Ambience, type Theme } from '@shared/theme'
import { engine } from '../lib/ipc'
import { useAgents } from './agents'
import { useApp } from './app'
import { useAgentIdOf, useFocusedConversation } from '../lib/conversation'
import { failed } from '../lib/notify'

interface ThemesState {
  list: Theme[]
  ambience: Record<string, Ambience>
  preview: Theme | null
  refresh: () => Promise<void>
  loadAmbience: (sessionId: string) => Promise<void>
  setAmbience: (sessionId: string, ambience: Ambience) => void
}

export const useThemes = create<ThemesState>((set) => ({
  list: [SEVEN_THEME],
  ambience: {},
  preview: null,
  refresh: async () => {
    set({ list: await engine('themes.list') })
  },
  loadAmbience: async (sessionId) => {
    const ambience = await engine('ambience.get', { sessionId })
    set((s) => ({ ambience: { ...s.ambience, [sessionId]: ambience } }))
  },
  setAmbience: (sessionId, ambience) => set((s) => ({ ambience: { ...s.ambience, [sessionId]: ambience } }))
}))

export function useActiveTheme(): { theme: Theme; ambience: Ambience; sessionId: string | null } {
  const conv = useFocusedConversation()
  const sessionId = conv?.sessionId ?? null
  const agentId = useAgentIdOf(conv)
  const agentTheme = useAgents((s) => s.list.find((a) => a.id === agentId)?.theme ?? null)
  const fallback = useApp((s) => s.settings?.defaultTheme ?? DEFAULT_THEME_ID)
  const list = useThemes((s) => s.list)
  const preview = useThemes((s) => s.preview)
  const stored = useThemes((s) => (sessionId ? s.ambience[sessionId] : undefined))
  const [, tick] = useState(0)
  useEffect(() => {
    if (sessionId && !stored) void useThemes.getState().loadAmbience(sessionId).catch(noteFailure('themes', 'Could not load the chat ambience'))
  }, [sessionId, stored])
  const until = stored?.until ?? 0
  useEffect(() => {
    if (!until) return
    const timer = setTimeout(() => tick((n) => n + 1), Math.max(0, until - Date.now()) + 50)
    return () => clearTimeout(timer)
  }, [until])
  const ambience = stored && (!stored.until || stored.until > Date.now()) ? stored : NO_AMBIENCE
  const find = (id: string | null) => (id ? list.find((t) => t.id === id) : undefined)
  const theme = preview ?? find(ambience.theme) ?? find(agentTheme) ?? find(fallback) ?? SEVEN_THEME
  return { theme, ambience: preview ? NO_AMBIENCE : ambience, sessionId }
}

export function applyTheme(id: string): void {
  void useApp.getState().updateSettings({ defaultTheme: id }).catch(failed('Could not change the theme'))
}
