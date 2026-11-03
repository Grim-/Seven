import type { UiRequestState } from '@shared/types'
import { rolledMadeText, type RolledAnswer, type RolledDecisionProps } from '@shared/rolledDecision'
import { StatusLine, answer } from '../../registries/ui-requests'
import { RolledView } from './RolledView'

export function RolledCard({ ui }: { ui: UiRequestState }) {
  const p = ui.props as RolledDecisionProps
  return (
    <RolledView
      p={p}
      done={ui.status === 'answered' ? (ui.answer as RolledAnswer) : null}
      open={ui.status === 'pending' || ui.status === 'expired'}
      status={<StatusLine ui={ui} />}
      onAnswer={(value) => answer(ui, value, rolledMadeText(p, value))}
    />
  )
}
