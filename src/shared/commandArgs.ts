import type { CommandArg } from './types'

export const PROMPT_VAR_RE = /\{([a-zA-Z_][\w-]*)\}/g

export type PromptSegment = { type: 'text'; value: string } | { type: 'arg'; name: string }

/** Normalize a variable identifier into clean lowercase snake/kebab identifier characters. */
export function sanitizeArgName(raw: string): string {
  return raw
    .trim()
    .replace(/^\{+|\}+$/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()
}

/** Human-readable label for a command variable pill. */
export function argLabel(arg: CommandArg): string {
  if (arg.label?.trim()) return arg.label.trim()
  return arg.name.replace(/[_-]+/g, ' ').trim()
}

/** Collect unique placeholder names appearing as `{name}` in a command prompt in first-appearance order. */
export function promptPlaceholders(prompt: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of prompt.matchAll(PROMPT_VAR_RE)) {
    const name = m[1]
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/** Merge explicitly defined command variables with any `{var}` placeholders discovered in `prompt`. */
export function commandVariables(prompt?: string, defined?: CommandArg[]): CommandArg[] {
  const out: CommandArg[] = []
  const seen = new Set<string>()
  for (const raw of defined ?? []) {
    const name = raw.name.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      name,
      ...(raw.label?.trim() ? { label: raw.label.trim() } : {}),
      ...(raw.hint?.trim() ? { hint: raw.hint.trim() } : {}),
      ...(raw.default?.trim() ? { default: raw.default.trim() } : {})
    })
  }
  if (prompt) {
    for (const name of promptPlaceholders(prompt)) {
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ name })
    }
  }
  return out
}

/** Split a command prompt template into alternating literal text and `{var}` placeholder segments. */
export function parsePromptSegments(prompt: string): PromptSegment[] {
  const out: PromptSegment[] = []
  let cursor = 0
  for (const m of prompt.matchAll(PROMPT_VAR_RE)) {
    const idx = m.index ?? 0
    if (idx > cursor) out.push({ type: 'text', value: prompt.slice(cursor, idx) })
    out.push({ type: 'arg', name: m[1] })
    cursor = idx + m[0].length
  }
  if (cursor < prompt.length) out.push({ type: 'text', value: prompt.slice(cursor) })
  return out
}

function readQuoted(src: string, start: number): { value: string; next: number; closed: boolean } {
  const quote = src[start]
  let i = start + 1
  let out = ''
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\' && i + 1 < src.length) {
      out += src[i + 1]
      i += 2
      continue
    }
    if (ch === quote) {
      return { value: out, next: i + 1, closed: true }
    }
    out += ch
    i += 1
  }
  return { value: out, next: i, closed: false }
}

/**
 * Parse raw user text following `/command` into named variable values and the active slot index.
 * Multi-arg commands delimit slots with quoted segments `"..."`, explicit `|` dividers, tab-quoted tokens, or `name=value` overrides.
 */
