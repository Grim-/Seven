import type { ExportPart } from '@shared/exporting'
import { data } from '../data/hub'
import { answerSection, entrySection, linksSection, type EntryCtx } from './entry'
import type { KindHandTo } from '../library/kinds'

const stored = (ctx: EntryCtx) => Boolean(data.pages.metaFor(ctx.id))

function children(ctx: EntryCtx) {
  return stored(ctx) ? data.pages.children(ctx.id).map((m) => data.pages.get(m.id)) : []
}

function backlinks(ctx: EntryCtx) {
  return stored(ctx) ? data.pages.backlinks(ctx.id) : []
}

function insidePart(ctx: EntryCtx): ExportPart {
  const list = children(ctx)
  return {
    heading: 'Pages inside it',
    blocks: list.length ? list.flatMap((p) => [{ h: p.title }, { md: p.body.trim() || '(empty)' }]) : [{ p: 'Nothing is inside it.' }],
    json: list.map((p) => ({ title: p.title, text: p.body }))
  }
}

function backlinksPart(ctx: EntryCtx): ExportPart {
  const list = backlinks(ctx)
  return {
    heading: 'Pages that link to it',
    blocks: list.length ? list.map((p) => ({ li: p.title })) : [{ p: 'No page links to it.' }],
    json: list.map((p) => p.title)
  }
}

export const PAGE_HAND_TO: KindHandTo = {
  sections: () => [
    entrySection,
    linksSection,
    { id: 'inside', label: 'Pages inside it', hint: 'the text of every page directly inside it', on: false, size: (c) => String(children(c).length), build: insidePart },
    { id: 'backlinks', label: 'Pages that link to it', hint: 'their titles', on: false, size: (c) => String(backlinks(c).length), build: backlinksPart },
    answerSection
  ]
}
