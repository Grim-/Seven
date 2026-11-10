import { cn } from '../../lib/cn'

export function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line/50 pb-2 font-mono text-[10.5px] uppercase tracking-[0.12em]">
      {steps.map((label, i) => (
        <li key={label} className={cn('flex items-center gap-1.5', i === current ? 'text-accent' : i < current ? 'text-white/70' : 'text-faint')}>
          <span>{String(i + 1).padStart(2, '0')}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  )
}
