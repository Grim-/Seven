import { useState } from 'react'
import type { Action } from '@shared/actions'
import type { Decision } from '@shared/decisions'
import { Segmented } from '../ui'
import { ActionForm, BLANK_ACTION } from './ActionForm'
import { BLANK_DECISION, DecisionForm } from './DecisionForm'
import type { PlayWhere } from './playStore'

export type PlayKind = 'action' | 'decision'

const KINDS: { value: PlayKind; label: string }[] = [
  { value: 'action', label: 'Action' },
  { value: 'decision', label: 'Decision' }
]

interface Props {
  kind: PlayKind
  action?: Action
  decision?: Decision
  character: string | null
  where: PlayWhere
  onKeep?: (kind: PlayKind, text: string) => void
  keepLabel?: string
}

export function PlayBuilder({ kind: start, action, decision, character, where, onKeep, keepLabel = 'Keep on this place' }: Props) {
  const [kind, setKind] = useState<PlayKind>(start)
  const editing = Boolean(action || decision)
  return (
    <div className="flex flex-col gap-2.5">
      {!editing && <Segmented value={kind} options={KINDS} onChange={setKind} />}
      {kind === 'action' ? (
        <ActionForm initial={action ?? BLANK_ACTION} character={character} where={where} onKeep={onKeep && ((text) => onKeep('action', text))} keepLabel={keepLabel} />
      ) : (
        <DecisionForm initial={decision ?? BLANK_DECISION} where={where} onKeep={onKeep && ((text) => onKeep('decision', text))} keepLabel={keepLabel} />
      )}
    </div>
  )
}
