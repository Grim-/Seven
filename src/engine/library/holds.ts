import { emptyHold, innateHold, sheetWithHold, type CharacterHold } from '@shared/characterHold'
import type { CharacterSheet } from '@shared/types'
import { almanacs } from '../almanac/store'
import { sessionAccess } from '../sessions/access'
import { getSheet, saveSheet } from './sheets'

export interface HeldIn {
  campaign: string | null
  hold: CharacterHold
}

export function campaignOf(sessionId: string | null): string | null {
  if (!sessionId) return null
  const id = sessionAccess.get(sessionId)?.scene?.almanacId
  return id && almanacs.get(id) ? id : null
}

export function campaignHold(sheetId: string, campaign: string): CharacterHold {
  return almanacs.get(campaign)?.holds?.[sheetId] ?? emptyHold()
}

export function holdIn(sheetId: string, campaign: string | null): CharacterHold {
  return campaign ? campaignHold(sheetId, campaign) : innateHold(getSheet(sheetId))
}

export function sheetIn(ref: string, campaign: string | null): CharacterSheet {
  const s = getSheet(ref)
  return campaign ? sheetWithHold(s, campaignHold(s.id, campaign)) : s
}

export function holdsOf(sheetId: string, campaign: string | null): HeldIn[] {
  const innate = { campaign: null, hold: holdIn(sheetId, null) }
  return campaign ? [{ campaign, hold: campaignHold(sheetId, campaign) }, innate] : [innate]
}

export function holdHaving(sheetId: string, campaign: string | null, has: (hold: CharacterHold) => boolean): HeldIn | null {
  return holdsOf(sheetId, campaign).find((h) => has(h.hold)) ?? null
}

export function saveHold(sheetId: string, campaign: string | null, hold: CharacterHold): void {
  if (campaign) {
    const alm = almanacs.get(campaign)
    if (!alm) throw new Error(`No almanac ${campaign}.`)
    almanacs.save({ ...alm, holds: { ...(alm.holds ?? {}), [sheetId]: hold } }, alm.id)
    return
  }
  const s = getSheet(sheetId)
  saveSheet({
    id: s.id,
    title: s.title,
    fields: s.fields,
    values: s.values,
    story: { ...s.story, sessions: hold.sessions, threads: hold.threads },
    mind: { ...(s.mind ?? {}), memories: hold.memories, knowledge: hold.knowledge },
    relationships: hold.relationships
  })
}

export function editHold(sheetId: string, campaign: string | null, edit: (hold: CharacterHold) => CharacterHold): CharacterHold {
  const next = edit(holdIn(sheetId, campaign))
  saveHold(sheetId, campaign, next)
  return next
}
