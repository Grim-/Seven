import type { Proficiency } from '@shared/dnd'
import { cn } from '../../../../lib/cn'

const MARK: Record<Proficiency, string> = { 0: 'border-line', 1: 'border-accent bg-accent', 2: 'border-secondary-ink bg-secondary-ink' }

export function ProfRow({ level, label, value, title, onClick }: { level: Proficiency; label: string; value: string; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} className="flex items-center gap-2 py-px text-left text-[12.5px] hover:bg-ink/[0.03]">
      <span className={cn('h-2 w-2 shrink-0 border', MARK[level])} />
      <span className={cn('flex-1 truncate', level ? 'text-ink' : 'text-dim')}>{label}</span>
      <span className={cn('font-ui', level ? 'text-secondary-ink' : 'text-dim')}>{value}</span>
    </button>
  )
}
