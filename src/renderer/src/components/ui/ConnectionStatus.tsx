import { useConnection } from '../../lib/transport'
import { StatusBadge } from './feedback'

export function ConnectionStatus({ className }: { className?: string }) {
  const state = useConnection()
  if (!state || state.up) return null
  return (
    <StatusBadge tone={state.retrying ? 'busy' : 'error'} className={className}>
      {state.label}
    </StatusBadge>
  )
}
