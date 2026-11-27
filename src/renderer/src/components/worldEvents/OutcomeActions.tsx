import { WorldEffects } from '@shared/game/components'
import type { ComponentDef } from '@shared/game/core'
import { EffectsEditor } from '../game/effects/EffectsEditor'

export function OutcomeActions({
  inline,
  onInline
}: {
  stored?: string[]
  inline: ComponentDef[]
  onStored?: (ids: string[]) => void
  onInline: (effects: ComponentDef[]) => void
}) {
  return <EffectsEditor host={WorldEffects.type} value={inline} onChange={onInline} />
}
