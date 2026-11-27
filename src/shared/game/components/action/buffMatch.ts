import { entryLink } from '../../core'
import { BUFF_KIND, BUFF_TEMPLATES } from '../../templateKinds'
import { Buffs, type Buff } from '../Buffs'
import type { GameEntity } from '../../core'

export const BUFF_MATCH_PARAMS = {
  buff: { kind: 'template' as const, templateKind: BUFF_TEMPLATES, default: '', description: 'Which buff. Empty: any buff with the tag.' },
  tag: { kind: 'text' as const, default: '', description: 'A tag the buff must have, such as debuff or curable. Empty: any tags.' }
}

export function buffWords(buff: string, tag: string): string {
  if (buff) return tag ? `${entryLink(BUFF_KIND, buff)} tagged ${tag}` : entryLink(BUFF_KIND, buff)
  return tag ? `a buff tagged ${tag}` : 'that buff'
}

export const buffLinks = (list: Buff[]): string => list.map((b) => entryLink(BUFF_KIND, b.id)).join(', ')

export function matchedBuffs(who: GameEntity | null | undefined, params: Record<string, unknown>): { buffs: Buffs | null; found: Buff[]; words: string } {
  const buff = String(params.buff ?? '')
  const tag = String(params.tag ?? '')
  const buffs = who?.comp(Buffs) ?? null
  return { buffs, found: buffs?.matching(buff, tag) ?? [], words: buffWords(buff, tag) }
}

