import { toolGuide } from '../tools/signature'
import { sheetMarkdown } from '../library/sheets'
import os from 'node:os'
import type { AgentProfile } from '@shared/types'
import type { ToolDef } from '../tools/types'
import { detectShell } from '../tools/shell'
import { modules } from '../modules/registry'
import { linkedFolders } from '../folders/store'
import { placesGuide } from '../present/guide'
import { libraryGuide } from '../library/kinds'
import { worldGuide } from '../worlds/ops'
import { userSection } from '../user/identity'
import { linkFor } from '@shared/text'

const ROLEPLAY = [
  '## Reply format',
  'Seven styles your replies for roleplay. Write:',
  '- dialogue on its own line as Name: "what they say" (inline *actions* are fine inside it),',
  '- actions on their own line wrapped in *asterisks*,',
  '- narration as plain paragraphs.'
].join('\n')

function memorySection(memoryText: string): string {
  return memoryText.trim() ? `## Pinned memories\nYour own, private to you. Find the rest with recall; things every agent should know live in pages.\n\n${memoryText.trim()}` : ''
}

function filled(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key: string) => vars[key] ?? m)
}

function characterOf(agent: AgentProfile): string {
  if (!agent.sheet) return ''
  try {
    return `## Your character\n${sheetMarkdown(agent.sheet, true).replace(/^# /, '### ').replace(/\n## /g, '\n#### ')}`
  } catch {
    return ''
  }
}

export function promptVars(agent: AgentProfile | null): Record<string, string> {
  const shell = detectShell()
  return {
    workspace: agent ? (agent.workspace ?? '(none)') : "(the agent's workspace)",
    os: `${os.type()} (${process.platform})`,
    shell: shell?.name ?? 'none',
    shellSyntax: shell ? (shell.family === 'bash' ? 'bash' : 'PowerShell') : 'none'
  }
}

export function guideTitle(moduleName: string): string {
  return `Seven: ${moduleName}`
}

export function guideModules(): { id: string; name: string }[] {
  return modules
    .list()
    .filter((m) => m.state === 'on' && m.tools.length > 0)
    .map((m) => ({ id: m.id, name: m.name }))
}

export function guideText(moduleId: string, agent: AgentProfile | null): string | null {
  const info = modules.list().find((m) => m.id === moduleId && m.state === 'on')
  if (!info || !info.tools.length) return null
  const parts = [
    `# ${guideTitle(info.name)}`,
    `${info.description}\nGenerated from the ${info.name} tool module each time it is read, so it is always current; it can't be edited.`,
    `## Tools\n${modules.toolsOf(moduleId).map(toolGuide).join('\n')}`
  ]
  const prompt = filled(modules.promptFor(moduleId), promptVars(agent)).trim()
  if (prompt) parts.push(prompt)
  const help = modules.helpFor(moduleId).trim()
  if (help) parts.push(`## More\n${help}`)
  return parts.join('\n\n')
}

function guidesSection(tools: ToolDef[]): string {
  const on = new Map(guideModules().map((m) => [m.id, m.name]))
  const lines: string[] = []
  for (const group of [...new Set(tools.map((t) => t.group))]) {
    const name = on.get(group)
    if (!name) continue
    lines.push(`- ${name}: ${linkFor('page', guideTitle(name))}`)
  }
  if (!lines.length) return ''
  return ['## Tool guides', 'How each of your tools works is on its guide page. Read the guide before you use its tools for the first time in a chat, and again whenever one of its calls fails.', ...lines].join('\n')
}

export function buildInstructions(agent: AgentProfile, tools: ToolDef[], memoryText = ''): string {
  if (!tools.length) return [characterOf(agent), agent.systemPrompt, userSection(), agent.roleplay ? ROLEPLAY : '', memorySection(memoryText)].filter(Boolean).join('\n\n')
  const env = [`- Operating system: ${os.type()} (${process.platform})`]
  const folders = linkedFolders.forAgent(agent.id)
  if (tools.some((t) => t.needsWorkspace)) {
    if (agent.workspace) {
      env.push(`- Workspace folder: ${agent.workspace}`)
      env.push('- File tool paths are relative to the workspace folder.')
    }
    if (folders.length) {
      env.push(`- Linked folders${agent.workspace ? '' : ' (you have no workspace, so file tools only work here)'}: start a file tool path with @name to use one, e.g. @${folders[0].name}/some/file.md`)
      for (const f of folders) env.push(`  - @${f.name}: ${f.path} (${f.access === 'write' ? 'read and write' : 'read only'}${f.exclude.length ? `; off limits: ${f.exclude.join(', ')}` : ''})`)
      env.push('- Commands (run_command) still run in the workspace; use the file tools for linked folders.')
    }
  }
  env.push("- Each of the user's messages starts with the current date and time.")
  const sections = [
    characterOf(agent),
    agent.systemPrompt,
    userSection(),
    `## Environment\n${env.join('\n')}`,
    [
      '## Tools',
      "- If a task needs a tool you don't have, tell the user instead of pretending.",
      '- Never ask the user for permission to use a tool. Seven asks them itself when an action needs approval.',
      '- Do not repeat a call you already made; use its result.'
    ].join('\n')
  ]
  if (agent.roleplay) sections.push(ROLEPLAY)
  sections.push(libraryGuide(tools.map((t) => t.name), agent.id))
  sections.push(placesGuide(tools))
  if (tools.some((t) => t.name === 'world_recall')) sections.push(worldGuide(agent.world, tools.some((t) => t.name === 'world_create')))
  sections.push(guidesSection(tools))
  sections.push(memorySection(memoryText))
  return sections.filter(Boolean).join('\n\n')
}

export function stateLine(now = new Date()): string {
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return `[${date}, ${time}${zone ? ` ${zone}` : ''}]`
}

export function withState(prompt: string, now = new Date()): string {
  return `${stateLine(now)}\n${prompt}`
}
