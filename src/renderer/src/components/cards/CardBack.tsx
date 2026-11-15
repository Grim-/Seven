import { cn } from '../../lib/cn'

export function CardBack({ className }: { className?: string }) {
  return <span className={cn('card-back', className)} />
}
