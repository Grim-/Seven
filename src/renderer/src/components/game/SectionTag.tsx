import type { ReactNode } from 'react'

export function SectionTag({ children }: { children: ReactNode }) {
  return (
    <span className="notch-sm inline-flex items-center gap-2 self-start border border-accent/60 bg-accent/[0.09] py-1 pl-2 pr-2.5 font-label text-[11px] font-bold caps-12 text-accent">
      <i className="h-2 w-2 bg-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_calc(100%*var(--glow)),transparent)]" />
      {children}
    </span>
  )
}
