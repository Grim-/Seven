import type { ViewEvent } from '@shared/effects'
import { moduleList, type ModuleEntry } from '@shared/moduleList'
import type { CharacterSheet } from '@shared/types'
import type { JsonObjectSchema, JsonSchema } from '../tools/schema'
import { LIVE_CHECKS, type CheckSchema } from '../tools/checkSchema'
import { registerSchemaSource } from '../tools/schemaSources'
import type { ToolContext } from '../tools/types'
import { moduleIsOn } from '../modules/isOn'
import type { PlayTargetCandidate } from './targets'

export type CardRaw = Record<string, unknown>

export interface CardPlayOutcome {
  mode: string
  tone: 'ok' | 'alert' | 'purple' | 'cyan'
  label: string
  detail: string
  lines: string[]
  effects: string[]
  view: ViewEvent[]
}

export interface CardPlayContext {
  card: CardRaw
  cardName: string
  say: string
  world: string | null
  playerSheet: string | null
  caster: PlayTargetCandidate
  target: PlayTargetCandidate
  casterSheet: CharacterSheet | null
  targetSheet: CharacterSheet | null
  tool: ToolContext
}

export interface CardVariationDef extends ModuleEntry {
  data: (check: CheckSchema) => JsonSchema
  apply: (card: CardRaw, data: Record<string, unknown>) => CardRaw
  remove?: (card: CardRaw) => CardRaw
  text?: (card: CardRaw) => string | null
  canPlay?: (card: CardRaw, ctx: CardPlayContext) => boolean
  play?: (card: CardRaw, ctx: CardPlayContext) => Promise<CardPlayOutcome>
}

export const cardVariationDefs = moduleList<CardVariationDef>()

export function liveCardVariations(): CardVariationDef[] {
  return cardVariationDefs.on(moduleIsOn)
}

export const CARD_VARIATION_SCOPE = 'card_variation'

registerSchemaSource({
  id: CARD_VARIATION_SCOPE,
  entries: (on) =>
    cardVariationDefs.on((module) => moduleIsOn(module) && on(module)).map((v) => ({ name: v.id, summary: v.name, params: v.data(LIVE_CHECKS) as JsonObjectSchema }))
})
