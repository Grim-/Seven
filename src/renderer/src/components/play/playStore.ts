import type { ReactNode } from 'react'
import { create } from 'zustand'
import type { DeckRef } from '@shared/cardDecks'
import type { PlayTarget } from '../../game/targets'

export interface PlayWhere {
  link: string | null
  agents: string[]
  world?: string
  map?: string
  sheet?: string | null
  deck?: DeckRef | null
  lead?: string
  onText?: (text: string) => void
  surface?: PlaySurface
  target?: PlayTarget
}

export type PlayTone = 'ok' | 'alert' | 'purple' | 'cyan'

export interface PlayOutcome {
  tone: PlayTone
  label: string
  detail: string
  effects?: string[]
}

export interface PlaySurface {
  show: (title: string, node: ReactNode) => void
  clear: () => void
  close: () => void
  roll: (face: number | null) => void
  settle: (outcome: PlayOutcome) => void
}

export const PLAYED: PlayOutcome = { tone: 'cyan', label: 'Played', detail: '' }

export function sceneLink(link: string | null, player: string | null): string | null {
  return player ? `${link ? `${link}\n` : ''}The user plays @sheet:${player}.` : link
}

export function worldWhere(link: string | null, agents: string[], world: string | undefined, sheet: string | null): PlayWhere {
  return { link: sceneLink(link, sheet), agents, world, sheet, deck: sheet ? { character: sheet } : null }
}

export function playText(where: PlayWhere, text: string): string {
  return where.lead ? `${where.lead}\n${text}` : text
}

export interface PlayView {
  title: string
  node: ReactNode
  wide?: boolean
}

export const usePlay = create<{ view: PlayView | null }>(() => ({ view: null }))

export function showPlay(title: string, node: ReactNode, options: { wide?: boolean } = {}): void {
  usePlay.setState({ view: { title, node, wide: options.wide } })
}

export function closePlay(): void {
  usePlay.setState({ view: null })
}

const panelSurface: PlaySurface = {
  show: (title, node) => showPlay(title, node),
  clear: closePlay,
  close: closePlay,
  roll: () => undefined,
  settle: () => undefined
}

export function surfaceOf(where: PlayWhere): PlaySurface {
  return where.surface ?? panelSurface
}
