import {
  DEFAULT_LIBRARY_ACCESS,
  type KindFlags,
  type LibraryAccess,
  type LibraryHit,
  type Page,
  type ViewRef
} from '@shared/types'
import type { AssetMeta } from '@shared/types'
import type { ExportPreset } from '@shared/exporting'
import type { KindPortabilityMeta } from '@shared/portability'
import type { WidgetSource } from '@shared/types'
import type { KindWidget } from '../../data/widgetSources'
import type { EntryCtx } from '../../exporting/entry'
import type { ExportSection } from '../../exporting/registry'
import type { Exported } from '../exporters'
import type { EntryRef, Unpack } from '../packing'
import { agentAccess } from '../../agents/access'
import { ToolError } from '../../tools/types'

export type Hit = LibraryHit
export type KindHit = Omit<Hit, 'summary'>

export interface KindField {
  name: string
  text: string
}

export interface ReadOptions {
  part?: string | null
}

export interface KindContext {
  agentId: string | null
  user?: boolean
}

export const USER: KindContext = { agentId: null, user: true }

export interface KindHandTo {
  sections?: () => ExportSection<EntryCtx>[]
  presets?: (ctx: EntryCtx) => ExportPreset[]
  answer?: (ctx: EntryCtx) => string
}

export interface TrailStep {
  kind: string
  id: string
}

export interface KindChildInput {
  kind: string
  id: string
  title: string
}

export interface KindChild extends KindChildInput {
  segment: string
}

export interface KindLinkAction {
  name: string
  label?: string
  detail: string
  mode: 'insert' | 'placeholder'
  run(id: string, ctx: KindContext): string
}

export interface FindOptions {
  query?: string | null
  kind?: string | string[] | null
  tags?: string[] | null
  where?: Record<string, string> | null
  limit?: number | null
  offset?: number | null
}

export interface FindResult {
  hits: Hit[]
  total: number
  offset: number
  limit: number
}

export interface GuideSource {
  guides(): { id: string; name: string }[]
  guide(moduleId: string, agentId: string | null): string | null
  agents(): { id: string; name: string }[]
  instructions(agentId: string): string | null
}

export interface Kind {
  kind: string
  aliases?: string[]
  label: string
  plural: string
  icon: string
  description: string
  parts: string[]
  exportable: boolean
  export?(id: string, ctx: KindContext): Exported
  textParts?: string[]
  readView?(id: string, options: ReadOptions, ctx: KindContext): { text: string; view?: ViewRef }
  place?(id: string, part: string | null, onBoard: boolean): WidgetSource | null
  presents?: { chat?: boolean; widget?: KindWidget }
  actions: string[]
  available(ctx: KindContext): boolean
  search(query: string, limit: number, ctx: KindContext): KindHit[]
  resolve(ref: string, ctx: KindContext): string | null
  line(id: string, ctx: KindContext): string
  card(id: string, ctx: KindContext): string
  full(id: string, options: ReadOptions, ctx: KindContext): string
  handTo?: KindHandTo
  fields?(id: string, ctx: KindContext): KindField[]
  title(id: string): string
  defaultPart?(id: string): string
  source?: string
  family?: string
  worldType?: string
  group: string
  remove?(id: string, ctx: KindContext): void
  rename?(id: string, name: string, ctx: KindContext): void
  roll?(id: string): string
  draw?(id: string, count: number): string[]
  linkActions?: KindLinkAction[]
  linkParts?: { name: string; description: string }[]
  isGenerated?(id: string): boolean
  root?: string
  resolveOnly?: boolean
  missing?(ref: string): string
  readFull?(id: string): Promise<string | null>
  asset?(id: string): AssetMeta | null
  image?(id: string): string | null
  exportAtRoot?: boolean
  pageTypes?: string[]
  lasting?: boolean
  inKindList?: boolean
  actionsStayWhenHidden?: boolean
  portability?: KindPortabilityMeta
  pack?(id: string, options?: Record<string, unknown>): unknown
  uses?(id: string, options?: Record<string, unknown>): EntryRef[]
  unpack?(value: unknown, how: Unpack): string
  children?(id: string, ctx: KindContext, trail: TrailStep[]): KindChildInput[]
  pathOf?(id: string, ctx: KindContext): string | null
}

export const MAX_TEXT = 12000

export const has = (text: string, q: string) => text.toLowerCase().includes(q)

export function clip(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n... ${text.length - MAX_TEXT} more characters ...` : text
}

export function withJson(kind: Kind, id: string, json: unknown): Exported {
  return { title: kind.title(id), markdown: kind.full(id, {}, USER), json }
}

export function fieldsText(p: Pick<Page, 'fields'>): string {
  return p.fields.map((f) => `${f.name} (${f.type === 'select' ? `one of ${f.options.join('/')}` : f.type}${f.required ? ', required' : ''})`).join(', ')
}

export function rollLinkActions(
  run: (id: string, ctx: KindContext) => string,
  {
    rollDetail = 'put a random value from it here',
    valueDetail = 'insert a placeholder that rolls a fresh value on submit'
  } = {}
): KindLinkAction[] {
  return [
    { name: 'roll', label: 'roll', detail: rollDetail, mode: 'insert', run },
    { name: 'value', label: ':value', detail: valueDetail, mode: 'placeholder', run }
  ]
}

export function accessOf(ctx: KindContext): LibraryAccess {
  if (ctx.user || !ctx.agentId) return { hidden: [], chats: 'all' }
  const a = agentAccess.get(ctx.agentId)
  return { ...DEFAULT_LIBRARY_ACCESS, ...(a?.library ?? {}) }
}

export function canSee(kindName: string, ctx: KindContext): boolean {
  return !accessOf(ctx).hidden.includes(kindName)
}

export function kindFlags(k: Kind): KindFlags {
  return {
    exportable: k.exportable,
    importable: Boolean(k.unpack) && k.portability?.canImport !== false,
    removable: Boolean(k.remove),
    renamable: Boolean(k.rename),
    carriable: Boolean(k.pack && k.unpack),
    preferBundle: Boolean(k.portability?.preferBundle),
    bundleNote: k.portability?.bundleNote ?? null,
    boardable: Boolean(k.presents?.widget || k.place),
    family: k.family ?? null
  }
}

export function checkPart(k: Kind, part: string | null): string | null {
  if (!part || !k.linkParts) return null
  if (!k.linkParts.some((p) => p.name === part || (p.name.endsWith(':') && part.toLowerCase().startsWith(p.name.toLowerCase()))))
    throw new ToolError(`A ${k.label.toLowerCase()} has no #${part}. Link it with one of: ${k.linkParts.map((p) => `#${p.name}`).join(', ')}, or with no # part for the whole entry.`)
  return part
}
