import { cn } from '../../../lib/cn'
import type { Health } from './characterStatus'

export function HealthBar({ health, className }: { health: Health; className?: string }) {
  const part = health.max > 0 ? Math.min(1, Math.max(0, health.cur / health.max)) : 0
  return (
    <span className={cn('relative block h-1.5 overflow-hidden bg-ink/10', className)}>
      <span style={{ width: `${part * 100}%` }} className={cn('absolute inset-y-0 left-0', part > 0.5 ? 'bg-ok' : part > 0.25 ? 'bg-accent' : 'bg-alert')} />
    </span>
  )
}