export function parseCommandArgs(
  rawArgs: string,
  vars: CommandArg[]
): { values: Record<string, string>; activeIndex: number } {
  const values: Record<string, string> = {}
  if (vars.length === 0) return { values, activeIndex: 0 }

  if (vars.length === 1) {
    const only = vars[0]
    const trimmed = rawArgs.trim()
    const namedPrefix = `${only.name}=`
    if (only.name !== 'args' && trimmed.toLowerCase().startsWith(namedPrefix.toLowerCase())) {
      const rest = trimmed.slice(namedPrefix.length)
      if (rest.startsWith('"') || rest.startsWith("'")) {
        values[only.name] = readQuoted(rest, 0).value.trim()
      } else {
        values[only.name] = rest.trim()
      }
    } else {
      values[only.name] = trimmed
    }
    return { values, activeIndex: 0 }
  }

  const varByLower = new Map(vars.map((v) => [v.name.toLowerCase(), v.name]))
  const positional: string[] = []
  const named: Record<string, string> = {}
  let slot = 0
  let i = 0
  let endedWithSpaceAfterClosed = false

  while (i < rawArgs.length) {
    while (i < rawArgs.length && /\s/.test(rawArgs[i])) i += 1
    if (i >= rawArgs.length) break

    const rest = rawArgs.slice(i)
    const eq = /^([a-zA-Z_][\w-]*)=/.exec(rest)
    const matchedName = eq ? varByLower.get(eq[1].toLowerCase()) : undefined
    if (eq && matchedName) {
      i += eq[0].length
      if (i < rawArgs.length && (rawArgs[i] === '"' || rawArgs[i] === "'")) {
        const q = readQuoted(rawArgs, i)
        named[matchedName] = q.value
        i = q.next
        endedWithSpaceAfterClosed = q.closed && i < rawArgs.length && /\s/.test(rawArgs[i])
      } else {
        let end = i
        while (end < rawArgs.length && !/\s/.test(rawArgs[end]) && rawArgs[end] !== '|') end += 1
        named[matchedName] = rawArgs.slice(i, end)
        i = end
        endedWithSpaceAfterClosed = i < rawArgs.length && /\s/.test(rawArgs[i])
      }
      continue
    }

    if (rawArgs[i] === '"' || rawArgs[i] === "'") {
      const q = readQuoted(rawArgs, i)
      positional[slot] = q.value
      i = q.next
      if (q.closed) {
        const hasTrailingSpace = i < rawArgs.length && /\s/.test(rawArgs[i])
        slot += 1
        endedWithSpaceAfterClosed = hasTrailingSpace
      } else {
        endedWithSpaceAfterClosed = false
      }
      continue
    }

    if (rawArgs[i] === '|') {
      if (positional[slot] === undefined) positional[slot] = ''
      slot += 1
      i += 1
      endedWithSpaceAfterClosed = true
      continue
    }

    let end = i
    while (end < rawArgs.length && rawArgs[end] !== '|') end += 1
    positional[slot] = rawArgs.slice(i, end).trim()
    i = end
    endedWithSpaceAfterClosed = false
  }

  for (let idx = 0; idx < vars.length; idx += 1) {
    const val = positional[idx]
    if (val !== undefined) values[vars[idx].name] = val
  }
  for (const [k, v] of Object.entries(named)) values[k] = v

  const activeIndex = endedWithSpaceAfterClosed
    ? Math.min(slot, vars.length - 1)
    : Math.min(Math.max(0, positional.length - 1), vars.length - 1)
  return { values, activeIndex }
}

/** Escape and quote a command argument for positional `/command` composer syntax. */
export function quoteArg(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}

/**
 * Rebuild a `/command ...` composer line from per-variable values.
 * Multi-arg commands keep completed preceding slots quoted so phrases with spaces stay separated.
 */
export function formatCommandLine(
  name: string,
  vars: CommandArg[],
  values: Record<string, string>,
  options?: { openSlot?: number; trailingSpace?: boolean }
): string {
  const prefix = `/${name}`
  if (vars.length === 0) return `${prefix} `
  if (vars.length === 1) {
    const v = values[vars[0].name] ?? ''
    return v ? `${prefix} ${v}` : `${prefix} `
  }

  let lastNeeded = options?.openSlot ?? -1
  for (let idx = vars.length - 1; idx >= 0; idx -= 1) {
    if ((values[vars[idx].name] ?? '') !== '') {
      lastNeeded = Math.max(lastNeeded, idx)
      break
    }
  }
  if (lastNeeded < 0) return `${prefix} `

  const tokens: string[] = []
  for (let idx = 0; idx <= lastNeeded; idx += 1) {
    const val = values[vars[idx].name] ?? ''
    const isFinalOpen = idx === lastNeeded && options?.trailingSpace && val === ''
    if (isFinalOpen) break
    if (idx < lastNeeded || options?.trailingSpace || /[\s"|'\\=]/.test(val) || val === '') {
      tokens.push(quoteArg(val))
    } else {
      tokens.push(val)
    }
  }

  const body = tokens.join(' ')
  if (!body) return `${prefix} `
  return `${prefix} ${body}${options?.trailingSpace ? ' ' : ''}`
}

/** Hydrate a command prompt template with parsed command arguments and defaults. */
export function hydrateCommandPrompt(prompt: string, rawArgs: string, definedArgs?: CommandArg[]): string {
  const vars = commandVariables(prompt, definedArgs)
  const trimmed = rawArgs.trim()
  if (vars.length === 0) return trimmed ? `${prompt}\n\n${trimmed}` : prompt
  const hasPlaceholder = promptPlaceholders(prompt).length > 0
  if (!hasPlaceholder) return trimmed ? `${prompt}\n\n${trimmed}` : prompt

  const { values } = parseCommandArgs(rawArgs, vars)
  const varMap = new Map(vars.map((v) => [v.name.toLowerCase(), v]))
  return prompt.replace(PROMPT_VAR_RE, (_full, name: string) => {
    const def = varMap.get(name.toLowerCase())
    const key = def?.name ?? name
    return (values[key] ?? def?.default ?? '').trim()
  })
}
