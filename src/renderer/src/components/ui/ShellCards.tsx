import type { ShellViewProps } from './shellTypes'
import { ShellIcon, ShellSweep, asideOf, enterStyle, shellState } from './ShellParts'
import { TraitChips } from './TraitChips'

export function ShellCards({ items, adds, bind, scale }: ShellViewProps) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${17 * scale}rem, 1fr))` }}>
      {items.map((item, i) => {
        const b = bind(item)
        return (
          <button key={item.key} {...b.props} {...shellState(b)} style={enterStyle(i, b.props.style)} className="shell-slate shell-enter group gap-3 p-2.5">
            <ShellSweep />
            {item.thumb ? (
              <span className="shell-art shrink-0" style={{ width: `${4 * scale}rem`, height: `${4 * scale}rem` }}>
                {item.thumb}
              </span>
            ) : (
              <span className="shell-art flex shrink-0 items-center justify-center" style={{ width: `${2.5 * scale}rem`, height: `${2.5 * scale}rem` }}>
                <ShellIcon scale={scale * 1.25}>
                  {item.icon}
                </ShellIcon>
              </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex min-w-0 items-center gap-2">
                {item.tag && <span className="shell-tag">{item.tag}</span>}
                <span className={`min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold uppercase tracking-[0.05em] text-white ${b.picked ? 'shell-cursor' : ''}`}>{item.title}</span>
                {asideOf(item) && <span className="shrink-0 font-mono text-[10px] text-faint">{asideOf(item)}</span>}
              </span>
              {item.subtitle && <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.08em] text-accent-soft">{item.subtitle}</span>}
              <TraitChips traits={item.traits} />
              {item.excerpt && <span className="line-clamp-3 text-[12px] leading-snug text-dim">{item.excerpt}</span>}
            </span>
          </button>
        )
      })}
      {adds.map((a) => (
        <button key={a.label} onClick={a.onClick} className="shell-add flex min-h-16 items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] [&_svg]:h-4 [&_svg]:w-4">
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  )
}
