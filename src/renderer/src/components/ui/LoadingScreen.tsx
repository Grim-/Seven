import { Check, LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface LoadStep {
  label: string
  done: boolean
  detail?: string
}

export function LoadingScreen({
  title,
  steps,
  className
}: {
  title: string
  steps: LoadStep[]
  className?: string
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 items-center justify-center p-6', className)}>
      <div className="notch-sm flex w-72 flex-col gap-2 border border-line/50 tone-panel-60 p-4">
        <div className="font-label text-[11px] caps-16 text-accent">
          Loading {title}
        </div>
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-2 font-ui text-[11.5px]">
            {s.done ? (
              <Check className="h-3.5 w-3.5 text-ok" />
            ) : (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-secondary-ink" />
            )}
            <span className={s.done ? 'text-dim' : 'text-ink'}>{s.label}</span>
            {s.detail && <span className="ml-auto text-faint">{s.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
