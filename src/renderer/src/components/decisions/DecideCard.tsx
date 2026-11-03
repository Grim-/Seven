import type { UiRequestState } from '@shared/types'
import { pickMadeText, type PickAnswer, type PickDecisionProps } from '@shared/pickDecision'
import { StatusLine, answer } from '../../registries/ui-requests'
import { DecideView } from './DecideView'

export function DecideCard({ ui }: { ui: UiRequestState }) {
  const p = ui.props as PickDecisionProps
  return (
    <DecideView
      p={p}
      done={ui.status === 'answered' ? (ui.answer as PickAnswer) : null}
      open={ui.status === 'pending' || ui.status === 'expired'}
      status={<StatusLine ui={ui} />}
      onAnswer={(value) => answer(ui, value, pickMadeText(p, value, null))}
    />
  )
}
