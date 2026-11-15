import { noteFailure } from '../util/report'
import type { JsonObjectSchema } from './schema'
import { panel } from '../panel/store'
import { modules } from '../modules/registry'
import type { AvatarState, FormProps, ApprovalAnswer, ApprovalProps, ConfirmProps, QuestionAnswer, QuestionProps, ToolPart, UiRequestKind, UnlockProps, GatherProps, LinkedFolder } from '@shared/types'
import type { ChatElement } from '@shared/chatElements'
import type { ViewEvent } from '@shared/effects'
import { isVaultLocked } from '@shared/sealed'
import { secure } from '../util/secure'
import type { ToolDef, ToolOutput, UiAccess } from './types'
import type { UiRequests } from '../ui/requests'
import { UiCancelled } from '../ui/requests'
import { gateTool, type PermissionContext } from '../permissions/gate'
import { ToolBlocked, ToolError } from './types'
import { newId } from '../util/fs'
import { fitToBudget, type OutputBudget } from './budget'
import { toId } from '@shared/ids'
import { asActor } from '../timeline/actor'

const MAX_MODEL_CHARS = 16000
const MAX_DISPLAY_CHARS = 20000
const DEFAULT_MAX_REPEATS = 2
const STUCK_AFTER = 3
const CARRY_ON = 'Let it carry on'
const STOP_TRYING = 'Stop trying'

