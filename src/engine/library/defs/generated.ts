import { FOLDER_TYPE, stripRef, toId } from '@shared/ids'
import { pageKindOf, type PageMeta } from '@shared/types'
import { data } from '../../data/hub'
import { ToolError } from '../../tools/types'
import { tags as tagStore } from '../tags'
import { entryLine } from './pageHelpers'
import { kindRt } from './runtime'
import { canSee, USER, type GuideSource, type Kind, type KindContext } from './types'

export const GENERATED = 'all:'
const GENERATED_SHOWN = 50
export const WIKI_INDEX = { id: `${GENERATED}wiki-index`, title: 'Wiki index' }
const INDEX_SHOWN = 50
const GUIDE = `${GENERATED}guide-`
const INSTRUCTIONS = `${GENERATED}instructions-`

let guideSource: GuideSource | null = null

export function setGuideSource(source: GuideSource): void {
  guideSource = source
}

export function isWikiIndex(ref: string): boolean {
  const raw = stripRef(ref)
  return raw === WIKI_INDEX.id || toId(raw) === toId(WIKI_INDEX.title)
}

export function generatedPages(ctx: KindContext): { id: string; title: string; kind: Kind }[] {
  return kindRt().kinds(ctx).map((k) => ({ id: `${GENERATED}${k.kind}`, title: `All ${k.plural.toLowerCase()}`, kind: k }))
}

export function generatedPage(ref: string, ctx: KindContext = USER): { id: string; title: string; kind: Kind } | null {
  const raw = stripRef(ref)
  const key = toId(raw)
  return generatedPages(ctx).find((g) => g.id === raw || toId(g.title) === key) ?? null
}

export function specialPages(ctx: KindContext = USER): { id: string; title: string; summary: string }[] {
  if (!guideSource) return []
  const guides = guideSource.guides().map((g) => ({ id: `${GUIDE}${g.id}`, title: `Seven: ${g.name}`, summary: `How the ${g.name} tools work (generated)` }))
  const agents = guideSource
    .agents()
    .filter((a) => ctx.user || ctx.agentId === a.id)
    .map((a) => ({ id: `${INSTRUCTIONS}${a.id}`, title: `Instructions: ${a.name}`, summary: `Exactly what ${a.name} is told (generated)` }))
  return [...guides, ...agents]
}

export function specialPage(ref: string, ctx: KindContext): { id: string; title: string; summary: string } | null {
  const raw = stripRef(ref)
  const key = toId(raw)
  return specialPages(ctx).find((p) => p.id === raw || toId(p.title) === key) ?? null
}

function readSpecial(id: string, ctx: KindContext): string | null {
  if (!guideSource) return null
  if (id.startsWith(GUIDE)) return guideSource.guide(id.slice(GUIDE.length), ctx.agentId ?? null)
  if (id.startsWith(INSTRUCTIONS)) {
    const agentId = id.slice(INSTRUCTIONS.length)
    if (!ctx.user && ctx.agentId !== agentId) throw new ToolError("Another agent's instructions are private to it and the user. You can read only your own instructions page.")
    const text = guideSource.instructions(agentId)
    const name = guideSource.agents().find((a) => a.id === agentId)?.name ?? agentId
    return text === null ? null : `# Instructions: ${name}\nExactly what ${name} is given at the start of a new chat, built each time it is read; it can't be edited here. Change it in the agent's settings.\n\n${text}`
  }
  return null
}

export function generatedTitle(ref: string, ctx: KindContext = USER): string | null {
  return isWikiIndex(ref) ? WIKI_INDEX.title : (specialPage(ref, ctx)?.title ?? generatedPage(ref, ctx)?.title ?? null)
}

