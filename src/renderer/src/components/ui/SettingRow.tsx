import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { InfoTip } from './InfoTip'
import { useInSettingCard } from './SettingCard'

export function SettingRow({ label, hint, error, aside, wide = false, children }: { label: string; hint?: string; error?: string | null; aside?: ReactNode; wide?: boolean; children: ReactNode }) {
  const card = useInSettingCard()
  if (card)
    return (
      <div data-setting={label} data-wide={wide || undefined} className={cn('setting-row', wide ? 'flex flex-col gap-2' : 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1')}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[13.5px] text-white">
            {label}
            {aside}
          </span>
          {error ? <span className="text-[12px] text-alert">{error}</span> : hint && <span className="text-[12px] leading-snug text-faint">{hint}</span>}
        </div>
        <div className={cn('flex min-w-0 items-center', wide ? 'w-full' : 'justify-end')}>{children}</div>
      </div>
    )
  return (
    <div className={cn('flex min-h-9 gap-x-3 gap-y-1.5 border-b border-line/20 py-1 last:border-b-0', wide ? 'flex-col justify-center' : 'items-center')}>
      <span className="flex min-w-0 shrink-0 items-center gap-1.5 text-[12.5px] text-white/85">
        {label}
        <InfoTip title={label} text={hint} />
        {aside}
      </span>
      {error && <span className="text-[12px] text-alert">{error}</span>}
      <span className={cn('flex min-w-0 items-center', wide ? 'w-full' : 'ml-auto justify-end')}>{children}</span>
    </div>
  )
}
