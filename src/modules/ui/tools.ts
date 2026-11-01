import type { GatherAnswer, GatherItem, QuestionAnswer } from '@shared/types'
import { ToolError, str, type ToolDef } from '../../engine/tools/types'
import { presentationTool } from '../../engine/present/define'
import { allSources, sourceFor } from '../../engine/sources/registry'

const choices = presentationTool({
  type: 'choices',
  group: 'ui',
  fixed: true,
  description:
    'Ask the user one or more multiple-choice questions, or offer them choices (what to do next, which option they like, where a story goes). Waits for their answer. Put the question in question and only short answer labels in options; never put a question in options. The user can also type their own answer. Do not use it to ask permission for tools.',
  fields: {
    questions: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      description: '1 to 4 questions, asked one after another',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'One question' },
          options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6, description: '2 to 6 short answer labels (a few words each), not questions' },
          multiSelect: { type: ['boolean', 'null'], description: 'true if the user may pick more than one' }
        }
      }
    }
  },
  check: (f) => {
    const list = Array.isArray(f.questions) ? (f.questions as Record<string, unknown>[]) : []
    if (!list.length) throw new ToolError('Give questions as a list of 1 to 4, e.g. [{"question": "Which colour?", "options": ["Red", "Blue"]}].')
    list.forEach((q, i) => {
      const n = list.length > 1 ? ` (question ${i + 1})` : ''
      if (typeof q.question !== 'string' || !q.question.trim()) throw new ToolError(`Each item needs its question text in "question"${n}`)
      const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '') : []
      if (options.length < 2) throw new ToolError(`Give at least 2 options${n}`)
      const bad = options.find((o) => o.trim().endsWith('?') || o.length > 80)
      if (bad)
        throw new ToolError(
          `"${bad.slice(0, 60)}" looks like a question or a sentence, but options must be short answer labels${n}. Put each question in its own "question" field (up to 4 questions per call) and give only answers in "options".`
        )
    })
  },
  title: (f) => {
    const list = Array.isArray(f.questions) ? (f.questions as Record<string, unknown>[]) : []
    return typeof list[0]?.question === 'string' ? (list[0].question as string) : 'Choices'
  },
  run: async (f, ctx) => {
    const list = f.questions as { question: string; options: string[]; multiSelect?: boolean | null }[]
    const answers: { question: string; choices: string[]; other: string | null }[] = []
    for (const q of list) {
      const options = q.options.filter((o) => typeof o === 'string' && o.trim() !== '')
      const answer = (await ctx.ui.ask('question', { question: q.question, options, multiSelect: q.multiSelect === true, allowOther: true })) as QuestionAnswer
      answers.push({ question: q.question, choices: answer.choices, other: answer.other })
    }
    const lines = answers.map((a) => {
      const picked = a.choices.length ? `chose ${a.choices.join(', ')}` : ''
      const other = a.other ? `wrote "${a.other}"` : ''
      return `- ${a.question} The user ${[picked, other].filter(Boolean).join(' and ') || 'did not answer'}.`
    })
    return { text: `${lines.join('\n')}\nAct on ${answers.length > 1 ? 'these answers' : 'this answer'} now. Do not ask the same thing again.`, fields: { answers } }
  }
})

const notify: ToolDef = {
  name: 'notify_user',
  group: 'ui',
  needsWorkspace: false,
  description: 'Show the user a short notification without waiting for a reply.',
  params: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'A few words' },
      message: { type: 'string', description: 'One or two sentences' }
    }
  },
  async execute(params, ctx) {
    ctx.ui.notify(str(params, 'title'), str(params, 'message'))
    return 'Notification shown.'
  }
}

const gather: ToolDef = {
  name: 'gather_from_user',
  group: 'ui',
  needsWorkspace: false,
  maxRepeats: 2,
  activity: () => 'waiting for the data',
  description: 'Ask the user for data to work from (pasted text, a web page, library entries, a file…). Waits, then returns it all, or says why not.',
  params: {
    type: 'object',
    properties: {
      purpose: { type: 'string', description: 'What you will do with it, e.g. "build a persona of Mara from your chats with her"' },
      wants: { type: ['string', 'null'], description: 'What would help most, or null' },
      sources: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Which sources to offer; null offers all' }
    }
  },
  async execute(params, ctx) {
    const purpose = str(params, 'purpose').trim()
    if (!purpose) throw new ToolError('Give purpose: what you will do with the data, e.g. "build a persona of Mara from your chats with her".')
    const available = allSources()
    const asked = Array.isArray(params.sources) ? params.sources.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : []
    const unknown = asked.filter((k) => !sourceFor(k))
    if (unknown.length) throw new ToolError(`No source ${unknown.map((u) => `"${u}"`).join(', ')}. Sources: ${available.map((s) => s.kind).join(', ')}, or null for all.`)
    const offered = asked.length ? available.filter((s) => asked.includes(s.kind)) : available
    const wants = typeof params.wants === 'string' && params.wants.trim() ? params.wants.trim() : null
    const raw = (await ctx.ui.ask('gather', { purpose, wants, sources: offered.map(({ kind, label, icon }) => ({ kind, label, icon })) })) as Partial<GatherAnswer> | null
    const declined = typeof raw?.declined === 'string' ? raw.declined : null
    if (declined !== null) return `The user didn't give the data${declined ? `: ${declined}` : '.'}`
    const items = (Array.isArray(raw?.items) ? raw.items : []).filter((i): i is GatherItem => Boolean(i) && typeof i === 'object' && offered.some((s) => s.kind === (i as GatherItem).source)).slice(0, 30)
    if (!items.length) return 'The user sent nothing.'
    const parts: string[] = []
    const failed: string[] = []
    for (const [i, item] of items.entries()) {
      const source = sourceFor(item.source)!
      try {
        const got = await source.read(item.data ?? {}, { agentId: ctx.agentId, sessionId: ctx.sessionId, signal: ctx.signal })
        parts.push(`## ${i + 1}. ${got.title ?? item.title}\n${got.text.trim()}`)
      } catch (err) {
        failed.push(`${i + 1}. ${item.title}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    const head = `The user gave ${items.length} source${items.length === 1 ? '' : 's'} for "${purpose}".`
    const problems = failed.length ? `\nCould not read:\n${failed.join('\n')}` : ''
    return `${head}${problems}\n\n${parts.join('\n\n')}`.trim()
  }
}

const suggest = presentationTool({
  type: 'suggest',
  group: 'ui',
  fixed: true,
  description: 'At the end of your reply, offer the user 2 to 4 short replies they can click to send. Does not wait.',
  fields: {
    replies: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4, description: '2 to 4 short replies in the user\'s voice, a few words each' }
  },
  check: (f) => {
    const replies = Array.isArray(f.replies) ? f.replies.filter((r): r is string => typeof r === 'string' && r.trim() !== '') : []
    if (replies.length < 2) throw new ToolError('Give replies: 2 to 4 short replies the user might send, e.g. ["Log it", "Show me the plan"].')
    const long = replies.find((r) => r.length > 60)
    if (long) throw new ToolError(`"${long.slice(0, 40)}…" is too long for a reply button. Keep each reply to a few words.`)
  },
  title: () => 'Suggested replies',
  result: () => 'The user sees the replies as buttons. Finish your reply.'
})

export const UI_TOOLS: ToolDef[] = [choices, notify, gather, suggest]
