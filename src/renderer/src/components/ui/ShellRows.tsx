import { cn } from '../../lib/cn'
import { Pressable } from './Pressable'
import { useColumnResize, type ResizableCol } from './useColumnResize'
import type { ShellColumnKey, ShellViewProps } from './shellTypes'
import { ShellIcon, asideOf, enterStyle, shellState } from './ShellParts'
import { TraitChips } from './TraitChips'

const DEFAULT_COLS: ResizableCol[] = [
  { id: 'num', defaultWidth: '2.75rem', minPx: 36 },
  { id: 'type', defaultWidth: '5.75rem', minPx: 60 },
  { id: 'name', defaultWidth: 'minmax(240px, 2.8fr)', minPx: 140, flex: true },
  { id: 'contents', defaultWidth: 'minmax(180px, 2fr)', minPx: 120, flex: true },
  { id: 'aside', defaultWidth: '7.5rem', minPx: 72 }
]

const HEADERS: { id: string; label?: string; sortKey?: ShellColumnKey; right?: boolean; resizable?: boolean }[] = [
  { id: 'num', label: '#' },
  { id: 'type', label: 'Type', sortKey: 'type', resizable: true },
  { id: 'name', label: 'Name', sortKey: 'name', resizable: true },
  { id: 'contents', label: 'Contents', sortKey: 'contents', resizable: true },
  { id: 'aside', sortKey: 'aside', right: true, resizable: true }
]

export function ShellRows({ shellId = 'default', items, adds, bind, scale: _scale, asideLabel, columnSort, onColumnSort }: ShellViewProps) {
  const { template, setHeaderRef, startResize, resetWidths, dragging } = useColumnResize(`shell.${shellId}`, DEFAULT_COLS)

  return (
    <div className="flex w-full min-w-0 flex-col overflow-x-auto font-mono text-[12px]">
      <div className="min-w-full w-max">
        <div
          className="grid h-7 w-full items-center border-b border-line/40 px-2 text-[10px] uppercase tracking-[0.16em] text-faint"
          style={{ gridTemplateColumns: template }}
        >
          {HEADERS.map((col, idx) => {
            const label = col.id === 'aside' ? asideLabel : col.label
            const activeDir = col.sortKey && columnSort?.column === col.sortKey ? columnSort.dir : null
            const sortable = Boolean(col.sortKey && onColumnSort)
            return (
              <div
                key={col.id}
                ref={setHeaderRef(idx)}
                className={cn('relative flex h-full min-w-0 items-center pr-2.5', col.right && 'justify-end', idx > 0 && 'pl-2')}
              >
                {sortable ? (
                  <button
                    type="button"
                    onClick={() => onColumnSort?.(col.sortKey!)}
                    className={cn(
                      'flex min-w-0 items-center gap-1 truncate uppercase transition-colors hover:text-white',
                      col.right && 'ml-auto',
                      activeDir ? 'text-accent' : 'text-faint'
                    )}
                    title={`Sort by ${label}`}
                  >
                    <span className="truncate">{label}</span>
                    {activeDir === 'asc' && <span className="shrink-0 text-[9px]">▲</span>}
                    {activeDir === 'desc' && <span className="shrink-0 text-[9px]">▼</span>}
                  </button>
                ) : (
                  <span className={cn('truncate', col.right && 'text-right')}>{label}</span>
                )}
                {col.resizable && (
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
                      'absolute right-0 top-1 bottom-1 w-2 cursor-col-resize select-none transition-colors',
                      'after:absolute after:right-[3px] after:top-0 after:bottom-0 after:w-px',
                      dragging === idx ? 'after:bg-accent' : 'after:bg-line/35 hover:after:bg-accent'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        {items.map((item, i) => {
          const b = bind(item)
          const aside = asideOf(item) ?? ''
          return (
            <Pressable
              key={item.key}
              {...b.props}
              {...shellState(b)}
              className="shell-row shell-enter grid w-full min-w-0 cursor-pointer items-center px-2 text-left"
              style={enterStyle(i, { ...b.props.style, gridTemplateColumns: template, minHeight: '2.2rem' })}
            >
              <span className="pr-2.5 text-faint">{String(i + 1).padStart(3, '0')}</span>
              <span className="min-w-0 truncate pl-2 pr-2.5">{item.tag && <span className="shell-tag">{item.tag}</span>}</span>
              <span className="flex min-w-0 items-center gap-2.5 pl-2 pr-2.5">
                {item.thumb ? (
                  <span className="shrink-0 overflow-hidden" style={{ width: '2rem', height: '1.4rem' }}>
                    {item.thumb}
                  </span>
                ) : (
                  <ShellIcon scale={1.1} className="text-dim">
                    {item.icon}
                  </ShellIcon>
                )}
                <span className={`truncate uppercase tracking-[0.05em] text-white ${b.picked ? 'shell-cursor' : ''}`} title={item.title}>
                  {item.title}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-2 pl-2 pr-2.5">
                {item.subtitle && <span className="min-w-0 truncate text-dim" title={item.subtitle}>{item.subtitle}</span>}
                {item.traits && item.traits.length > 0 && (
                  <span className="shrink-0">
                    <TraitChips traits={item.traits} />
                  </span>
                )}
              </span>
              <span className="flex items-center justify-end gap-2 pl-2 pr-1 text-right text-dim" title={aside}>
                {aside && <span className="truncate">{aside}</span>}
                {item.action && (
                  <span className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {item.action}
                  </span>
                )}
              </span>
            </Pressable>
          )
        })}
      </div>

      {adds.length > 0 && (
        <div className="flex gap-2 pt-2">
          {adds.map((a) => (
            <button key={a.label} onClick={a.onClick} className="shell-add flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase tracking-[0.1em]">
              <span className="flex h-4 w-4 items-center justify-center">{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
