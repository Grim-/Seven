import { noteFailure } from '../util/report'
const META = /[;&|<>$`(){}\r\n\\!^%@]/

export function isSimpleCommand(command: string): boolean {
  return command.trim().length > 0 && !META.test(command)
}

export function tokenize(command: string): string[] | null {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let started = false
  for (const ch of command.trim()) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      started = true
      continue
    }
    if (/\s/.test(ch)) {
      if (started) tokens.push(current)
      current = ''
      started = false
      continue
    }
    current += ch
    started = true
  }
  if (quote) return null
  if (started) tokens.push(current)
  return tokens
}

function unsafeArg(arg: string): boolean {
  const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : arg
  return (
    value.startsWith('/') ||
    value.startsWith('~') ||
    /^[a-zA-Z]:/.test(value) ||
    value.split(/[\\/]/).includes('..') ||
    /[*?[\]]/.test(value)
  )
}

export function matchesAllowRule(command: string, rules: string[]): string | null {
  if (!isSimpleCommand(command)) return null
  const tokens = tokenize(command)
  if (!tokens || !tokens.length) return null
  for (const rule of rules) {
    const ruleTokens = tokenize(rule)
    if (!ruleTokens || !ruleTokens.length || ruleTokens.length > tokens.length) continue
    const prefixMatches = ruleTokens.every((t, i) => t.toLowerCase() === tokens[i].toLowerCase())
    if (!prefixMatches) continue
    if (tokens.slice(ruleTokens.length).some(unsafeArg)) continue
    return rule
  }
  return null
}

function normalized(command: string): string {
  return command
    .replace(/["'`\\^]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesDenyRule(command: string, rules: string[]): string | null {
  const variants = [command, normalized(command)]
  for (const rule of rules) {
    if (rule.startsWith('re:')) {
      let re: RegExp
      try {
        re = new RegExp(rule.slice(3), 'i')
      } catch (err) {
        noteFailure(err, 'permissions', 'A command rule is not a valid regular expression')
        continue
      }
      if (variants.some((v) => re.test(v))) return rule
    } else if (variants.some((v) => v.toLowerCase().includes(rule.toLowerCase()))) {
      return rule
    }
  }
  return null
}
