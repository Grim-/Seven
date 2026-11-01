import type { AgentProfile } from '@shared/types'
import { minds } from './store'

export function mindAuto(agent: Pick<AgentProfile, 'mindAuto' | 'incognito'>): { recall: boolean; pinned: boolean } {
  if (agent.incognito) return { recall: false, pinned: false }
  return { recall: agent.mindAuto?.recall !== false, pinned: true }
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
