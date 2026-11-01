import type { AgentProfile, ChatMessage } from '@shared/types'
import { linkFor } from '@shared/text'
import { data } from '../data/hub'
import { ToolError, str, type ToolDef } from '../tools/types'
import { findTool } from '../tools/registry'
import type { SessionStore } from '../sessions/store'
import type { AgentRegistry } from '../agents/registry'

const SECTIONS = ['Picture', 'Said', 'Inferred', 'Lines of questioning']
const MAX_STATE = 6000

let deps: { sessions: SessionStore; agents: AgentRegistry } | null = null

export function setupProbe(d: { sessions: SessionStore; agents: AgentRegistry }): void {
  deps = d
}

export function probePageTitle(subject: string): string {
  return `Probe: ${subject.trim().replace(/\s+/g, ' ').slice(0, 80)}`
}

export function openProbePage(subject: string): string {
  const title = probePageTitle(subject)
  const found = data.pages.find(title)
  if (found) return found.id
  const body = [`Probing: ${subject.trim()}`, ...SECTIONS.map((s) => `## ${s}\n${s === 'Picture' ? '(no conclusion yet)' : ''}`)].join('\n\n')
  return data.pages.create({ title, body }).id
}

function probeOf(sessionId: string): { subject: string; pageId: string } {
  if (!deps) throw new ToolError('Probing is not set up')
  const probe = deps.sessions.get(sessionId).probe
  if (!probe) throw new ToolError('This chat is not a probe, so probe_note, probe_line and probe_conclude do nothing here. Carry on without them.')
  if (!data.pages.find(probe.pageId)) throw new ToolError('The page this probe writes to was deleted, so nothing can be saved to it. Tell the user, and put your findings in your reply instead.')
  return probe
}

function by(sessionId: string): string {
  const agent = deps ? deps.agents.getOrDefault(deps.sessions.get(sessionId).agentId) : null
  return `${agent?.name ?? 'agent'}, ${new Date().toISOString().slice(0, 10)}`
}

function append(sessionId: string, section: string, line: string): string {
  const { pageId } = probeOf(sessionId)
  const page = data.pages.write({ ref: pageId, section, body: line, mode: 'append' })
  return `Added to ${section} on "${page.title}".`
}

const note: ToolDef = {
  name: 'probe_note',
  group: 'probe',
  needsWorkspace: false,
  activity: () => 'noting',
  description: 'Record one finding on the probe page. kind "said" is what the user told you; "inferred" is what you read between the lines, with why.',
  params: {
    type: 'object',
    properties: {
      kind: { enum: ['said', 'inferred'] },
      finding: { type: 'string', description: 'One finding, one sentence' },
      why: { type: ['string', 'null'], description: 'For inferred: what gave it away' }
    }
  },
  async execute(params, ctx) {
    const finding = str(params, 'finding').trim()
    if (!finding) throw new ToolError('Give the finding')
    const inferred = params.kind === 'inferred'
    const why = typeof params.why === 'string' && params.why.trim() ? ` (because ${params.why.trim()})` : ''
    return append(ctx.sessionId, inferred ? 'Inferred' : 'Said', `- ${finding}${inferred ? why : ''} _(${by(ctx.sessionId)})_`)
  }
}

const line: ToolDef = {
  name: 'probe_line',
  group: 'probe',
  needsWorkspace: false,
  activity: () => 'changing tack',
  description: 'Close the current line of questioning with what it established, and name the next angle you will take.',
  params: {
    type: 'object',
    properties: {
      established: { type: 'string', description: 'What this line of questioning settled' },
      next: { type: 'string', description: 'The next angle to probe' }
    }
  },
  async execute(params, ctx) {
    const established = str(params, 'established').trim()
    const next = str(params, 'next').trim()
    if (!established || !next) throw new ToolError('Give both what was established and the next angle')
    return append(ctx.sessionId, 'Lines of questioning', `- ${established} Next: ${next} _(${by(ctx.sessionId)})_`)
  }
}

