import type { ShellViewProps } from './shellTypes'
import { ShellIcon, asideOf, enterStyle, shellState } from './ShellParts'
import { TraitChips } from './TraitChips'

const COLUMNS = '2rem 4rem minmax(180px, 26rem) minmax(120px, 14rem) 8rem'

export function ShellRows({ items, adds, bind, scale: _scale, asideLabel }: ShellViewProps) {
  return (
    <div className="flex flex-col font-mono text-[12px]">
      <div className="grid h-7 items-center gap-2.5 border-b border-line/40 px-2 text-[10px] uppercase tracking-[0.16em] text-faint" style={{ gridTemplateColumns: COLUMNS }}>
        <span>#</span>
        <span>Type</span>
        <span>Name</span>
        <span>Contents</span>
        <span>{asideLabel}</span>
      </div>
      {items.map((item, i) => {
        const b = bind(item)
        return (
          <button key={item.key} {...b.props} {...shellState(b)} className="shell-row shell-enter grid min-w-0 items-center gap-2.5 px-2 text-left" style={enterStyle(i, { ...b.props.style, gridTemplateColumns: COLUMNS, minHeight: '2.1rem' })}>
            <span className="text-faint">{String(i + 1).padStart(3, '0')}</span>
            <span>{item.tag && <span className="shell-tag">{item.tag}</span>}</span>
            <span className="flex min-w-0 items-center gap-2.5">
              {item.thumb ? (
                <span className="shrink-0 overflow-hidden" style={{ width: '2rem', height: '1.4rem' }}>
                  {item.thumb}
                </span>
              ) : (
                <ShellIcon scale={1.1} className="text-dim">
                  {item.icon}
                </ShellIcon>
              )}
              <span className={`truncate uppercase tracking-[0.05em] text-white ${b.picked ? 'shell-cursor' : ''}`}>{item.title}</span>
              <span className="shrink-0">
                <TraitChips traits={item.traits} />
              </span>
            </span>
            <span className="truncate text-dim">{item.subtitle ?? ''}</span>
            <span className="truncate text-dim">{asideOf(item) ?? ''}</span>
          </button>
        )
      })}
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
