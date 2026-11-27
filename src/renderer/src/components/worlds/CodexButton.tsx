import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

export function CodexButton({ active, onClick, icon: Icon, label, count, tone = 'accent' }: { active: boolean; onClick: () => void; icon: LucideIcon; label: string; count?: number; tone?: 'accent' | 'secondary' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between border-l-2 px-2.5 py-2 text-left transition-colors',
        active ? 'border-l-accent bg-accent/10 font-bold text-ink' : 'border-l-transparent text-dim hover:tone-card-40 hover:text-ink'
      )}
    >
      <div className="flex items-center gap-2 truncate">
        <Icon className={cn('h-3.5 w-3.5', active ? (tone === 'secondary' ? 'text-secondary-ink' : 'text-accent') : 'text-faint')} />
        <span>{label}</span>
      </div>
      {count !== undefined && <span className="text-[10px] text-faint">({count})</span>}
    </button>
  )
}
