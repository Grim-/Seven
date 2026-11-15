import { ENTITY_HOST, type ComponentDef } from '@shared/game/core'
import { Pieces } from './parts/Pieces'

export function EntityPieces({ value, onChange }: { value: ComponentDef[]; onChange: (next: ComponentDef[]) => void }) {
  return <Pieces host={ENTITY_HOST} value={value} onChange={onChange} />
}
