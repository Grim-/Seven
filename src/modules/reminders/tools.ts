import { ToolError, optInt, optStr, str, type ToolDef } from '../../engine/tools/types'
import { reminders } from '../../engine/reminders/store'
import { parseMoment } from '../../engine/util/when'
import type { ReminderRepeat } from '@shared/types'
import { presentationTool } from '../../engine/present/define'

const REPEATS: ReminderRepeat[] = ['none', 'hourly', 'daily', 'weekdays', 'weekly']
const YEAR = 366 * 86_400_000

export function parseWhen(at: string | null, inMinutes: number | null, now = new Date()): number {
  if (inMinutes !== null) {
    if (inMinutes < 1) throw new ToolError('in_minutes must be at least 1')
    return now.getTime() + inMinutes * 60_000
  }
  const text = (at ?? '').trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(text)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime()
  m = /^(\d{1,2}):(\d{2})$/.exec(text)
  if (m) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2]))
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  const said = parseMoment(text, now, true)
  if (said) return said.getTime()
  throw new ToolError(`"${text}" is not a time Seven understands. Give at like "tomorrow at 9am", "friday 17:30" or "2026-10-08 17:30", or give in_minutes.`)
}

export function describeWhen(at: number, repeat: ReminderRepeat): string {
  const d = new Date(at)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const every = repeat === 'none' ? '' : repeat === 'hourly' ? ', then every hour' : repeat === 'daily' ? `, then every day at ${time}` : repeat === 'weekdays' ? `, then every weekday at ${time}` : `, then every week on ${d.toLocaleDateString('en-GB', { weekday: 'long' })} at ${time}`
  return `${date} ${time}${every}`
}

const setReminder: ToolDef = {
  name: 'set_reminder',
  group: 'reminders',
  needsWorkspace: false,
  description: 'Set a reminder for the user, or (action "run") a scheduled task where you get the message as a new turn at that time.',
  params: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'What to remind the user of, or for action "run" the instruction you will carry out' },
      at: { type: ['string', 'null'], description: 'When, in plain words or local time, e.g. "tomorrow at 9am", "next tuesday 5pm", "17:30" or "2026-10-08 17:30". null if using in_minutes.' },
      in_minutes: { type: ['integer', 'null'], description: 'Minutes from now, or null' },
      repeat: { enum: REPEATS, description: 'none, hourly, daily, weekdays or weekly' },
      action: { enum: ['remind', 'run'], description: 'remind: show the user the message. run: start a turn with the message as your instruction.' },
      chat: { enum: ['this', 'new'], description: 'For action run: continue in this chat or start a new one each time' }
    }
  },
  async execute(params, ctx) {
    if (!ctx.agentId) throw new ToolError('Reminders only work inside a chat with an agent')
    const message = str(params, 'message').trim()
    if (!message) throw new ToolError('Give message: what to remind the user of, e.g. "Take the bread out".')
    const repeat = REPEATS.includes(params.repeat as ReminderRepeat) ? (params.repeat as ReminderRepeat) : 'none'
    const when = parseWhen(optStr(params, 'at'), optInt(params, 'in_minutes'))
    if (when <= Date.now()) throw new ToolError(`That time (${new Date(when).toLocaleString('en-GB')}) has already passed. Give a later at, e.g. "tomorrow at 9am", or in_minutes for a time from now.`)
    if (when - Date.now() > YEAR) throw new ToolError('Reminders can be at most a year ahead. Give an earlier at, or fewer in_minutes.')
    const run = params.action === 'run'
    const sessionId = run && params.chat === 'new' ? null : ctx.sessionId
    const described = describeWhen(when, repeat)
    if (run) {
      const ok = await ctx.ui.ask('confirm', {
        message: `Allow a scheduled task? At ${described}, the agent will start a turn${sessionId ? ' in this chat' : ' in a new chat'} with: "${message}". It follows the usual approvals.`,
        confirmLabel: 'Allow',
        cancelLabel: 'Deny'
      })
      if (ok !== true) throw new ToolError('The user did not allow this scheduled task. Do not set it again unless they ask; to just remind them, use action remind.')
    }
    const r = reminders.add({ agentId: ctx.agentId, sessionId, kind: run ? 'run' : 'remind', text: message, repeat, at: when })
    return `${run ? 'Scheduled task' : 'Reminder'} set (${r.id}) for ${described}.`
  }
}

const listReminders: ToolDef = {
  name: 'list_reminders',
  group: 'reminders',
  needsWorkspace: false,
  description: 'List the reminders and scheduled tasks you have set.',
  params: { type: 'object', properties: {} },
  async execute(_params, ctx) {
    const mine = reminders.list().filter((r) => r.agentId === ctx.agentId)
    if (!mine.length) return 'No reminders set.'
    return mine.map((r) => `- ${r.id}: ${r.kind === 'run' ? 'task' : 'reminder'} ${describeWhen(r.next, r.repeat)}${r.enabled ? '' : ' (paused)'}: ${r.text.slice(0, 120)}`).join('\n')
  }
}

const cancelReminder: ToolDef = {
  name: 'cancel_reminder',
  group: 'reminders',
  needsWorkspace: false,
  description: 'Cancel a reminder or scheduled task by id (from list_reminders).',
  params: { type: 'object', properties: { id: { type: 'string' } } },
  async execute(params, ctx) {
    const id = str(params, 'id').trim()
    const r = reminders.list().find((x) => x.id === id)
    if (!r || r.agentId !== ctx.agentId) throw new ToolError(`You have no reminder "${id}". Use list_reminders.`)
    reminders.cancel(id)
    return `Cancelled ${id}.`
  }
}

const timer = presentationTool({
  type: 'timer',
  group: 'reminders',
  fixed: true,
  description: 'Start a countdown the user can see in the chat, e.g. a 90 second rest. They get an alert when it ends. Does not wait.',
  fields: {
    label: { type: 'string', description: 'What it is for, a few words' },
    seconds: { type: 'integer', description: 'How long, in seconds' }
  },
  check: (f) => {
    if (typeof f.label !== 'string' || !f.label.trim()) throw new ToolError('Give label: what the timer is for, e.g. "Rest".')
    if (typeof f.seconds !== 'number' || !Number.isInteger(f.seconds) || f.seconds < 1) throw new ToolError('Give seconds as a whole number of at least 1, e.g. 90 for a minute and a half.')
    if (f.seconds * 1000 > YEAR) throw new ToolError('A timer can be at most a year. Give fewer seconds, or use set_reminder.')
  },
  title: (f) => (typeof f.label === 'string' ? f.label : 'Timer'),
  run: async (f, ctx) => {
    if (!ctx.agentId) throw new ToolError('Timers only work inside a chat with an agent')
    const at = Date.now() + (f.seconds as number) * 1000
    const r = reminders.add({ agentId: ctx.agentId, sessionId: ctx.sessionId, kind: 'remind', text: (f.label as string).trim(), repeat: 'none', at })
    return { text: `Timer started (${r.id}). The user sees it counting down and gets an alert when it ends. cancel_reminder stops it.`, fields: { reminder: r.id, startedAt: Date.now(), at } }
  }
})

export const REMINDER_TOOLS: ToolDef[] = [setReminder, listReminders, cancelReminder, timer]
