import type { CharacterHold } from '@shared/characterHold'
import type { SheetDraft } from './facets'
import { saveCampaignHold, type SheetHold } from '../../../lib/campaignHold'

export interface Holder {
  key: string
  label: string
  innate: boolean
  hold: CharacterHold
  save: (hold: CharacterHold) => void
}

export const INNATE = 'innate'

export function innateHolder(draft: SheetDraft, change: (next: SheetDraft) => void): Holder {
  return {
    key: INNATE,
    label: 'Innate',
    innate: true,
    hold: {
      memories: draft.mind?.memories ?? [],
      sessions: draft.story.sessions,
      threads: draft.story.threads,
      relationships: draft.relationships ?? [],
      knowledge: draft.mind?.knowledge ?? []
    },
    save: (hold) =>
      change({
        ...draft,
        story: { ...draft.story, sessions: hold.sessions, threads: hold.threads },
        mind: { ...(draft.mind ?? {}), memories: hold.memories, knowledge: hold.knowledge },
        relationships: hold.relationships
      })
  }
}

export function campaignHolders(sheet: string, list: SheetHold[] | null): Holder[] {
  return (list ?? []).map((c) => ({ key: c.id, label: c.title, innate: false, hold: c.hold, save: (hold) => saveCampaignHold(sheet, c.id, hold) }))
}
