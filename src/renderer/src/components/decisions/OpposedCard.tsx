import type { UiRequestState } from '@shared/types'
import { opposedText, type OpposedAnswer, type OpposedProps } from '@shared/opposedCheck'
import { StatusLine, answer } from '../../registries/ui-requests'
import { OpposedView } from './OpposedView'

export function OpposedCard({ ui }: { ui: UiRequestState }) {
  return (
    <OpposedView
      p={ui.props as OpposedProps}
      done={ui.status === 'answered' ? (ui.answer as OpposedAnswer) : null}
      open={ui.status === 'pending' || ui.status === 'expired'}
      status={<StatusLine ui={ui} />}
      onAnswer={(value) => answer(ui, value, opposedText(value))}
    />
  )
}
