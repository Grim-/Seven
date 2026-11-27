import { cn } from '../../lib/cn'

export function DropOverlay({ show, label, className }: { show: boolean; label: string; className?: string }) {
  if (!show) return null
  return <div className={cn('pointer-events-none absolute inset-2 z-40 flex items-center justify-center border-2 border-dashed border-accent bg-scrim/80 font-label text-[13px] caps-20 text-accent', className)}>{label}</div>
}
