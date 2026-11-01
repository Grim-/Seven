import type { ActionResult } from '@shared/actions'
import { registerPresentation, type PresentationProps } from '../../registries/presentations'
import { ActionResultCard } from './ActionResultCard'

function ActionPresentation({ fields }: PresentationProps) {
  const result = fields.result as ActionResult | undefined
  return result ? <ActionResultCard result={result} /> : null
}

registerPresentation('action', ActionPresentation)
