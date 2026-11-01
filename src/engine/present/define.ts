import { PRESENT_PREFIX, presentationToolName } from '@shared/toolnames'
import type { GbnfJsonObjectSchema, GbnfJsonSchema } from 'node-llama-cpp'
import type { PresentData, PresentWhere } from '@shared/types'
import { ToolError, type ToolContext, type ToolDef } from '../tools/types'
import { data as store } from '../data/hub'
import { KEY_FIELD, WHERE_FIELD, parsePlace, widgetLine, writer } from './places'

export const MOODS = ['idle', 'happy', 'laughing', 'talking', 'thinking', 'sad', 'angry']

export { PRESENT_PREFIX }

export interface PresentationSpec {
  type: string
  group: string
  description: string
  fields: Record<string, GbnfJsonSchema>
  check?: (fields: Record<string, unknown>) => void
  title?: (fields: Record<string, unknown>) => string | undefined
  result?: (fields: Record<string, unknown>, where: PresentWhere) => string
  run?: (fields: Record<string, unknown>, ctx: ToolContext) => Promise<{ text: string; fields?: Record<string, unknown> }>
  fixed?: boolean
  as?: (fields: Record<string, unknown>) => { type: string; fields: Record<string, unknown> }
}

const shown = new WeakMap<AbortSignal, Set<string>>()

export const DONE = "It is on screen now; don't show it again. Carry on, or finish your reply."

const PLACE_TEXT: Record<PresentWhere, string> = { inline: 'in the chat', panel: 'in the side panel', stage: 'on stage', board: 'on the board' }

function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v))
}

export function presentationTool(spec: PresentationSpec): ToolDef {
  const params: GbnfJsonObjectSchema = {
    type: 'object',
    properties: spec.fixed
      ? spec.fields
      : {
      ...spec.fields,
      where: WHERE_FIELD,
      key: KEY_FIELD
        }
  } as GbnfJsonObjectSchema
  return {
    name: presentationToolName(spec.type),
    group: spec.group,
    needsWorkspace: false,
    permission: 'none',
    description: spec.description,
    params,
    maxRepeats: 1,
    async execute(args, ctx) {
      const seen = shown.get(ctx.signal) ?? new Set<string>()
      shown.set(ctx.signal, seen)
      const fingerprint = `${spec.type}:${stable(args)}`
      if (seen.has(fingerprint)) throw new ToolError(`You already showed exactly this in this reply. ${DONE}`)
      seen.add(fingerprint)
      const fields: Record<string, unknown> = {}
      for (const name of Object.keys(spec.fields)) fields[name] = args[name] ?? null
      spec.check?.(fields)
      const place = spec.fixed ? ({ kind: 'inline' } as const) : parsePlace(args.where, ctx)
      const where: PresentWhere = place.kind
      const key = !spec.fixed && typeof args.key === 'string' && args.key.trim() ? args.key.trim() : null
      if (spec.run) {
        const done = await spec.run(fields, ctx)
        const merged = { ...fields, ...done.fields }
        const data: PresentData = { ...(spec.as?.(merged) ?? { type: spec.type, fields: merged }), where, key }
        return { text: done.text, view: { kind: 'present' as const, title: spec.title?.(fields) ?? spec.type, data } }
      }
      const title = spec.title?.(fields) ?? spec.type
      if (place.kind === 'board') {
        const present: PresentData = { ...(spec.as?.(fields) ?? { type: spec.type, fields }), where: 'board', key: null }
        const source = { kind: 'present' as const, data: present }
        const result = key
          ? store.dashboards.updateWidget(place.board.id, key, { title, source }, writer(ctx))
          : store.dashboards.addWidget(place.board.id, { title, source }, writer(ctx))
        const data: PresentData = { ...present, board: result.dashboard.name }
        return { text: `On board "${result.dashboard.name}": ${widgetLine(result.widget)}. ${DONE}`, view: { kind: 'present' as const, title, data } }
      }
      const data: PresentData = { ...(spec.as?.(fields) ?? { type: spec.type, fields }), where, key }
      const view = { kind: 'present' as const, title, data }
      if (where === 'panel') {
        try {
          ctx.panel.show({ view, key })
        } catch (err) {
          throw new ToolError(`Could not put it in the side panel (${err instanceof Error ? err.message : String(err)}). Call ${presentationToolName(spec.type)} again with where set to inline to show it in the chat instead.`)
        }
      }
      return { text: spec.result?.(fields, where) ?? `Shown to the user ${PLACE_TEXT[where]}. ${DONE}`, view }
    }
  }
}
