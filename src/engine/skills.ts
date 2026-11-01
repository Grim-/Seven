import fs from 'node:fs'
import path from 'node:path'
import type { SkillInfo } from '@shared/types'
import { getToolsPrefs } from './modules/prefs'

export const SKILL_TEMPLATE = `# Skill name

**Description:** One or two sentences on what this skill does.
**When to Use:** The tasks, keywords or situations it is for.

## Instructions
1. Numbered, exact steps.
2. Name the files, commands or tools involved.

## Output Format
What the result should look like.

## Edge Cases
- If something is missing or goes wrong, what to do instead.
`

const NAME = /^[\w][\w .-]{0,79}$/

function root(): string {
  return getToolsPrefs().skillsFolder
}

function dir(name: string): string {
  const safe = name.trim()
  if (!NAME.test(safe) || safe.includes('..')) throw new Error(`"${safe}" is not a valid skill name (letters, numbers, spaces, . _ -)`)
  return path.join(root(), safe)
}

function frontmatter(text: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const out: Record<string, string> = {}
  for (const line of m ? m[1].split(/\r?\n/) : []) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line)
    if (kv) out[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

function summary(name: string, text: string, updatedAt: number): SkillInfo {
  const fm = frontmatter(text)
  return {
    name,
    title: (fm.name || (/^#\s+(.+)$/m.exec(text) ?? [])[1] || name).trim(),
    description: (fm.description || (/\*\*Description:\*\*\s*(.+)/.exec(text) ?? [])[1] || '').trim(),
    when: (fm.when_to_use || fm['when-to-use'] || (/\*\*When to Use:\*\*\s*(.+)/.exec(text) ?? [])[1] || '').trim(),
    updatedAt
  }
}

export const skills = {
  list(): SkillInfo[] {
    const base = root()
    if (!fs.existsSync(base)) return []
    return fs
      .readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && NAME.test(d.name))
      .map((d) => {
        const file = path.join(base, d.name, 'SKILL.md')
        if (!fs.existsSync(file)) return { name: d.name, title: d.name, description: '(no SKILL.md)', when: '', updatedAt: 0 }
        return summary(d.name, fs.readFileSync(file, 'utf8'), fs.statSync(file).mtimeMs)
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  },
  info(name: string): SkillInfo | null {
    const file = path.join(dir(name), 'SKILL.md')
    return fs.existsSync(file) ? summary(name, fs.readFileSync(file, 'utf8'), fs.statSync(file).mtimeMs) : null
  },
  read(name: string): string {
    const file = path.join(dir(name), 'SKILL.md')
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  },
  write(name: string, text: string): SkillInfo {
    const d = dir(name)
    const s = summary(name, text, Date.now())
    if (!/^#\s+.+$/m.test(text) && !frontmatter(text).name) throw new Error('A skill needs a title: a "# Title" line')
    if (!s.description) throw new Error('A skill needs a "**Description:**" line')
    fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(path.join(d, 'SKILL.md'), text, 'utf8')
    return s
  },
  delete(name: string): boolean {
    const d = dir(name)
    if (!fs.existsSync(d)) return false
    fs.rmSync(d, { recursive: true, force: true })
    return true
  },
  template(): string {
    return SKILL_TEMPLATE
  }
}
