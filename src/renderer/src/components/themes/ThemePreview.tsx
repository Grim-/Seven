import type { Theme } from '@shared/theme'
import { SKIN_TINTS } from '@shared/themeLook'
import { cn } from '../../lib/cn'
import { useThemeLook } from './useThemeLook'

export function ThemePreview({ theme, className }: { theme: Theme; className?: string }) {
  const style = useThemeLook(theme)
  return (
    <div style={style} className={cn('relative overflow-hidden border border-line bg-bg p-2 text-ink', className)}>
      <div className="panel-box notch-sm flex h-full flex-col gap-1.5 p-2">
        <span className="type-eyebrow text-accent-soft">Theme</span>
        <span className="type-title truncate text-ink">{theme.name}</span>
        <span className="font-body text-[11px] text-dim">Aa Bb 0123</span>
        <span className="mt-auto flex items-center gap-1.5">
          <span className="h-5 flex-1 border border-line bg-well/60" />
          <span className="bg-accent px-1.5 py-0.5 font-label text-[9px] font-bold uppercase text-on-accent">Go</span>
        </span>
        <span className="flex gap-1">
          {SKIN_TINTS.map((t) => (
            <span key={t} className="h-2 w-2" style={{ background: `var(--color-tint-${t})` }} />
          ))}
        </span>
      </div>
    </div>
  )
}
