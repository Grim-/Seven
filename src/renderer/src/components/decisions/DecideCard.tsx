import type { UiRequestState } from '@shared/types'
import { pickMadeText, type PickAnswer, type PickDecisionProps } from '@shared/pickDecision'
import { laterDecisionText } from '@shared/uiLater'
import { StatusLine, answer, later, type RequestPlace } from '../../registries/ui-requests'
import { DecideView } from './DecideView'
import { AnsweringAbove } from './AnsweringAbove'

export function DecideCard({ ui, place }: { ui: UiRequestState; place: RequestPlace }) {
  const p = ui.props as PickDecisionProps
  if (place === 'inline' && ui.status === 'pending') return <AnsweringAbove tag="Decision" question={p.question} />
  const handleClose = () => {
    void later(ui, laterDecisionText('decide', p.question, p.from))
  }
  return (
    <DecideView
      p={p}
      done={ui.status === 'answered' ? (ui.answer as PickAnswer) : null}
      open={ui.status === 'pending' || ui.status === 'expired'}
      status={<StatusLine ui={ui} />}
      onAnswer={(value) => answer(ui, value, pickMadeText(p, value, null))}
      onClose={ui.status === 'pending' ? handleClose : undefined}
    />
  )
}
