import type { Page } from '@shared/types'
import { modules } from '../modules/registry'
import { agentAccess } from '../agents/access'
import { sessionAccess } from '../sessions/access'
import { ToolError } from '../tools/types'

export interface Exported {
  title: string
  markdown: string
  json: unknown
}

function cell(v: unknown): string {
  const s = Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '' : String(v)
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

export function pageExport(p: Page): Exported {
  const out = [`# ${p.title}`]
  if (p.type) {
    const text = modules.pageText(p.id)
    if (text) out.push(text)
  }
  if (p.body.trim()) out.push(p.body.trim())
  if (p.records.length) {
    const check = p.fields.find((f) => f.type === 'boolean')
    const label = p.fields.find((f) => f.type === 'text') ?? p.fields[0]
    if (check && label && p.fields.length <= 3) out.push(p.records.map((r) => `- [${r.values[check.name] === true ? 'x' : ' '}] ${cell(r.values[label.name])}`).join('\n'))
    else {
      const names = p.fields.map((f) => f.name)
      out.push([`| ${names.join(' | ')} |`, `| ${names.map(() => '---').join(' | ')} |`, ...p.records.map((r) => `| ${names.map((n) => cell(r.values[n])).join(' | ')} |`)].join('\n'))
    }
  }
  const json: Record<string, unknown> = { title: p.title, text: p.body }
  if (p.fields.length) json.fields = p.fields.map((f) => ({ name: f.name, type: f.type, ...(f.options?.length ? { options: f.options } : {}) }))
  if (p.records.length) json.items = p.records.map((r) => r.values)
  if (p.type) Object.assign(json, { type: p.type, data: p.data })
  return { title: p.title, markdown: out.join('\n\n'), json }
}

export function chatExport(id: string): Exported {
  const s = sessionAccess.list().find((x) => x.id === id)
  if (!s) throw new ToolError(`There is no chat with id "${id}". find with kind chat lists chats.`)
  const name = agentAccess.get(s.agentId)?.name ?? 'Agent'
  const messages = sessionAccess.messages(id).map((m) => ({
    role: m.role === 'user' ? 'user' : name,
    at: new Date(m.createdAt).toISOString(),
    text: m.parts
      .map((p) => (p.type === 'text' ? p.text : ''))
      .join('\n')
      .trim()
  }))
  const markdown = [`# ${s.title}`, `With ${name}, ${new Date(s.createdAt).toLocaleString()}`, ...messages.filter((m) => m.text).map((m) => `**${m.role === 'user' ? 'Me' : m.role}:**\n\n${m.text}`)].join('\n\n')
  return { title: s.title, markdown, json: { title: s.title, agent: name, messages } }
}

