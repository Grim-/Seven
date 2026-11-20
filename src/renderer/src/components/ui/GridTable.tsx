import { createContext, useContext, useMemo, type FocusEvent, type MouseEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useColumnResize, type ResizableCol } from './useColumnResize'

export interface GridColumn {
  label: string
  width: string
  right?: boolean
  sorted?: 'asc' | 'desc' | null
  onSort?: () => void
  minPx?: number
}

const Template = createContext('')

export function GridTable({ id, columns, empty, children }: { id?: string; columns: GridColumn[]; empty?: string | false; children: ReactNode }) {
  const storageKey = useMemo(() => id ?? `grid.${columns.map((c) => c.label).join('|').toLowerCase()}`, [id, columns])
  const specs = useMemo<ResizableCol[]>(
    () =>
      columns.map((c, idx) => ({
        id: c.label || String(idx),
        defaultWidth: c.width,
        minPx: c.minPx ?? 48,
        flex: /fr\b/i.test(c.width) || c.width.includes('minmax(')
      })),
    [columns]
  )
  const { template, setHeaderRef, startResize, resetWidths, dragging } = useColumnResize(storageKey, specs)

  return (
    <Template.Provider value={template}>
      <div className="flex w-full min-w-0 flex-col overflow-x-auto">
        <div className="min-w-full w-max">
          <div style={{ gridTemplateColumns: template }} className="grid w-full gap-x-3 border-b border-line/30 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            {columns.map((c, idx) => (
              <div key={c.label || idx} ref={setHeaderRef(idx)} className={cn('relative flex min-w-0 items-center pr-2', c.right && 'justify-end')}>
                {c.onSort ? (
                  <button
                    type="button"
                    onClick={c.onSort}
                    className={cn('truncate leading-tight uppercase hover:text-white', c.right && 'text-right', c.sorted && 'text-accent')}
                    title={`Sort by ${c.label}`}
                  >
                    {c.label}
                    {c.sorted === 'desc' ? ' ▼' : c.sorted === 'asc' ? ' ▲' : ''}
                  </button>
                ) : (
                  <span className={cn('truncate leading-tight', c.right && 'text-right')}>
                    {c.label}
                  </span>
                )}
                {idx < columns.length - 1 && (
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    title="Drag to resize · Double-click to reset"
                    onPointerDown={(e) => startResize(idx, e)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      resetWidths()
                    }}
                    className={cn(
                      'absolute -right-2 top-0 bottom-0 w-2.5 cursor-col-resize select-none transition-colors',
                      'after:absolute after:right-[4px] after:top-0 after:bottom-0 after:w-px',
                      dragging === idx ? 'after:bg-accent' : 'after:bg-line/25 hover:after:bg-accent'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          {children}
          {empty && <div className="px-3.5 py-3 text-[12.5px] text-faint">{empty}</div>}
        </div>
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
