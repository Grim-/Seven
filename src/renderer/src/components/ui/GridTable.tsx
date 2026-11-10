import { createContext, useContext, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface GridColumn {
  label: string
  width: string
  right?: boolean
  sorted?: 'asc' | 'desc' | null
  onSort?: () => void
}

const Template = createContext('')

export function GridTable({ columns, empty, children }: { columns: GridColumn[]; empty?: string | false; children: ReactNode }) {
  const template = columns.map((c) => c.width).join(' ')
  return (
    <Template.Provider value={template}>
      <div className="flex min-w-0 flex-col overflow-x-auto">
        <div style={{ gridTemplateColumns: template }} className="grid w-full gap-x-3 border-b border-line/30 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          {columns.map((c) =>
            c.onSort ? (
              <button key={c.label} type="button" onClick={c.onSort} className={cn('leading-tight uppercase hover:text-white', c.right && 'text-right', c.sorted && 'text-accent')}>
                {c.label}
                {c.sorted === 'desc' ? ' ▼' : c.sorted === 'asc' ? ' ▲' : ''}
              </button>
            ) : (
              <span key={c.label} className={cn('leading-tight', c.right && 'text-right')}>
                {c.label}
              </span>
            )
          )}
        </div>
        {children}
        {empty && <div className="px-3.5 py-3 text-[12.5px] text-faint">{empty}</div>}
      </div>
    </Template.Provider>
  )
}

export function GridRow({ onClick, onContextMenu, selected, onBlur, children }: { onClick?: () => void; onContextMenu?: (e: MouseEvent<HTMLElement>) => void; selected?: boolean; onBlur?: (e: FocusEvent<HTMLDivElement>) => void; children: ReactNode }) {
  const template = useContext(Template)
  const className = cn('grid w-full items-center gap-x-3 border-b border-line/20 px-3.5 py-1.5 text-left', onClick && 'hover:bg-white/[0.03]', selected && 'bg-accent/10')
  if (onClick)
    return (
      <button onClick={onClick} onContextMenu={onContextMenu} style={{ gridTemplateColumns: template }} className={className}>
        {children}
      </button>
    )
  return (
    <div onBlur={onBlur} onContextMenu={onContextMenu} style={{ gridTemplateColumns: template }} className={className}>
      {children}
    </div>
  )
}
