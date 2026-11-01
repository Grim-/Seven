const fs = require('fs')
const path = require('path')

const TEMPLATE = `# Skill name

**Description:** One or two sentences on what this skill does.
**When to Use:** The tasks, keywords or situations it is for.

## Instructions
1. Numbered, exact steps.
2. Name the files, commands or tools involved.

## Output Format
What the result should look like.

## Edge Cases
- If something is missing or goes wrong, what to do instead.`

const MAX_FILE = 200000

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const out = {}
  if (!m) return out
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line)
    if (kv) out[kv[1].toLowerCase()] = kv[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}

function summary(text) {
  const fm = frontmatter(text)
  const title = fm.name || (/^#\s+(.+)$/m.exec(text) || [])[1] || ''
  const description = fm.description || (/\*\*Description:\*\*\s*(.+)/.exec(text) || [])[1] || ''
  const when = fm.when_to_use || fm['when-to-use'] || (/\*\*When to Use:\*\*\s*(.+)/.exec(text) || [])[1] || ''
  return { title: title.trim(), description: description.trim(), when: when.trim() }
}

function validate(text) {
  const s = summary(text)
  if (!s.title) throw new Error(`SKILL.md needs a title (a "# Title" line or "name:" in frontmatter).\n\nUse this structure:\n${TEMPLATE}`)
  if (!s.description) throw new Error(`SKILL.md needs a description ("**Description:**" or "description:" in frontmatter).\n\nUse this structure:\n${TEMPLATE}`)
}

module.exports = (sdk) =>
  class Skills extends sdk.ToolModule {
    root() {
      const dir = sdk.paths.skillsFolder()
      fs.mkdirSync(dir, { recursive: true })
      return dir
    }

    skillDir(name) {
      const safe = String(name || '').trim()
      if (!/^[\w][\w .-]{0,79}$/.test(safe) || safe.includes('..')) throw new sdk.ToolError(`"${safe}" is not a valid skill name (letters, numbers, spaces, . _ -)`)
      return path.join(this.root(), safe)
    }

    names() {
      return fs
        .readdirSync(this.root(), { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b))
    }

    files(dir) {
      const out = []
      const walk = (rel, depth) => {
        if (depth > 6) return
        for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
          const p = rel ? `${rel}/${e.name}` : e.name
          if (e.isDirectory()) walk(p, depth + 1)
          else if (e.isFile()) out.push(p)
        }
      }
      walk('', 0)
      return out.sort()
    }

    inside(dir, rel) {
      const target = path.resolve(dir, rel || 'SKILL.md')
      const back = path.relative(dir, target)
      if (!back || back.startsWith('..') || path.isAbsolute(back)) throw new sdk.ToolError('The path must point to a file inside the skill folder')
      return target
    }

    define(tools) {
      const p = sdk.params
      tools.add({
        name: 'list_skills',
        description: "List the saved skills with what each is for, or the files in one skill's folder when skill is given.",
        params: { type: 'object', properties: { skill: { type: ['string', 'null'], description: 'A skill name to list its files, or null to list all skills' } } },
        execute: async (args) => {
          const one = p.optStr(args, 'skill')
          if (one) {
            const dir = this.skillDir(one)
            if (!fs.existsSync(dir)) throw new sdk.ToolError(`There is no skill "${one}". Skills: ${this.names().join(', ') || 'none yet'}`)
            return `Files in "${one}":\n${this.files(dir).map((f) => `- ${f}`).join('\n') || '(none)'}`
          }
          const names = this.names()
          if (!names.length) return 'There are no skills yet.'
          return names
            .map((n) => {
              const file = path.join(this.root(), n, 'SKILL.md')
              const s = fs.existsSync(file) ? summary(fs.readFileSync(file, 'utf8')) : { description: '(no SKILL.md)', when: '' }
              return `- ${n}: ${s.description}${s.when ? ` Use when: ${s.when}` : ''}`
            })
            .join('\n')
        }
      })
      tools.add({
        name: 'read_skill',
        description: "Read a skill. Reads its SKILL.md unless path names another file in the skill's folder.",
        params: {
          type: 'object',
          properties: {
            skill: { type: 'string', description: 'The skill name' },
            path: { type: ['string', 'null'], description: "A file inside the skill's folder, or null for SKILL.md" }
          },
          required: ['skill']
        },
        execute: async (args) => {
          const dir = this.skillDir(p.str(args, 'skill'))
          const file = this.inside(dir, p.optStr(args, 'path'))
          if (!fs.existsSync(file)) throw new sdk.ToolError(`Not found: ${path.relative(dir, file)}. Use list_skills with this skill to see its files.`)
          if (fs.statSync(file).size > MAX_FILE) throw new sdk.ToolError('That file is too large to read here')
          return fs.readFileSync(file, 'utf8')
        }
      })
      tools.add({
        name: 'search_skills',
        description: 'Search every file of every skill for a word or phrase.',
        params: { type: 'object', properties: { query: { type: 'string', description: 'Text to look for (not case-sensitive)' } }, required: ['query'] },
        execute: async (args) => {
          const q = p.str(args, 'query').toLowerCase()
          const hits = []
          for (const name of this.names()) {
            const dir = path.join(this.root(), name)
            for (const f of this.files(dir)) {
              const full = path.join(dir, f)
              if (fs.statSync(full).size > MAX_FILE) continue
              fs.readFileSync(full, 'utf8')
                .split('\n')
                .forEach((line, i) => {
                  if (hits.length < 50 && line.toLowerCase().includes(q)) hits.push(`${name}/${f}:${i + 1}: ${line.trim().slice(0, 160)}`)
                })
            }
          }
          return hits.length ? hits.join('\n') : `Nothing matches "${args.query}".`
        }
      })
      tools.add({
        name: 'write_skill',
        description: `Create or update a file in a skill's folder (SKILL.md unless path is given). Creates the skill if needed. SKILL.md must follow this structure:\n${TEMPLATE}`,
        params: {
          type: 'object',
          properties: {
            skill: { type: 'string', description: 'The skill name (its folder name)' },
            path: { type: ['string', 'null'], description: 'A file inside the skill folder, or null for SKILL.md' },
            content: { type: 'string', description: 'The full file content' }
          },
          required: ['skill', 'content']
        },
        execute: async (args) => {
          const dir = this.skillDir(p.str(args, 'skill'))
          const file = this.inside(dir, p.optStr(args, 'path'))
          const content = String(args.content ?? '')
          if (content.length > MAX_FILE) throw new sdk.ToolError('That file is too large')
          if (path.basename(file) === 'SKILL.md' && path.dirname(file) === dir) validate(content)
          fs.mkdirSync(path.dirname(file), { recursive: true })
          fs.writeFileSync(file, content, 'utf8')
          return `Saved ${path.relative(this.root(), file).split(path.sep).join('/')}.`
        }
      })
      tools.add({
        name: 'delete_skill',
        description: 'Delete a file from a skill, or the whole skill when path is null.',
        params: {
          type: 'object',
          properties: {
            skill: { type: 'string', description: 'The skill name' },
            path: { type: ['string', 'null'], description: 'A file inside the skill folder, or null to delete the whole skill' }
          },
          required: ['skill']
        },
        execute: async (args) => {
          const name = p.str(args, 'skill')
          const dir = this.skillDir(name)
          if (!fs.existsSync(dir)) throw new sdk.ToolError(`There is no skill "${name}"`)
          const rel = p.optStr(args, 'path')
          if (!rel) {
            fs.rmSync(dir, { recursive: true, force: true })
            return `Deleted the skill "${name}".`
          }
          const file = this.inside(dir, rel)
          if (!fs.existsSync(file)) throw new sdk.ToolError(`Not found: ${rel}`)
          fs.rmSync(file, { force: true })
          return `Deleted ${rel} from "${name}".`
        }
      })
    }
  }
