import { cn } from '../../../../lib/cn'

export function Change({ value, text }: { value: number | null; text?: string }) {
  if (value === null) return <span className="text-faint">—</span>
  return (
    <span
      className={cn('font-ui', value > 0 ? 'text-ok' : value < 0 ? 'text-alert' : 'text-faint')}
    >
      {text ?? `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`}
    </span>
  )
}
