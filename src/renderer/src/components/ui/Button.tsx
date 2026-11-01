import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'badge' | 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  active?: boolean
  icon?: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  badge:
    'border border-line bg-black/60 text-accent font-semibold uppercase tracking-wide hover:border-accent hover:bg-accent/10 hover:text-white',
  primary:
    'notch-sm border border-accent bg-gradient-to-b from-accent/20 to-accent/5 text-accent font-semibold uppercase tracking-wider shadow-[0_0_10px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] hover:from-accent/30 hover:to-accent/10 hover:text-white hover:shadow-[0_0_18px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]',
  secondary:
    'border border-line bg-black/50 text-dim inset-field hover:border-accent hover:text-white hover:bg-cyan/5',
  danger: 'border border-alert/60 bg-alert/5 text-alert font-semibold uppercase tracking-wide hover:bg-alert/15 hover:border-alert',
  ghost: 'border border-transparent text-dim hover:text-accent hover:bg-accent/5'
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[11px] gap-1.5',
  md: 'h-9 px-3.5 text-[12.5px] gap-2',
  lg: 'h-11 px-4 text-[13px] gap-2'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', active, icon, className, children, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap transition-all duration-150 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        active && 'border-accent bg-accent/15 text-white shadow-[inset_0_-2px_0_var(--color-accent)]',
        className
      )}
      {...rest}
    >
      {icon && <span className="flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </button>
  )
})
