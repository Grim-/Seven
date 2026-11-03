import type { Editor } from '@tiptap/core'
import { Paragraph } from '@tiptap/extension-paragraph'
import Image from '@tiptap/extension-image'
import { referencePattern } from '@shared/text'
import { assetUrl, useData } from '../../store/data'

const LIBRARY_PICTURE = 'seven:file/'

export function libraryPicture(url: string): string {
  if (!url.startsWith(LIBRARY_PICTURE)) return url
  const asset = useData.getState().assets.find((a) => a.id === url.slice(LIBRARY_PICTURE.length))
  return asset ? assetUrl(asset) : url
}

export const libraryImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    return ['img', { ...HTMLAttributes, src: libraryPicture(String(HTMLAttributes.src ?? '')) }]
  }
})

export const plainParagraph = Paragraph.extend({
  renderMarkdown: (node, h) => (Array.isArray(node.content) && node.content.length ? h.renderChildren(node.content) : '')
})

function escapeText(text: string): string {
  return text
    .replace(/([\\`*[\]~])/g, '\\$1')
    .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '\\_')
    .replace(/&(?=#?\w+;)/g, '&amp;')
    .replace(/<(?=[a-z/!?])/gi, '&lt;')
}

export function escapedText(text: string): string {
  let out = ''
  let last = 0
  for (const m of text.matchAll(referencePattern())) {
    const start = (m.index ?? 0) + m[1].length
    const end = (m.index ?? 0) + m[0].length
    out += escapeText(text.slice(last, start)) + text.slice(start, end)
    last = end
  }
  return out + escapeText(text.slice(last))
}

type Marked = string | { type: string }

interface TextWriter {
  codeTypes: Set<string>
  encodeTextForMarkdown: (text: string, node: { marks?: Marked[] }, parent?: { type?: string } | null) => string
}

export function escapeOnlyWhatMatters(editor: Editor): void {
  const manager = editor.markdown as unknown as TextWriter | undefined
  if (!manager) return
  const code = (node: { marks?: Marked[] }, parent?: { type?: string } | null) => Boolean(parent?.type && manager.codeTypes.has(parent.type)) || (node.marks ?? []).some((m) => manager.codeTypes.has(typeof m === 'string' ? m : m.type))
  manager.encodeTextForMarkdown = (text, node, parent) => (code(node, parent) ? text : escapedText(text))
}
