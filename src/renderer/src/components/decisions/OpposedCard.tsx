import type { UiRequestState } from '@shared/types'
import { opposedText, type OpposedAnswer, type OpposedProps } from '@shared/opposedCheck'
import { StatusLine, answer, type RequestPlace } from '../../registries/ui-requests'
import { OpposedView } from './OpposedView'
import { AnsweringAbove } from './AnsweringAbove'

export function OpposedCard({ ui, place }: { ui: UiRequestState; place: RequestPlace }) {
  const p = ui.props as OpposedProps
  if (place === 'inline' && ui.status === 'pending') return <AnsweringAbove tag="Opposed check" question={p.question} />
  return (
    <OpposedView
      p={p}
      done={ui.status === 'answered' ? (ui.answer as OpposedAnswer) : null}
      open={ui.status === 'pending' || ui.status === 'expired'}
      status={<StatusLine ui={ui} />}
      onAnswer={(value) => answer(ui, value, opposedText(value))}
    />
  )
}