function readWikiIndex(ctx: KindContext): string {
  const tree = data.pages.tree()
  const metas = tree.list.filter((p) => canSee(pageKindOf(p.type), ctx))
  const folders = metas.filter((p) => p.type === FOLDER_TYPE).sort((a, b) => tree.pathOf(a.id).localeCompare(tree.pathOf(b.id)))
  const entries = metas.filter((p) => p.type !== FOLDER_TYPE)
  const line = (p: PageMeta) => `- ${entryLine(p, tree)}${p.summary ? ` — ${p.summary.replace(/\s+/g, ' ').slice(0, 100)}` : ''}`
  const cap = (list: string[], folder: string) => (list.length > INDEX_SHOWN ? [...list.slice(0, INDEX_SHOWN), `- and ${list.length - INDEX_SHOWN} more: read_kind(folder, ${folder})`] : list)
  const visible = (parent: string | null) => tree.under(parent).filter((c) => canSee(pageKindOf(c.type), ctx))
  const out = [
    'Every folder and page, built each time it is read; it can\'t be changed. read_kind(folder, /) lists the top level.',
    `${entries.length} page${entries.length === 1 ? '' : 's'} in ${folders.length} folder${folders.length === 1 ? '' : 's'}.`
  ]
  const top = visible(null)
  if (top.length) out.push('## Top level', cap(top.map(line), '/').join('\n'))
  for (const f of folders) {
    const kids = visible(f.id)
    out.push(`## folder ${tree.pathOf(f.id)}`, kids.length ? cap(kids.map(line), tree.pathOf(f.id)).join('\n') : '(empty)')
  }
  const tagged = new Map<string, PageMeta[]>()
  for (const p of entries) {
    for (const t of tagStore.of(pageKindOf(p.type), p.id)) tagged.set(t, [...(tagged.get(t) ?? []), p])
  }
  if (tagged.size) {
    out.push('## Tags')
    for (const [tag, list] of [...tagged.entries()].sort((a, b) => a[0].localeCompare(b[0]))) out.push(`### #${tag}\n${list.slice(0, INDEX_SHOWN).map((p) => `- ${entryLine(p, tree)}`).join('\n')}`)
  }
  const specials = specialPages(ctx)
  if (specials.length) out.push('## Seven', 'How Seven\'s tools work, and what each agent is told (generated).', specials.map((p) => `- page ${toId(p.title)}`).join('\n'))
  return out.join('\n\n')
}

export function guardGenerated(id: string): void {
  if (id.startsWith(GENERATED)) throw new ToolError(`"${generatedTitle(id) ?? id}" is generated each time it is read and can't be changed. Change the entries themselves instead.`)
}

export function readGenerated(id: string, ctx: KindContext): string {
  if (isWikiIndex(id)) return readWikiIndex(ctx)
  if (id.startsWith(GUIDE) || id.startsWith(INSTRUCTIONS)) {
    const text = readSpecial(id, ctx)
    if (text === null) throw new ToolError(`No page ${id}. read_kind(page, wiki_index) lists every page.`)
    return text
  }
  const g = generatedPage(id, ctx)
  if (!g) throw new ToolError(`No page ${id}. read_kind(page, wiki_index) lists every page.`)
  const all = kindRt().searchKind(g.kind, '', 100_000, ctx)
  const sorted = all.some((h) => h.at !== undefined) ? [...all].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)) : all
  const shown = sorted.slice(0, GENERATED_SHOWN)
  const lines = shown.map((h) => {
    const line = g.kind.line(h.id, ctx)
    return `- ${g.kind.kind} ${kindRt().entryId(g.kind, h.id, h.title, ctx)}${line ? ` — ${line.replace(/\s+/g, ' ').slice(0, 120)}` : ''}${h.tags?.length ? ` #${h.tags.join(' #')}` : ''}`
  })
  const more = all.length > shown.length ? `\n\n${all.length - shown.length} more not listed (newest first above); find with kind ${g.kind.kind} searches them.` : ''
  return `Every ${g.kind.label.toLowerCase()}, built each time it is read; it can't be changed. ${g.kind.description ? `${g.kind.plural}: ${g.kind.description}.` : ''}\n\n${all.length} in total.\n\n${lines.join('\n') || '(none yet)'}${more}`
}

const INDEX_LINE = 'The root of every page, by section and tag (generated)'
const generatedLine = (k: Kind) => `Every ${k.label.toLowerCase()}, with links (generated)`
const pageMetaLine = (p: PageMeta) => (p.count ? `${p.count} item${p.count === 1 ? '' : 's'}${p.summary ? ` · ${p.summary}` : ''}` : p.summary)

export function pageLine(id: string, ctx: KindContext): string {
  const meta = data.pages.metaFor(id)
  if (meta) return pageMetaLine(meta)
  if (isWikiIndex(id)) return INDEX_LINE
  const special = specialPage(id, ctx)
  if (special) return special.summary
  const generated = generatedPage(id, ctx)
  return generated ? generatedLine(generated.kind) : ''
}
