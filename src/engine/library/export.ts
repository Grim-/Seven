import { plainText } from '@shared/text'
import { ToolError } from '../tools/types'
import { USER, resolveEntry, type Kind } from './kinds'
import { resolveIncludes } from './includes'
import type { Exported } from './exporters'

export type ExportFormat = 'markdown' | 'text' | 'json'

export function exportOne(kind: Kind, id: string): Exported {
  const markdown = resolveIncludes(kind.card(id, USER))
  const own = kind.export?.(id, USER)
  const title = own?.title ?? kind.title(id)
  return { title, markdown, json: own ? own.json : { kind: kind.kind, id, title, text: markdown } }
}

function render(e: Exported, format: ExportFormat): string {
  if (format === 'json') return JSON.stringify(e.json, null, 2)
  if (format === 'text') return plainText(e.markdown, true)
  return e.markdown
}

export function exportable(kind: Kind): void {
  if (!kind.exportable) throw new ToolError(`A ${kind.label.toLowerCase()} is kept as it is and can't be exported as text. Read it instead.`)
}

export function exportEntry(entry: string, format: ExportFormat): { title: string; text: string } {
  const { kind, id } = resolveEntry(entry, null, USER)
  exportable(kind)
  const e = exportOne(kind, id)
  return { title: e.title, text: render(e, format) }
}
