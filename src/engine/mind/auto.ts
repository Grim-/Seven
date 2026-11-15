import { agentSheets, type AgentProfile } from '@shared/types'
import { formatStorySnippet, searchStoryItems, type StoryRecallHit } from '@shared/story'
import { findSheet, getSheet } from '../library/sheets'
import { minds } from './store'

export function mindAuto(agent: Pick<AgentProfile, 'mindAuto' | 'incognito'>): { recall: boolean; pinned: boolean } {
  if (agent.incognito) return { recall: false, pinned: false }
  return { recall: agent.mindAuto?.recall !== false, pinned: true }
}

export function characterRecallBlock(agent: AgentProfile, prompt: string): string {
  if (prompt.trim().length < 3) return ''
  const refs = agentSheets(agent)
  if (!refs.length) return ''
  const collected: { sheetTitle: string; hit: StoryRecallHit }[] = []
  for (const ref of refs) {
    const id = findSheet(ref)
    if (!id) continue
    const sheet = getSheet(id)
    const hits = searchStoryItems(sheet.story, prompt, { memories: sheet.mind?.memories ?? [], includePinned: false })
    for (const hit of hits.slice(0, 4)) {
      collected.push({ sheetTitle: sheet.title, hit })
    }
  }
  if (!collected.length) return ''
  collected.sort((a, b) => b.hit.score - a.hit.score)
  const top = collected.slice(0, 4)
  const showSheet = refs.length > 1
  const lines = top.map((x) => formatStorySnippet(x.hit, showSheet ? x.sheetTitle : undefined))
  return `\n\n[Character relevant memories (use story_recall with id for full detail):]\n${lines.join('\n')}`
}

export async function recallBlock(agentId: string, prompt: string): Promise<string> {
  if (prompt.trim().length < 3) return ''
  const hits = await minds.search(agentId, prompt, 10, ['memory'])
  const seen = new Set<string>()
  const lines: string[] = []
  for (const h of hits) {
    if (seen.has(h.ref) || lines.length >= 4) continue
    seen.add(h.ref)
    const m = minds.memory(agentId, h.ref)
    if (!m || m.pinned) continue
    lines.push(`- ${m.text.replace(/\s*\n\s*/g, ' ')} (${m.id})`)
  }
  return lines.length ? `\n\n[From your memory, maybe relevant:]\n${lines.join('\n')}` : ''
}
