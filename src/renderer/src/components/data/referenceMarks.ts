import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { Node } from '@milkdown/kit/prose/model'
import { $prose } from '@milkdown/kit/utils'
import { referenceHref, referencePattern } from '@shared/text'
import type { EditorView } from '@milkdown/kit/prose/view'
import { engine } from '../../lib/ipc'
import { openSevenLink } from '../../lib/links'
import { failed } from '../../lib/notify'

interface Found {
  from: number
  to: number
  kind: string
  ref: string
  part: string | null
}

function referenceAt(doc: Node, at: number): Found | null {
  let found: Found | null = null
  doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return
    for (const m of node.text.matchAll(referencePattern())) {
      const from = pos + (m.index ?? 0) + m[1].length
      const to = pos + (m.index ?? 0) + m[0].length
      if (at >= from && at <= to) found = { from, to, kind: m[2], ref: m[3], part: m[4] ?? null }
    }
  })
  return found
}

async function resolvedText(r: Found): Promise<string | null> {
  const entry = `@${r.kind}:${r.ref}`
  if (r.part) return engine('library.field', { entry, field: r.part })
  return (await engine('library.preview', { entry })).card
}

function resolveInto(view: EditorView, r: Found): void {
  void resolvedText(r)
    .then((text) => {
      if (text === null) return
      if (view.state.doc.textBetween(r.from, r.to) !== `@${r.kind}:${r.ref}${r.part ? `#${r.part}` : ''}`) return
      view.dispatch(view.state.tr.insertText(text, r.from, r.to))
    })
    .catch(failed('Could not get that text'))
}

function marks(doc: Node): DecorationSet {
  const out: Decoration[] = []
  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text || parent?.type.spec.code || node.marks.some((m) => m.type.spec.code)) return
    for (const m of node.text.matchAll(referencePattern())) {
      const start = pos + (m.index ?? 0) + m[1].length
      const kindEnd = start + m[2].length + 2
      const end = pos + (m.index ?? 0) + m[0].length
      out.push(Decoration.inline(start, kindEnd, { class: 'seven-ref-kind' }), Decoration.inline(kindEnd, end, { class: 'seven-ref', title: 'Ctrl-click to open, Shift-click to put its text here' }))
    }
  })
  return DecorationSet.create(doc, out)
}

const key = new PluginKey<DecorationSet>('seven-references')

export const referenceMarks = $prose(
  () =>
    new Plugin<DecorationSet>({
      key,
      state: {
        init: (_, state) => marks(state.doc),
        apply: (tr, set) => (tr.docChanged ? marks(tr.doc) : set)
      },
      props: {
        decorations: (state) => key.getState(state),
        handleClick: (view, pos, event) => {
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) return false
          const r = referenceAt(view.state.doc, pos)
          if (!r) return false
          if (event.shiftKey) resolveInto(view, r)
          else openSevenLink(referenceHref(r.kind, r.ref))
          return true
        }
      }
    })
)
