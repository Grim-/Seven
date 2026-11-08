import type { UiRequestState } from '@shared/types'
import { rolledMadeText, type RolledAnswer, type RolledDecisionProps } from '@shared/rolledDecision'
import { laterDecisionText } from '@shared/uiLater'
import { StatusLine, answer, later, type RequestPlace } from '../../registries/ui-requests'
import { RolledView } from './RolledView'
import { AnsweringAbove } from './AnsweringAbove'

export function RolledCard({ ui, place }: { ui: UiRequestState; place: RequestPlace }) {
  const p = ui.props as RolledDecisionProps
  if (place === 'inline' && ui.status === 'pending') return <AnsweringAbove tag="Rolled decision" question={p.question} />
  const handleClose = () => {
    void later(ui, laterDecisionText('roll_decision', p.question, p.from))
  }
  return (
    <RolledView
      p={p}
      done={ui.status === 'answered' ? (ui.answer as RolledAnswer) : null}
      open={ui.status === 'pending' || ui.status === 'expired'}
      status={<StatusLine ui={ui} />}
      onAnswer={(value) => answer(ui, value, rolledMadeText(p, value))}
      onClose={ui.status === 'pending' ? handleClose : undefined}
    />
  )
}
