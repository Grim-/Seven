export const HANDOUT_STYLES = ['letter', 'note', 'poster', 'terminal'] as const

export type HandoutStyle = (typeof HANDOUT_STYLES)[number]

export interface Handout {
  style: HandoutStyle
  title: string
  text: string
  from: string
  image: string
}

export function handoutOf(fields: Record<string, unknown>): Handout {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const style = HANDOUT_STYLES.find((s) => s === fields.style) ?? 'note'
  return { style, title: str(fields.title), text: str(fields.text), from: str(fields.from), image: str(fields.image) }
}

export function handoutMarkdown(h: Handout): string {
  return [`### ${h.title || `A ${h.style}`}`, h.image ? `![](seven:file/${h.image})` : '', h.text, h.from ? `— ${h.from}` : ''].filter(Boolean).join('\n\n')
}
