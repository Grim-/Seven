import type { ModelConfig, ParamDef } from './types'
import { fileList, fileListFlag, fileListFromFlag, fileListText } from './modelParams'

function split(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

const BOOL_WORD = /^(on|off|true|false|1|0|auto|yes|no)$/i

export function parseModelArgs(text: string, params: ParamDef[]): { values: ModelConfig; unknown: string[] } {
  const byFlag = new Map<string, ParamDef>()
  for (const p of params) for (const f of p.flag ?? []) byFlag.set(f, p)
  const tokens = split(text)
  const values: ModelConfig = {}
  const unknown: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    let flag = tokens[i]
    let inline: string | null = null
    const eq = flag.indexOf('=')
    if (flag.startsWith('-') && eq > 0) {
      inline = flag.slice(eq + 1)
      flag = flag.slice(0, eq)
    }
    let def = byFlag.get(flag)
    let negated = false
    if (!def && flag.startsWith('--no-')) {
      def = byFlag.get(`--${flag.slice(5)}`)
      negated = def?.type === 'bool'
      if (!negated) def = undefined
    }
    const next = inline ?? tokens[i + 1]
    const takeNext = () => {
      if (inline === null) i++
    }
    if (!def) {
      const withValue = next !== undefined && !next.startsWith('-')
      unknown.push(withValue && inline === null ? `${flag} ${next}` : tokens[i])
      if (withValue) takeNext()
      continue
    }
    if (def.type === 'bool') {
      let on = !negated
      if (!negated && next !== undefined && BOOL_WORD.test(next)) {
        on = /^(on|true|1|auto|yes)$/i.test(next)
        takeNext()
      }
      values[def.key] = on
      continue
    }
    if (next === undefined) {
      unknown.push(flag)
      continue
    }
    takeNext()
    if (def.type === 'text' || def.type === 'file') {
      values[def.key] = next
      continue
    }
    if (def.type === 'files') {
      values[def.key] = fileListText([...fileList(values[def.key]), ...fileListFromFlag(next)])
      continue
    }
    if (def.type === 'select') {
      const match = def.options?.find((o) => o.toLowerCase() === next.toLowerCase())
      if (match) values[def.key] = match
      else unknown.push(`${flag} ${next}`)
      continue
    }
    const n = Number(next)
    if (Number.isFinite(n)) values[def.key] = n
    else unknown.push(`${flag} ${next}`)
  }
  return { values, unknown }
}

export function modelArgsText(config: ModelConfig, params: ParamDef[]): string {
  return params
    .filter((p) => p.flag?.length && config[p.key] !== undefined && config[p.key] !== p.default)
    .map((p) => {
      const flag = p.flag!.find((f) => f.startsWith('--')) ?? p.flag![0]
      const v = config[p.key]
      if (p.type === 'bool') return v ? flag : `--no-${flag.slice(2)}`
      const quoted = (t: string) => (/\s/.test(t) ? `"${t}"` : t)
      if (p.type === 'files') return `${flag} ${quoted(fileListFlag(fileList(v)))}`
      if (p.type === 'text' || p.type === 'file') return `${flag} ${quoted(String(v))}`
      return `${flag} ${p.type === 'select' ? String(v).toLowerCase() : String(v)}`
    })
    .join(' ')
}

export function applyModelArgs(config: ModelConfig, text: string, params: ParamDef[]): { config: ModelConfig; unknown: string[] } {
  const { values, unknown } = parseModelArgs(text, params)
  const next = { ...config }
  for (const p of params) if (p.flag?.length) next[p.key] = values[p.key] ?? p.default
  return { config: next, unknown }
}
