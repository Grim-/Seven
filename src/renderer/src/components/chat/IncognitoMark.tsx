import { EyeOff } from 'lucide-react'
import { cn } from '../../lib/cn'

export function IncognitoMark({ className }: { className?: string }) {
  return (
    <span title="Incognito: this chat is kept in memory only and leaves no trace when Seven closes or the chat is deleted" className={cn('inline-flex shrink-0 items-center gap-1 border border-line/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim', className)}>
      <EyeOff className="h-3 w-3" /> Incognito
    </span>
  )
}
