import { paramType } from '../tools/signature'
import type { JsonSchema } from '../tools/schema'
import type { CommandInfo, CommandResult } from '@shared/types'
import type { ToolDef } from '../tools/types'

export interface CommandScope {
  sessionId: string | null
  agentId: string
}

export interface CommandContext extends CommandScope {
  line: string
}

export interface Command extends CommandInfo {
  run(args: string, ctx: CommandContext): Promise<CommandResult>
}

export type CommandSource = (scope: CommandScope) => Command[]

const registry = new Map<string, Command>()
const sources: CommandSource[] = []

export function registerCommand(command: Command): void {
  registry.set(command.name, command)
}

export function registerCommandSource(source: CommandSource): void {
  sources.push(source)
}

export function commandsFor(scope: CommandScope): Command[] {
  const out = new Map<string, Command>()
  for (const source of sources) for (const c of source(scope)) out.set(c.name.toLowerCase(), c)
  for (const c of registry.values()) out.set(c.name.toLowerCase(), c)
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function commandInfo(c: Command): CommandInfo {
  return {
    name: c.name,
    summary: c.summary,
    usage: c.usage,
    needsChat: c.needsChat,
    ...(c.prompt !== undefined ? { prompt: c.prompt } : {}),
    ...(c.args !== undefined ? { args: c.args } : {})
  }
}

export function findCommand(list: Command[], name: string): Command | undefined {
  const key = name.replace(/^\//, '').toLowerCase()
  return list.find((c) => c.name.toLowerCase() === key)
}

export async function runCommand(line: string, scope: CommandScope): Promise<CommandResult> {
  const m = /^\/(\S+)\s*([\s\S]*)$/.exec(line.trim())
  if (!m) throw new Error('Type a command name after /, e.g. /help')
  const list = commandsFor(scope)
  const command = findCommand(list, m[1])
  if (!command) throw new Error(`There is no /${m[1]} here. Commands: ${list.map((c) => `/${c.name}`).join(', ')}`)
  const args = m[2].trim()
  if (HELP_WORDS.test(args)) return { text: command.usage, openSession: null }
  if (command.needsChat && !scope.sessionId) throw new Error(`/${command.name} works inside a chat. Open a chat and type it there.`)
  return command.run(args, { ...scope, line: line.trim() })
}

export function firstSentence(text: string): string {
  const m = /^[\s\S]*?[.!?](\s|$)/.exec(text.trim())
  return (m ? m[0] : text).trim()
}

export function toolUsage(tool: ToolDef): string {
  const props = ((tool.params as { properties?: Record<string, JsonSchema> }).properties ?? {}) as Record<string, JsonSchema>
  const lines = Object.entries(props).map(([k, v]) => {
    const d = (v as { description?: string }).description
    return `- \`${k}\` ${paramType(v)}${d ? ` — ${d}` : ''}`
  })
  return `\`/${tool.name} ${Object.keys(props).map((k) => `${k}=…`).join(' ')}\`\n\n${tool.description}\n\n${lines.join('\n') || 'No options.'}\n\nValues with spaces go in quotes; lists and objects as JSON, e.g. \`names=["a", "b"]\`.`
}

export function parseArgs(input: string, command: string): Record<string, unknown> {
  const text = input.trim()
  if (!text) return {}
  if (text.startsWith('{')) {
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new Error(`That JSON is not valid. Fix it, or give options as name=value instead; /${command} help lists them.`)
    }
  }
  const out: Record<string, unknown> = {}
  const re = /([a-zA-Z_][\w]*)=("(?:[^"\\]|\\.)*"|'[^']*'|\[[^\]]*\]|\{[^}]*\}|\S+)/g
  let m: RegExpExecArray | null
  let used = 0
  while ((m = re.exec(text))) {
    used += m[0].length
    const raw = m[2]
    let value: unknown = raw
    if (/^'.*'$/.test(raw)) value = raw.slice(1, -1)
    else {
      try {
        value = JSON.parse(raw)
      } catch {
        value = raw
      }
    }
    out[m[1]] = value
  }
  if (!used) throw new Error(`Give options as name=value. /${command} help lists them.`)
  return out
}

export const HELP_WORDS = /^(help|\?|options|list( options)?)$/i
