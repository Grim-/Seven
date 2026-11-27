import type { ReactNode } from 'react'
import { Eyebrow } from '../../../ui'

export function StatCard({
  label,
  value,
  sub
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border border-line/50 tone-panel-50 px-4 py-2.5">
      <Eyebrow className="text-[10px]">{label}</Eyebrow>
      <span className="font-ui text-[22px] font-semibold leading-tight text-ink">{value}</span>
      {sub && <span className="text-[11.5px] text-faint">{sub}</span>}
    </div>
  )
}
