import { moduleList, type ModuleEntry } from '@shared/moduleList'
import type { HealthChange } from '../components/chat/status/characterStatus'
import type { EffectTargetRef } from '@shared/effects'

export interface PlayTarget {
  id: string
  name: string
  group: string
  note: string
  link: string | null
  image?: string | null
  ref?: EffectTargetRef
  health?: (delta: number) => Promise<HealthChange | null>
  give?: (item: string, count: number, gold: number) => Promise<string>
  take?: (item: string, count: number) => Promise<string>
  defence?: (check: string) => Promise<number | null>
  checks?: () => Promise<{ id: string; label: string; bonus: number }[]>
}

export interface TargetContext {
  world: string | null
  sheet: string | null
  agents: string[]
}

export interface TargetSource extends ModuleEntry {
  list: (ctx: TargetContext) => Promise<PlayTarget[]>
}

export const targetSources = moduleList<TargetSource>()
