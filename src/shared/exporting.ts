import { plainText } from './text'

export type ExportFormat = 'markdown' | 'text' | 'json'

export interface ExportSectionInfo {
  id: string
  label: string
  hint: string
  size: string
  on: boolean
}

export interface ExportOptionInfo {
  id: string
  label: string
  choices: { value: string; label: string }[]
  value: string
}

export interface ExportPreset {
  id: string
  label: string
  brief: string
  sections: string[]
}

export interface ExportInfo {
  title: string
  subtitle: string
  sections: ExportSectionInfo[]
  options: ExportOptionInfo[]
  presets: ExportPreset[]
}

export interface ExportChoice {
  source: string
  args: Record<string, string>
  options: Record<string, string>
  sections: string[]
  brief: string
  format: ExportFormat
}

export type ExportBlock = { h: string } | { p: string } | { li: string } | { pre: string } | { md: string }

export interface ExportPart {
  heading: string
  blocks: ExportBlock[]
  json: unknown
}

export function renderExport(
  title: string,
  brief: string,
  parts: { id: string; part: ExportPart }[],
  format: ExportFormat
): string {
  const goal = brief.trim()
  if (format === 'json') {
    const out: Record<string, unknown> = { title }
    if (goal) out.request = goal
    for (const { id, part } of parts) out[id] = part.json
    return JSON.stringify(out, null, 2)
  }
  const md = format === 'markdown'
  const lines: string[] = []
  const section = (heading: string) => {
    if (lines.length) lines.push('')
    lines.push(md ? `# ${heading}` : heading.toUpperCase())
  }
  if (goal) {
    section('What I want help with')
    lines.push(goal)
  }
  for (const { part } of parts) {
    section(part.heading)
    for (const b of part.blocks) {
      if ('h' in b) lines.push('', md ? `## ${b.h}` : `${b.h}:`)
      else if ('p' in b) lines.push(b.p)
      else if ('li' in b) lines.push(md ? `- ${b.li}` : `  ${b.li}`)
      else if ('md' in b) lines.push(md ? b.md : plainText(b.md, true))
      else lines.push(md ? '```' : '', b.pre, md ? '```' : '')
    }
  }
  return `${lines.join('\n')}\n`
}