export interface Struggles {
  count(tool: string): number
  note(tool: string, bad: boolean): void
  reset(tool: string): void
  stop(tool: string): void
  stopped(tool: string): boolean
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export interface WrapHooks {
  sessionId: string
  turnId: string
  workspace: string | null
  folders?: () => LinkedFolder[]
  groups?: string[]
  signal: AbortSignal
  requests: UiRequests
  permissions: Omit<PermissionContext, 'ask'>
  addPart: (part: ToolPart) => void
  updatePart: (part: ToolPart) => void
  addElement?: (element: ChatElement) => void
  viewEvents?: (events: ViewEvent[], title: string, world: string | null) => void
  output: (part: ToolPart, chunk: string) => void
  checkpoint: (absPath: string, previous: Buffer | null) => void
  onBlocking: () => void
  repeats?: (key: string) => number
  struggles?: Struggles
  agentName?: string
  budget?: OutputBudget | null
  agentId?: string | null
  react?: (state: AvatarState | null, reaction: string | null, seconds: number) => void
  notify: (title: string, message: string) => void
  images?: (ids: string[]) => void
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const head = text.slice(0, Math.floor(max * 0.7))
  const tail = text.slice(-Math.floor(max * 0.2))
  return `${head}\n… ${text.length - head.length - tail.length} characters omitted …\n${tail}`
}

function normalize(out: string | ToolOutput): ToolOutput {
  return typeof out === 'string' ? { text: out } : out
}

export async function runTool(tool: ToolDef, args: Record<string, unknown>, hooks: WrapHooks): Promise<string> {
  const part: ToolPart = { type: 'tool', id: newId('t'), name: tool.name, args, status: 'running', startedAt: Date.now() }
  hooks.addPart(part)

  const ask = async (kind: UiRequestKind, props: QuestionProps | ConfirmProps | ApprovalProps | FormProps | UnlockProps | GatherProps): Promise<unknown> => {
    const label = 'title' in props ? props.title : 'question' in props ? props.question : 'message' in props ? props.message : 'purpose' in props ? props.purpose : ''
    const { id, answer } = hooks.requests.open(hooks.sessionId, kind, hooks.signal, label, tool.name)
    part.ui = { id, kind, props, status: 'pending' }
    hooks.updatePart(part)
    hooks.onBlocking()
    try {
      const value = await answer
      part.ui = { ...part.ui, status: 'answered', answer: value }
      hooks.updatePart(part)
      return value
    } catch (err) {
      part.ui = { ...part.ui, status: 'cancelled' }
      hooks.updatePart(part)
      throw err
    }
  }

  const ui: UiAccess = { ask: ask as UiAccess['ask'], notify: hooks.notify }
  const permissions: PermissionContext = {
    ...hooks.permissions,
    ask: (props) => ask('approval', props) as Promise<ApprovalAnswer>
  }

  const steer = async (): Promise<string | null> => {
    const struggles = hooks.struggles
    if (!struggles) return null
    const tries = struggles.count(tool.name)
    if (tries < STUCK_AFTER) return null
    const who = hooks.agentName ?? 'The agent'
    const answer = (await ask('question', {
      question: `${who} has tried ${tool.name} ${tries} times in a row without getting what it needs (its calls are above). What should it do? Type guidance, or pick one.`,
      options: [CARRY_ON, STOP_TRYING],
      multiSelect: false,
      allowOther: true
    } satisfies QuestionProps)) as QuestionAnswer
    const said = answer.other?.trim()
    if (said) {
      struggles.reset(tool.name)
      return `This ${tool.name} call was not run. You were stuck, so Seven asked the user for guidance. The user says: "${said}". Follow that now instead of repeating what you tried.`
    }
    if (answer.choices.includes(STOP_TRYING)) {
      struggles.stop(tool.name)
      return `This ${tool.name} call was not run. The user told you to stop trying ${tool.name}. Don't call it again this turn; reply to the user with what you have, or ask them what they want.`
    }
    struggles.reset(tool.name)
    return null
  }

  try {
    if (hooks.struggles?.stopped(tool.name)) {
      throw new ToolBlocked(`The user told you to stop using ${tool.name} for now. Reply to the user with what you have, or ask them what they want.`, `${tool.name} was stopped by the user`)
    }
    const _count = hooks.repeats?.(`${tool.name}:${stable(args)}`) ?? 1
    const _limit = tool.maxRepeats ?? DEFAULT_MAX_REPEATS
    void _count
    void _limit
    // if (count > limit) {
    //   throw new ToolBlocked(
    //     `You already made this exact ${tool.name} call ${limit === 1 ? 'just before this' : `${count - 1} times in a row`} and got its result. Do not repeat it. Use the result you have, do something different, or reply to the user.`,
    //     `repeated the same ${tool.name} call`
    //   )
    // }

    if (tool.permission === 'ask' || tool.permission === 'always')
      await gateTool(permissions, tool, args)

    const run = () =>
      asActor({ agentId: hooks.agentId ?? null, sessionId: hooks.sessionId }, () => tool.execute(args, {
        sessionId: hooks.sessionId,
        workspace: hooks.workspace,
        folders: hooks.folders?.() ?? [],
        groups: hooks.groups ?? [],
        signal: hooks.signal,
        ui,
        permissions,
        checkpoints: { save: hooks.checkpoint },
        output: (chunk) => hooks.output(part, chunk),
        budget: hooks.budget ?? null,
        agentId: hooks.agentId ?? null,
        react: (state, reaction, seconds) => hooks.react?.(state, reaction, seconds),
        addElement: hooks.addElement,
        viewEvents: hooks.viewEvents,
        panel: panel.access(hooks.sessionId, tool.group, modules.panelTab(tool.group))
      }))
    const stoppable = (work: Promise<string | ToolOutput>): Promise<string | ToolOutput> => {
      if (hooks.signal.aborted) return Promise.reject(new UiCancelled())
      return new Promise((resolve, reject) => {
        const onAbort = () => reject(new UiCancelled())
        hooks.signal.addEventListener('abort', onAbort, { once: true })
        work.then(resolve, reject).finally(() => hooks.signal.removeEventListener('abort', onAbort))
      })
    }
    const guidance = await steer()
    let raw: string | ToolOutput
    if (guidance !== null) raw = guidance
    else {
      try {
        raw = await stoppable(run())
      } catch (err) {
        if (!isVaultLocked(err)) throw err
        if (!secure.unlocked) {
          const answer = await ask('unlock', { reason: `${tool.name} needs data from the vault.` } satisfies UnlockProps)
          if (answer !== true || !secure.unlocked)
            throw new ToolError('The vault is locked and the user did not unlock it. Carry on without that data, or tell the user what you needed.')
        }
        raw = await stoppable(run())
      }
    }
    const out = normalize(raw)
    if (guidance === null) hooks.struggles?.note(tool.name, out.empty === true)
    let modelText = tool.fitsItself ? out.text : clip(out.text, MAX_MODEL_CHARS)
    if (hooks.budget && !tool.fitsItself) {
      try {
        const fitted = fitToBudget(part.id, out.text, hooks.budget)
        modelText = fitted.text
        if (fitted.saved) part.cut = true
      } catch (err) {
        noteFailure(err, 'tools', 'Could not fit tool output into the context budget')
        modelText = clip(out.text, MAX_MODEL_CHARS)
      }
    }
    part.status = 'done'
    part.result = clip(out.text, MAX_DISPLAY_CHARS)
    part.view = out.view
    if (out.images?.length) {
      part.images = out.images
      hooks.images?.(out.images)
    }
    part.durationMs = Date.now() - part.startedAt
    hooks.updatePart(part)
    return modelText
  } catch (err) {
    const cancelled = err instanceof UiCancelled || hooks.signal.aborted
    const blocked = err instanceof ToolBlocked
    const message = err instanceof Error ? err.message : String(err)
    part.status = cancelled ? 'cancelled' : blocked ? 'blocked' : 'error'
    part.error = cancelled ? 'Cancelled' : message
    part.durationMs = Date.now() - part.startedAt
    hooks.updatePart(part)
    if (!cancelled) hooks.struggles?.note(tool.name, true)
    if (blocked && !cancelled) hooks.permissions.blocked((err as ToolBlocked).reason)
    if (cancelled) return 'The user cancelled this.'
    const guide = blocked ? undefined : modules.list().find((m) => m.id === tool.group && m.state === 'on' && m.tools.length > 0)
    const help = guide ? ` (How these tools work: read_kind(page, ${toId(`Seven: ${guide.name}`)}).)` : ''
    return blocked ? `Blocked: ${message}` : `Error: ${message}${help}`
  }
}

export interface ToolFunction {
  description: string
  params: JsonObjectSchema
  handler: (params: unknown) => unknown
}

export type ToolFunctions = Record<string, ToolFunction>

export function buildFunctions(tools: ToolDef[], hooks: WrapHooks): ToolFunctions {
  const functions: ToolFunctions = {}
  for (const tool of tools) {
    functions[tool.name] = {
      description: tool.description,
      params: tool.params,
      handler: (params) => runTool(tool, (params ?? {}) as Record<string, unknown>, hooks)
    }
  }
  return functions
}
