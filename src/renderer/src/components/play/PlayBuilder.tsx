import { useState } from 'react'
import type { Action } from '@shared/actions'
import type { Decision } from '@shared/decisions'
import { Segmented } from '../ui'
import { ActionForm, BLANK_ACTION } from './ActionForm'
import { BLANK_DECISION, DecisionForm } from './DecisionForm'
import type { PlayWhere } from './playStore'
import { PickDecisionForm } from '../decisions/PickDecisionForm'
import { RolledDecisionForm } from '../decisions/RolledDecisionForm'
import { OpposedForm } from '../decisions/OpposedForm'

export type PlayKind = 'action' | 'decision' | 'rolled' | 'opposed'

const HOLDER_KINDS: { value: PlayKind; label: string }[] = [
  { value: 'action', label: 'Action' },
  { value: 'decision', label: 'Decision' }
]

const CHAT_KINDS: { value: PlayKind; label: string }[] = [...HOLDER_KINDS, { value: 'rolled', label: 'Rolled' }, { value: 'opposed', label: 'Opposed check' }]

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
      {!editing && <Segmented value={kind} options={onKeep ? HOLDER_KINDS : CHAT_KINDS} onChange={setKind} />}
      {kind === 'action' && <ActionForm initial={action ?? BLANK_ACTION} character={character} where={where} onKeep={onKeep && ((text) => onKeep('action', text))} keepLabel={keepLabel} />}
      {kind === 'decision' &&
        (onKeep || decision ? (
          <DecisionForm initial={decision ?? BLANK_DECISION} where={where} onKeep={onKeep && ((text) => onKeep('decision', text))} keepLabel={keepLabel} />
        ) : (
          <PickDecisionForm character={character} where={where} />
        ))}
      {kind === 'rolled' && <RolledDecisionForm where={where} />}
      {kind === 'opposed' && <OpposedForm where={where} />}
    </div>
  )
}
