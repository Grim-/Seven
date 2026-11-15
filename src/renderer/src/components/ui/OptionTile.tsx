import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function OptionTile({ icon, title, hint, checked, onChange, disabled = false, color = 'var(--color-accent)' }: { icon: ReactNode; title: string; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; color?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{ '--tile': color } as CSSProperties}
      className={cn(
        'group relative flex w-full items-start gap-3 border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-[color:var(--tile)] bg-[color-mix(in_srgb,var(--tile)_9%,transparent)] shadow-[inset_3px_0_0_var(--tile),0_0_14px_color-mix(in_srgb,var(--tile)_14%,transparent)]' : 'border-line/60 bg-black/30 hover:border-line-strong'
      )}
    >
      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border [&>svg]:h-3.5 [&>svg]:w-3.5', checked ? 'border-[color:var(--tile)] text-[color:var(--tile)]' : 'border-line text-faint')}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('text-[13px] font-semibold', checked ? 'text-white' : 'text-dim')}>{title}</span>
        {hint && <span className="text-[11.5px] leading-snug text-faint">{hint}</span>}
      </span>
      <span className={cn('mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em]', checked ? 'text-[color:var(--tile)]' : 'text-faint')}>{checked ? 'On' : 'Off'}</span>
    </button>
  )
}
