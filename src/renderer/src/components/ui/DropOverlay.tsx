import { cn } from '../../lib/cn'

export function DropOverlay({ show, label, className }: { show: boolean; label: string; className?: string }) {
  if (!show) return null
  return <div className={cn('pointer-events-none absolute inset-2 z-40 flex items-center justify-center border-2 border-dashed border-accent bg-black/80 font-mono text-[13px] uppercase tracking-[0.2em] text-accent', className)}>{label}</div>
}
