import { CHANCE, checkNames, defenceNames } from '@shared/actions'
import type { JsonSchema } from './schema'

export type CheckSchema = (chance: boolean) => JsonSchema

export const ANY_CHECK: CheckSchema = () => ({ type: 'string' })

export const LIVE_CHECKS: CheckSchema = (chance) => ({ enum: [...(chance ? [CHANCE] : []), ...checkNames().map((c) => c.id)] })

export const LIVE_DEFENCES = (): JsonSchema => ({ enum: defenceNames().map((d) => d.id) })
