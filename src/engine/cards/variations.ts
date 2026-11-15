import { moduleList, type ModuleEntry } from '@shared/moduleList'
import type { JsonSchema } from '../tools/schema'
import type { CheckSchema } from '../tools/checkSchema'
import { moduleIsOn } from '../modules/isOn'

export type CardRaw = Record<string, unknown>

export interface CardVariationDef extends ModuleEntry {
  data: (check: CheckSchema) => JsonSchema
  apply: (card: CardRaw, data: Record<string, unknown>) => CardRaw
  remove?: (card: CardRaw) => CardRaw
  text?: (card: CardRaw) => string | null
}

export const cardVariationDefs = moduleList<CardVariationDef>()

export function liveCardVariations(): CardVariationDef[] {
  return cardVariationDefs.on(moduleIsOn)
}
