import type { ComponentDef } from '@shared/game/core'
import { EffectsEditor } from '../effects/EffectsEditor'
import { hostLanes } from '../effects/pieces'
import { PartsEditor } from './PartsEditor'

export function Pieces({ host, value, onChange }: { host: string; value: ComponentDef[]; onChange: (next: ComponentDef[]) => void }) {
  return hostLanes(host) ? <EffectsEditor host={host} value={value} onChange={onChange} /> : <PartsEditor host={host} value={value} onChange={onChange} />
}
