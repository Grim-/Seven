import type { ReactionCue } from '../../store/reactions'
import { cn } from '../../lib/cn'

export function ThoughtTag({
  size,
  tool,
  cue
}: {
  size: number
  tool: { name: string; label: string } | null
  cue: ReactionCue | null
}) {
  const label = cue?.label || tool?.label || ''
  if (!tool && !cue) return null
  const alert = cue?.kind === 'hit' || cue?.kind === 'glitch'

  if (size < 48) {
    return (
      <span
        title={label || tool?.name}
        className={cn(
          'pointer-events-none absolute -top-0.5 -right-0.5 z-20 h-1.5 w-1.5 shadow-[0_0_4px_color-mix(in_srgb,var(--color-shade)_90%,transparent)]',
          alert ? 'bg-alert' : 'bg-secondary-ink animate-pulse'
        )}
      />
    )
  }

  if (!label) return null
  return (
    <span
      title={tool ? `${tool.name}: ${tool.label}` : label}
      className={cn(
        'pointer-events-none absolute -top-2.5 right-0 z-30 max-w-[148px] truncate border tone-panel-95 px-1.5 py-0.5 font-label text-[9px] font-bold caps-12 leading-none shadow-[0_0_8px_color-mix(in_srgb,var(--color-shade)_90%,transparent)]',
        alert ? 'border-alert/80 text-alert' : 'border-secondary-ink/70 text-secondary-ink'
      )}
    >
      {label}
    </span>
  )
}
