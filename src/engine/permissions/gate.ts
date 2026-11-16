import type { ApprovalAnswer, ApprovalProps, PermissionMode, PermissionRules, ShellInfo, ToolPermission } from '@shared/types'
import { ToolBlocked } from '../tools/types'
import { matchesAllowRule, matchesDenyRule } from './command'
import { matchesProtected } from './paths'

export { ToolBlocked }

export interface SessionGrants {
  remember?: boolean
  tools?: Set<string>
  allEdits: boolean
  paths: Set<string>
  commands: Set<string>
  reads: Map<string, number>
}

export function newGrants(): SessionGrants {
  return { allEdits: false, paths: new Set(), commands: new Set(), reads: new Map() }
}

export interface PermissionContext {
  mode: PermissionMode
  rules: PermissionRules
  grants: SessionGrants
  shell: ShellInfo | null
  toolPermission?: ToolPermission
  ask: (props: ApprovalProps) => Promise<ApprovalAnswer>
  blocked: (reason: string) => void
}

export function shouldRunCustomGate(ctx: PermissionContext): boolean {
  return (ctx.toolPermission ?? 'custom') === 'custom'
}

const DENIED_BY_USER = (note: string | null) =>
  `The user denied this${note ? ` and said: "${note}"` : ''}. Do not try to get the same result another way. Ask the user how they want to proceed, or stop.`

async function approve(ctx: PermissionContext, props: ApprovalProps): Promise<ApprovalAnswer> {
  const answer = await ctx.ask(props)
  if (answer.decision === 'deny') {
    throw new ToolBlocked(DENIED_BY_USER(answer.note), 'denied by the user')
  }
  return answer
}

export interface WriteRequest {
  action: 'edit' | 'write'
  relPath: string
  patch: string
  toolsFolder?: boolean
}

export async function gateWrite(ctx: PermissionContext, req: WriteRequest): Promise<void> {
  if (!shouldRunCustomGate(ctx)) return
  const protectedBy = matchesProtected(req.relPath, ctx.rules.protect)
  const title = req.action === 'edit' ? `Edit ${req.relPath}` : `Write ${req.relPath}`
  if (req.toolsFolder) {
    await approve(ctx, {
      action: req.action,
      title,
      reason: "This is inside Seven's tools folder, so it always asks, even in Trusted mode. A changed tool stays paused until you switch it on again in Tools.",
      path: req.relPath,
      command: null,
      shell: null,
      patch: req.patch,
      sessionLabel: null
    })
    return
  }
  if (protectedBy) {
    if (ctx.grants.paths.has(req.relPath)) return
    const answer = await approve(ctx, {
      action: req.action,
      title,
      reason: `${req.relPath} is a protected path (${protectedBy}), so it always asks.`,
      path: req.relPath,
      command: null,
      shell: null,
      patch: req.patch,
      sessionLabel: 'Allow this file for this chat'
    })
    if (answer.decision === 'session') ctx.grants.paths.add(req.relPath)
    return
  }
  if (ctx.mode !== 'ask' || ctx.grants.allEdits) return
  const answer = await approve(ctx, {
    action: req.action,
    title,
    reason: 'Ask mode: every edit needs your approval.',
    path: req.relPath,
    command: null,
    shell: null,
    patch: req.patch,
    sessionLabel: 'Allow all edits in this chat'
  })
  if (answer.decision === 'session') ctx.grants.allEdits = true
}

export async function gateCommand(ctx: PermissionContext, command: string): Promise<void> {
  const denied = matchesDenyRule(command, ctx.rules.deny)
  if (denied) {
    throw new ToolBlocked(
      `This command matches a deny rule and was blocked. Do not try to work around the rule with a different command, a script, or another tool. Tell the user what you were trying to do and let them decide.`,
      'matched a deny rule'
    )
  }
  if (!shouldRunCustomGate(ctx)) return
  if (ctx.grants.commands.has(command)) return
  if (ctx.mode === 'trusted') return
  if (matchesAllowRule(command, ctx.rules.allow)) return
  const answer = await approve(ctx, {
    action: 'command',
    title: 'Run a command',
    reason:
      ctx.mode === 'ask'
        ? 'Ask mode: every command needs your approval.'
        : 'Commands always ask unless they match an allow rule or the chat is trusted.',
    path: null,
    command,
    shell: ctx.shell?.name ?? null,
    patch: null,
    sessionLabel: 'Allow this exact command for this chat'
  })
  if (answer.decision === 'session') ctx.grants.commands.add(command)
}

export async function gateRemember(ctx: PermissionContext, file: string, text: string): Promise<void> {
  if (!shouldRunCustomGate(ctx)) return
  if (ctx.grants.remember) return
  const answer = await approve(ctx, {
    action: 'remember',
    title: `Remember in ${file}`,
    reason: 'Memory changes every future chat, so it always asks, even in Trusted mode.',
    path: file,
    command: null,
    shell: null,
    patch: text
      .trim()
      .split('\n')
      .map((l) => `+${l}`)
      .join('\n'),
    sessionLabel: 'Allow remembering for this chat'
  })
  if (answer.decision === 'session') ctx.grants.remember = true
}

export async function gateTool(ctx: PermissionContext, tool: { name: string; group: string; permission?: string }, args: Record<string, unknown>): Promise<void> {
  const always = tool.permission === 'always'
  if (!always && ctx.grants.tools?.has(tool.name)) return
  if (!always && ctx.mode === 'trusted') return
  const answer = await approve(ctx, {
    action: 'tool',
    title: `Use ${tool.name}`,
    reason: always ? `${tool.name} (from ${tool.group}) always asks, even in Trusted mode.` : `${tool.name} comes from the ${tool.group} module, which asks before each use.`,
    path: null,
    command: null,
    shell: null,
    patch: null,
    details: JSON.stringify(args, null, 2),
    sessionLabel: always ? null : `Allow ${tool.name} for this chat`
  })
  if (answer.decision === 'session' && !always) {
    ctx.grants.tools ??= new Set()
    ctx.grants.tools.add(tool.name)
  }
}
