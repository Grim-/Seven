import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean
  interactive?: boolean
  children: ReactNode
}

export function Card({ selected, interactive = true, className, children, ...rest }: CardProps) {
  return (
    <div
      data-selected={selected ? 'true' : 'false'}
      className={cn('card-deks font-ui', interactive && 'cursor-pointer', className)}
      {...rest}
    >
      {children}
    </div>
  )
}
