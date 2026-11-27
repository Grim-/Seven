import { isTopLevel, styleCss, type SurfaceStyle } from '@shared/themeLook'

export type SurfacePart = '' | '::before' | '::after'

const WRAP = '[data-skin-surface="edit"]'

export function splitKeyframes(css: string): { keyframes: string[]; rest: string } {
  const keyframes: string[] = []
  let rest = ''
  let at = 0
  while (at < css.length) {
    const start = css.indexOf('@keyframes', at)
    if (start < 0) break
    const open = css.indexOf('{', start)
    if (open < 0) break
    let depth = 0
    let end = open
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++
      else if (css[end] === '}' && --depth === 0) break
    }
    rest += css.slice(at, start)
    keyframes.push(css.slice(start, end + 1))
    at = end + 1
  }
  return { keyframes, rest: rest + css.slice(at) }
}

function splitTop(text: string, on: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote = ''
  let from = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
    } else if (c === '"' || c === "'") quote = c
    else if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === on && depth === 0) {
      out.push(text.slice(from, i))
      from = i + 1
    }
  }
  out.push(text.slice(from))
  return out
}

function declarations(style: CSSStyleDeclaration): SurfaceStyle {
  const out: SurfaceStyle = {}
  for (const part of splitTop(style.cssText, ';')) {
    const [name, ...value] = splitTop(part, ':')
    if (name.trim() && value.length) out[name.trim()] = value.join(':').trim()
  }
  return out
}

function head(rule: CSSRule): string {
  return rule.cssText.slice(0, rule.cssText.indexOf('{')).trim()
}

function walk(rule: CSSRule): SurfaceStyle {
  const out: SurfaceStyle = rule instanceof CSSStyleRule ? declarations(rule.style) : {}
  const kids = rule instanceof CSSGroupingRule || rule instanceof CSSStyleRule ? [...rule.cssRules] : rule instanceof CSSKeyframesRule ? [...rule.cssRules] : []
  for (const k of kids) {
    if (k instanceof CSSKeyframeRule) out[k.keyText] = declarations(k.style)
    else if (k instanceof CSSStyleRule) out[k.selectorText] = walk(k)
    else if (k instanceof CSSGroupingRule) out[head(k)] = walk(k)
    else if ('style' in k && k.style instanceof CSSStyleDeclaration) Object.assign(out, declarations(k.style))
  }
  return out
}

function parseSheet(css: string): { sheet: CSSStyleSheet; frames: CSSKeyframesRule[] } | null {
  const { keyframes, rest } = splitKeyframes(css)
  const sheet = new CSSStyleSheet()
  const frames: CSSKeyframesRule[] = []
  try {
    sheet.replaceSync(`${WRAP} {\n${rest}\n}`)
    for (const text of keyframes) {
      const probe = new CSSStyleSheet()
      probe.replaceSync(text)
      const rule = probe.cssRules[0]
      if (rule instanceof CSSKeyframesRule) frames.push(rule)
    }
  } catch {
    return null
  }
  return { sheet, frames }
}

export function cssProblem(css: string): string | null {
  const parsed = parseSheet(css)
  if (!parsed) return 'This CSS could not be read.'
  return parsed.sheet.cssRules.length === 1 ? null : 'A } closes the surface early, so the rules after it are ignored.'
}

export function cssToStyle(css: string): SurfaceStyle | null {
  const parsed = parseSheet(css)
  const own = parsed?.sheet.cssRules[0]
  if (!parsed || !(own instanceof CSSStyleRule)) return null
  const out = walk(own)
  for (const frames of parsed.frames) out[head(frames)] = walk(frames)
  return out
}

export function styleToCss(style: SurfaceStyle): string {
  const inner = Object.fromEntries(Object.entries(style).filter(([k]) => !isTopLevel(k)))
  const top = Object.fromEntries(Object.entries(style).filter(([k]) => isTopLevel(k)))
  return [styleCss(inner), styleCss(top)].filter(Boolean).join('\n')
}

function partOf(style: SurfaceStyle, part: SurfacePart): SurfaceStyle {
  const nested = part ? style[`&${part}`] : style
  return nested && typeof nested !== 'string' ? nested : {}
}

function parsed(declarations: [string, string][]): CSSStyleDeclaration {
  const style = document.createElement('div').style
  for (const [name, value] of declarations) style.setProperty(name, value)
  return style
}

function plain(own: SurfaceStyle): [string, string][] {
  return Object.entries(own).flatMap(([k, v]): [string, string][] => (typeof v === 'string' ? [[k, v]] : []))
}

function expandShorthands(own: SurfaceStyle, longhands: string[]): SurfaceStyle {
  const out: SurfaceStyle = {}
  for (const [k, v] of Object.entries(own)) {
    const one = typeof v === 'string' && longhands.some((p) => p.startsWith(`${k}-`)) ? parsed([[k, v]]) : null
    const names = one ? Array.from({ length: one.length }, (_, i) => one.item(i)).filter((n) => one.getPropertyValue(n)) : []
    if (!one || !names.length) out[k] = v
    else for (const n of names) out[n] = one.getPropertyValue(n)
  }
  return out
}

export function readProps(style: SurfaceStyle, part: SurfacePart, props: readonly string[]): Record<string, string> {
  const own = partOf(style, part)
  const resolved = parsed(plain(own))
  return Object.fromEntries(props.map((p) => [p, typeof own[p] === 'string' ? own[p] : resolved.getPropertyValue(p)]))
}

export function writeProps(style: SurfaceStyle, part: SurfacePart, props: Record<string, string | null>): SurfaceStyle {
  const own: SurfaceStyle = expandShorthands(partOf(style, part), Object.keys(props))
  for (const [p, v] of Object.entries(props)) {
    if (v === null) delete own[p]
    else own[p] = v
  }
  if (!part) return own
  const next: SurfaceStyle = { ...style }
  if (Object.keys(own).length) next[`&${part}`] = own
  else delete next[`&${part}`]
  return next
}

export function sides(value: string, fallback = 0): [number, number, number, number] {
  const n = value
    .split(/\s+/)
    .map((t) => parseFloat(t))
    .filter((v) => Number.isFinite(v))
  const [t = fallback, r = t, b = t, l = r] = n
  return [t, r, b, l]
}
