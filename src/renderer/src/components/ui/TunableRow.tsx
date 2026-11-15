import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { cn } from '../../lib/cn'
import { RowAction } from './ListRow'
import { SettingRow } from './SettingRow'

export function TunableRow({ label, hint, wide = false, changed, from, onReset, disabled = false, nested, children }: { label: string; hint?: string; wide?: boolean; changed: boolean; from?: string; onReset: () => void; disabled?: boolean; nested?: ReactNode; children: ReactNode }) {
  return (
    <div data-wide={wide || undefined} className={cn('flex flex-col border-l-2', changed ? 'border-l-accent' : from ? 'border-l-accent/40' : 'border-l-transparent')}>
      <SettingRow label={label} hint={!changed && from ? `From ${from}.${hint ? ` ${hint}` : ''}` : hint} wide={wide} aside={changed ? <RowAction title="Back to the default" icon={<RotateCcw />} onClick={onReset} /> : undefined}>
        <div aria-disabled={disabled ? true : undefined} className={cn(wide && 'w-full', disabled && 'pointer-events-none opacity-40')}>
          {children}
        </div>
      </SettingRow>
      {nested && <div className="ml-5 flex flex-col border-l border-line/30">{nested}</div>}
    </div>
  )
}
