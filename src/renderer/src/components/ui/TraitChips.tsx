import type { ShellTrait } from './shellTypes'

export function TraitChips({ traits }: { traits?: ShellTrait[] }) {
  if (!traits?.length) return null
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {traits.map((t) => (
        <span key={t.key} className="trait-chip" data-tone={t.tone ?? 'idle'} title={t.hint}>
          {t.label}
        </span>
      ))}
    </span>
  )
}
