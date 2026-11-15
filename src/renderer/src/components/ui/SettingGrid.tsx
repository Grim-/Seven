import type { ReactNode } from 'react'

export function SettingGrid({ min = '26rem', children }: { min?: string; children: ReactNode }) {
  return (
    <div style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}), 1fr))` }} className="grid gap-x-2 [&>*]:border-b [&>*]:border-white/[0.04] [&>[data-wide]]:col-span-full">
      {children}
    </div>
  )
}
