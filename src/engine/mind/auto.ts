import { agentSheets, type AgentProfile } from '@shared/types'
import { formatStorySnippet, searchStoryItems, type StoryRecallHit } from '@shared/story'
import { PLACE_TYPE_KEY } from '@shared/world'
import { findSheet } from '../library/sheets'
import { sheetIn } from '../library/holds'
import { knownBy, worldsOfSheet } from '../worlds/knowledge'
import { worlds } from '../worlds/store'
import { minds } from './store'

export function mindAuto(agent: Pick<AgentProfile, 'mindAuto' | 'incognito'>): { recall: boolean; pinned: boolean; cooldown: number } {
  if (agent.incognito) return { recall: false, pinned: false, cooldown: 0 }
  return { recall: agent.mindAuto?.recall !== false, pinned: true, cooldown: agent.mindAuto?.recallCooldown ?? 0 }
}

function placeTokensIn(text: string, worldIds: string[], extraWhere?: string | null): string[] {
  const out = new Set<string>()
  const add = (raw?: string | null) => {
    const clean = (raw ?? '').trim().toLowerCase()
    if (clean.length >= 2) out.add(clean)
  }
  add(extraWhere)
  for (const m of text.matchAll(/@(?:world:[\w-]+\/place\/|place:)([\w-]+)/gi)) {
    add(m[1])
    add(m[1].replace(/[-_]+/g, ' '))
  }
  const lower = text.toLowerCase()
  for (const wId of worldIds) {
    if (!worlds.exists(wId)) continue
    const places = worlds.entities(wId, PLACE_TYPE_KEY)
    for (const [placeId, entity] of Object.entries(places)) {
      const name = typeof entity.name === 'string' ? entity.name.toLowerCase() : ''
      if (name.length >= 3 && lower.includes(name)) {
        add(placeId)
        add(name)
      }
    }
  }
  return [...out]
}

function filterCooldown<T extends { key: string }>(
  items: T[],
  cooldown: number,
  lastRecalled?: Map<string, number>,
  turnIndex?: number
): T[] {
  if (!cooldown || !lastRecalled || turnIndex === undefined) return items
  const kept: T[] = []
  for (const item of items) {
    const prev = lastRecalled.get(item.key)
    if (prev !== undefined && turnIndex - prev < cooldown) continue
    kept.push(item)
  }
  return kept
}

export interface CharacterRecallOpts {
  sceneWhere?: string | null
  cooldownTurns?: number
  lastRecalled?: Map<string, number>
  turnIndex?: number
}

export function characterRecallBlock(agent: AgentProfile, prompt: string, campaign: string | null, opts?: CharacterRecallOpts): string {
  if (prompt.trim().length < 3) return ''
  const refs = agentSheets(agent)
  if (!refs.length) return ''
  const cooldown = opts?.cooldownTurns ?? 0
  const lastRecalled = opts?.lastRecalled
  const turnIndex = opts?.turnIndex

  const foreground: { key: string; sheetTitle: string; hit: StoryRecallHit }[] = []
  const tangential: { key: string; sheetTitle: string; hit: StoryRecallHit }[] = []
  const foregroundIds = new Set<string>()

  for (const ref of refs) {
    const id = findSheet(ref)
    if (!id) continue
    const sheet = sheetIn(id, campaign)
    const worldIds = worldsOfSheet(sheet.id)
    const memories = sheet.mind?.memories ?? []
    const relationships = sheet.relationships ?? []
    const known = knownBy(sheet, worldIds, true)

    const directHits = searchStoryItems(sheet.story, prompt, { memories, relationships, known, includePinned: false })
    for (const hit of directHits.slice(0, 4)) {
      const key = `${sheet.id}:${hit.kind}:${hit.id}`
      foregroundIds.add(key)
      foreground.push({ key, sheetTitle: sheet.title, hit })
    }

    const places = placeTokensIn(prompt, worldIds, opts?.sceneWhere ?? sheet.story.where)
    for (const place of places) {
      const placeHits = searchStoryItems(sheet.story, '', { where: place, memories, includePinned: false })
      for (const hit of placeHits) {
        if (hit.kind === 'relationship' || hit.kind === 'knowledge') continue
        const key = `${sheet.id}:${hit.kind}:${hit.id}`
        if (foregroundIds.has(key) || tangential.some((t) => t.key === key)) continue
        tangential.push({ key, sheetTitle: sheet.title, hit })
      }
    }
  }

  foreground.sort((a, b) => b.hit.score - a.hit.score)
  const fgShown = filterCooldown(foreground, cooldown, lastRecalled, turnIndex).slice(0, 4)
  const tgShown = filterCooldown(tangential, cooldown, lastRecalled, turnIndex).slice(0, 3)

  if (lastRecalled && turnIndex !== undefined) {
    for (const x of fgShown) lastRecalled.set(x.key, turnIndex)
    for (const x of tgShown) lastRecalled.set(x.key, turnIndex)
  }

  const showSheet = refs.length > 1
  const sections: string[] = []
  if (fgShown.length) {
    const lines = fgShown.map((x) => formatStorySnippet(x.hit, showSheet ? x.sheetTitle : undefined))
    sections.push(`[Character foreground recollection (use character_search_knowledge or character_recall_relation for full detail):]\n${lines.join('\n')}`)
  }
  if (tgShown.length) {
    const lines = tgShown.map((x) => formatStorySnippet(x.hit, showSheet ? x.sheetTitle : undefined))
    sections.push(`[Character tangential memory (triggered ONLY by place association — NOT mentioned in the message; treat as background association, not a foreground topic):]\n${lines.join('\n')}`)
  }
  return sections.length ? `\n\n${sections.join('\n\n')}` : ''
}

export async function recallBlock(agentId: string, prompt: string): Promise<string> {
  if (prompt.trim().length < 3) return ''
  const hits = await minds.search(agentId, prompt, 10, ['memory'])
  const seen = new Set<string>()
  const lines: string[] = []
  for (const h of hits) {
    const key = `${h.source}:${h.ref}`
    if (seen.has(key) || lines.length >= 4) continue
    seen.add(key)
    const m = minds.memory(agentId, h.ref)
    if (!m || m.pinned) continue
    lines.push(`- ${m.text.replace(/\s*\n\s*/g, ' ')} (${m.id})`)
  }
  return lines.length ? `\n\n[Agent Mind — memories (out-of-character, maybe relevant):]\n${lines.join('\n')}` : ''
}