const conclude: ToolDef = {
  name: 'probe_conclude',
  group: 'probe',
  needsWorkspace: false,
  activity: () => 'concluding',
  description: 'Write the whole picture to the probe page: what the user says they want, what you think they want, and what you think they actually want, with the evidence.',
  params: {
    type: 'object',
    properties: {
      says: { type: 'string', description: 'What they say they want' },
      thinks: { type: 'string', description: 'What you think they want' },
      actually: { type: 'string', description: 'What you think they actually want' },
      evidence: { type: 'string', description: 'What from the probe supports this' }
    }
  },
  async execute(params, ctx) {
    const { pageId } = probeOf(ctx.sessionId)
    const parts = ['says', 'thinks', 'actually', 'evidence'].map((k) => str(params, k).trim())
    if (parts.some((p) => !p)) throw new ToolError('Fill in says, thinks, actually and evidence')
    const [says, thinks, actually, evidence] = parts
    const body = `**They say they want:** ${says}\n\n**I think they want:** ${thinks}\n\n**I think they actually want:** ${actually}\n\n**Why:** ${evidence}\n\n_(${by(ctx.sessionId)})_`
    const page = data.pages.write({ ref: pageId, section: 'Picture', body, mode: 'replace' })
    return `The picture is on ${linkFor('page', page.id)}. Tell the user what you concluded, include that link, and ask whether it rings true.`
  }
}

export function probeTools(): ToolDef[] {
  const choices = findTool('ask_user')
  return [...(choices ? [choices] : []), note, line, conclude]
}

export function probeInstructions(agent: AgentProfile, subject: string, pageTitle: string, canChoose: boolean): string {
  return [
    agent.systemPrompt,
    [
      '## Probe',
      `You are probing the user about: ${subject}`,
      'Your only job in this chat is to find out what they really want here: the spirit of it, not just the words they use. Do not do the task itself and do not answer your own questions.',
      canChoose
        ? '- Ask one thing at a time. Use ask_user when options help them react; ask an open question in plain text when you need their own words.'
        : '- Ask one thing at a time, in plain text.',
      '- After each answer, probe_note what you learned: kind "said" for what they told you, "inferred" for what you read between the lines and why.',
      '- Follow one line of questioning until it stops telling you anything new, then probe_line to close it and pick the next angle.',
      `- The page "${pageTitle}" holds everything known so far, from you and any agent that probed this before. It is shown to you with each message. Build on it; never re-ask what it already answers.`,
      '- When you have a clear whole picture, probe_conclude: what they say they want, what you think they want, what you think they actually want, and the evidence. Then tell them and ask if it rings true; keep probing where it does not.'
    ].join('\n')
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const PROBE_LIMIT = 10

function askedIn(messages: ChatMessage[]): string[] {
  const out: string[] = []
  for (const m of messages) {
    if (m.role !== 'assistant') continue
    for (const p of m.parts) {
      if (p.type === 'tool' && p.name === 'ask_user') {
        const qs = Array.isArray(p.args.questions) ? (p.args.questions as { question?: unknown }[]) : []
        for (const q of qs) if (typeof q.question === 'string' && q.question.trim()) out.push(q.question.trim())
      }
    }
    const text = m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('\n')
    const last = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.endsWith('?'))
      .pop()
    if (last) out.push(last.slice(0, 200))
  }
  return out
}

export function probeState(pageId: string, messages: ChatMessage[]): string {
  const page = data.pages.find(pageId) ? data.pages.get(pageId) : null
  if (!page) return ''
  const body = page.body.length > MAX_STATE ? `…${page.body.slice(-MAX_STATE)}` : page.body
  const asked = askedIn(messages)
  const concluded = !/## Picture\s*\n\(no conclusion yet\)/.test(page.body)
  const turn = messages.filter((m) => m.role === 'assistant').length
  const steer = concluded
    ? 'You have already written the picture. Only ask more if the user wants to keep going or says it is wrong; otherwise refine the picture with probe_conclude.'
    : turn >= PROBE_LIMIT
      ? `That is ${turn} questions: enough. Call probe_conclude now with what you have, then tell the user and link the page.`
      : `Question ${turn + 1} of about ${PROBE_LIMIT}. Each question must open something new. If you can't think of a question that would change the picture, conclude instead.`
  const list = asked.length ? `\nQuestions you already asked (never ask these or variations of them again):\n${asked.map((q) => `- ${q}`).join('\n')}` : ''
  return `\n\n[Probe status: ${steer}${list}]\n\n[The probe page ${linkFor('page', page.id)} as it stands now:]\n${body}`
}

export function probeBrief(agent: AgentProfile, subject: string, pageId: string, tools: ToolDef[]): string {
  const title = data.pages.find(pageId)?.title ?? probePageTitle(subject)
  return [
    `${agent.name} is probing you about: ${subject}`,
    `Findings go on ${linkFor('page', pageId)} ("${title}"). It concludes after about ${PROBE_LIMIT} questions, or sooner if it has the picture.`,
    `Tools: ${tools.map((t) => t.name).join(', ')}`,
    '',
    'What it was told:',
    probeInstructions(agent, subject, title, tools.some((t) => t.name === 'ask_user'))
  ].join('\n')
}
