import type { ReactNode } from 'react'

export function PanelBody({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">{children}</div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line/60 bg-ink/[0.03] px-5 py-3">{footer}</div>
    </div>
  )
}

export function PanelLabel({ children }: { children: ReactNode }) {
  return <span className="text-[12px] font-semibold text-dim">{children}</span>
}
