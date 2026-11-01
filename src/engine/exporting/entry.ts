import type { ExportBlock, ExportPart, ExportPreset } from '@shared/exporting'
import { refsIn } from '@shared/story'
import { withoutTitle } from '@shared/text'
import { USER, resolveEntry, type Kind, type KindHandTo, kindNamed } from '../library/kinds'
import { exportOne, exportable } from '../library/export'
import { registerExport, type ExportSection } from './registry'

type LinkLevel = 'card' | 'full'

export interface EntryCtx {
  kind: Kind
  id: string
  title: string
  links: LinkLevel
}

function kindExportOf(kind: Kind): KindHandTo {
  return kind.handTo ?? {}
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function linked(ctx: EntryCtx): { found: { link: string; title: string; label: string; markdown: string }[]; missing: string[] } {
  const found: { link: string; title: string; label: string; markdown: string }[] = []
  const missing: string[] = []
  for (const r of refsIn(ctx.kind.card(ctx.id, USER))) {
    const link = `@${r.kind}:${r.ref}`
    try {
      const hit = resolveEntry(link, null, USER)
      if (hit.kind.kind === ctx.kind.kind && hit.id === ctx.id) continue
      const markdown = ctx.links === 'full' ? hit.kind.full(hit.id, {}, USER) : hit.kind.card(hit.id, USER)
      found.push({ link, title: hit.kind.title(hit.id), label: hit.kind.label, markdown })
    } catch {
      missing.push(link)
    }
  }
  return { found, missing }
}

function linksPart(ctx: EntryCtx): ExportPart {
  const { found, missing } = linked(ctx)
  const blocks: ExportBlock[] = found.flatMap((f) => [{ h: `${f.label}: ${f.title} (${f.link})` }, { md: withoutTitle(f.markdown, f.title) }])
  if (missing.length) blocks.push({ p: `Links that point at nothing: ${missing.join(', ')}.` })
  if (!blocks.length) blocks.push({ p: 'It links to nothing.' })
  return { heading: 'What it links to', blocks, json: { linked: found.map(({ link, title, label, markdown }) => ({ link, kind: label, title, text: markdown })), missing } }
}

function answerText(ctx: EntryCtx): string {
  return kindExportOf(ctx.kind).answer?.(ctx) ?? `If you rewrite it, give the whole new ${ctx.kind.label.toLowerCase()} as markdown in one block so I can paste it in. Keep links as they are written (@kind:name).`
}

export const entrySection: ExportSection<EntryCtx> = {
  id: 'entry',
  label: 'The entry',
  hint: 'all of it, as Seven gives it to agents',
  on: true,
  size: (ctx) => `${ctx.kind.card(ctx.id, USER).length.toLocaleString()} characters`,
  build: (ctx) => {
    const e = exportOne(ctx.kind, ctx.id)
    return { heading: `${ctx.kind.label}: ${e.title}`, blocks: [{ md: withoutTitle(e.markdown, e.title) }], json: e.json }
  }
}

export const linksSection: ExportSection<EntryCtx> = {
  id: 'links',
  label: 'What it links to',
  hint: 'every page, file or entry it @links to, short or in full',
  on: true,
  size: (ctx) => {
    const l = linked(ctx)
    return `${l.found.length}${l.missing.length ? ` · ${l.missing.length} broken` : ''}`
  },
  build: linksPart
}

export const answerSection: ExportSection<EntryCtx> = {
  id: 'answer',
  label: 'How to answer',
  hint: 'asks for changes in a shape you can paste straight back in',
  on: false,
  size: () => '1 note',
  build: (ctx) => {
    const p = answerText(ctx)
    return { heading: 'How to answer', blocks: [{ p }], json: p }
  }
}

export function writingPresets(ctx: EntryCtx): ExportPreset[] {
  const what = ctx.kind.label.toLowerCase()
  return [
    { id: 'improve', label: 'Improve the writing', brief: `Improve the writing of this ${what} without changing what it says.`, sections: ['entry', 'answer'] },
    { id: 'expand', label: 'Expand it', brief: `Expand this ${what}: fill the gaps and add what is missing.`, sections: ['entry', 'links', 'answer'] },
    { id: 'summarise', label: 'Summarise it', brief: `Summarise this ${what}.`, sections: ['entry'] },
    { id: 'check', label: 'Check it', brief: `Check this ${what} for mistakes, contradictions and anything unclear.`, sections: ['entry', 'links'] }
  ]
}

interface KindCtx {
  kind: Kind
  ids: string[]
  generated: number
}

function kindContext(name: string): KindCtx {
  const kind = kindNamed(name)
  if (!kind) throw new Error(`No kind ${name}.`)
  exportable(kind)
  const all = kind.search('', 100_000, USER).map((h) => h.id)
  const ids = all.filter((id) => !kind.isGenerated?.(id))
  return { kind, ids, generated: all.length - ids.length }
}

export function registerEntryExports(): void {
  registerExport<EntryCtx>('entry', {
    options: [
      {
        id: 'links',
        label: 'What it links to',
        choices: [
          { value: 'card', label: 'Short' },
          { value: 'full', label: 'In full' }
        ],
        initial: 'card'
      }
    ],
    presets: (ctx) => (kindExportOf(ctx.kind).presets ?? writingPresets)(ctx),
    sections: (ctx) => kindExportOf(ctx.kind).sections?.() ?? [entrySection, linksSection, answerSection],
    context: (args, options) => {
      const { kind, id } = resolveEntry(args.entry ?? '', null, USER)
      exportable(kind)
      return { kind, id, title: kind.title(id), links: options.links === 'full' ? 'full' : 'card' }
    },
    title: (ctx) => ctx.title,
    subtitle: (ctx) => ctx.kind.label
  })
  registerExport<KindCtx>('kind', {
    options: [],
    presets: [],
    sections: (ctx) => [
      {
        id: 'all',
        label: `Every ${ctx.kind.label.toLowerCase()}`,
        hint: ctx.generated ? `all of each, as Seven gives it to agents; the ${ctx.generated} generated ones are left out, hand one over on its own` : 'all of each, as Seven gives it to agents',
        on: true,
        size: (c) => String(c.ids.length),
        build: (c) => {
          const all = c.ids.map((id) => exportOne(c.kind, id))
          return { heading: c.kind.plural, blocks: all.flatMap((e) => [{ h: e.title }, { md: withoutTitle(e.markdown, e.title) }]), json: all.map((e) => e.json) }
        }
      }
    ],
    context: (args) => kindContext(args.kind ?? ''),
    title: (ctx) => ctx.kind.plural,
    subtitle: (ctx) => `${ctx.ids.length} ${ctx.kind.plural.toLowerCase()}`
  })
}
