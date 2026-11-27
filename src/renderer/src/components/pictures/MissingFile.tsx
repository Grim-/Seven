import { FileX } from 'lucide-react'
import { cn } from '../../lib/cn'

export function MissingFile({ label = 'Missing file', className }: { label?: string; className?: string }) {
  return (
    <div title={`${label}: it was deleted or moved. Pick another to replace it.`} className={cn('flex flex-col items-center justify-center gap-1 border border-dashed border-alert/60 bg-alert/[0.06] p-1 font-label text-[10px] caps-12 text-alert', className)}>
      <FileX className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  )
}
