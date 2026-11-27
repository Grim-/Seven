import type { Theme } from '@shared/theme'
import { assetUrlOf } from '../assetSource'
import { skinSections } from './sections'
import { surfaceAssets, surfaceSheets } from './surfaceSheet'

export interface Look {
  vars: Record<string, string>
  attrs: Record<string, string>
  sheets: CSSStyleSheet[]
}

export const NO_LOOK: Look = { vars: {}, attrs: {}, sheets: [] }

let current: Look = NO_LOOK

export async function lookFor(theme: Theme): Promise<Look> {
  const sections = skinSections()
  const ids = [...new Set([...sections.flatMap((s) => s.assets?.(theme) ?? []), ...surfaceAssets(theme)])]
  const urls = new Map(await Promise.all(ids.map(async (id) => [id, await assetUrlOf(id)] as const)))
  const url = (id: string) => urls.get(id) ?? null
  await Promise.all(sections.map((s) => s.load?.(theme, url)))
  const vars: Record<string, string> = {}
  const attrs: Record<string, string> = { 'data-theme': theme.id }
  for (const s of sections) {
    Object.assign(vars, s.vars?.(theme, url))
    Object.assign(attrs, s.attrs?.(theme))
  }
  return { vars, attrs, sheets: surfaceSheets(theme, url) }
}

export function writeLook(look: Look): void {
  const root = document.documentElement
  for (const k of Object.keys(current.vars)) if (!(k in look.vars)) root.style.removeProperty(k)
  for (const [k, v] of Object.entries(look.vars)) root.style.setProperty(k, v)
  for (const k of Object.keys(current.attrs)) if (!(k in look.attrs)) root.removeAttribute(k)
  for (const [k, v] of Object.entries(look.attrs)) root.setAttribute(k, v)
  document.adoptedStyleSheets = [...document.adoptedStyleSheets.filter((s) => !current.sheets.includes(s)), ...look.sheets]
  current = look
}

export function withLook<T>(look: Look, read: () => T): T {
  const previous = current
  writeLook(look)
  try {
    return read()
  } finally {
    writeLook(previous)
  }
}
