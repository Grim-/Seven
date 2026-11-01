import type { ReactNode } from 'react'

export function PathRow({ label, path, tags = [], mono = false, children }: { label: string; path: string; tags?: string[]; mono?: boolean; children?: ReactNode }) {
  return (
    <div className="path-row">
      <span className={mono ? 'w-32 shrink-0 truncate font-mono text-[12px] text-white' : 'w-32 shrink-0 truncate font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-soft'}>{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-white/90" title={path}>
        {path}
      </span>
      {tags.map((t) => (
        <span key={t} className="shell-tag shrink-0">
          {t}
        </span>
      ))}
      {children && <span className="flex shrink-0 items-center gap-1.5">{children}</span>}
    </div>
  )
}
