import type { ShellViewProps } from './shellTypes'
import { ShellAddTile, ShellSweep, asideOf, enterStyle, shellState } from './ShellParts'
import { TraitChips } from './TraitChips'

export function ShellTiles({ items, adds, bind, scale }: ShellViewProps) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${150 * scale}px, 1fr))` }}>
      {items.map((item, i) => {
        const b = bind(item)
        return (
          <button key={item.key} {...b.props} {...shellState(b)} title={item.title} style={enterStyle(i)} className="shell-slate shell-enter group flex-col">
            <ShellSweep />
            <span className="flex items-center justify-between gap-2 border-b border-line/40 px-2 py-1 font-mono text-[9.5px] font-bold tracking-[0.16em]">
              <span className="truncate text-accent-soft">{item.tag ?? ''}</span>
              {asideOf(item) && <span className="shrink-0 font-normal text-faint">{asideOf(item)}</span>}
            </span>
            <span className="shell-art aspect-[4/3] w-full">{item.thumb ?? item.tile ?? <span className="flex h-full w-full items-center justify-center [&_svg]:h-[42%] [&_svg]:w-[42%]">{item.icon}</span>}</span>
            <span className="truncate px-2 pt-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white">
              <span className={b.picked ? 'shell-cursor' : undefined}>{item.title}</span>
            </span>
            <span className="flex min-h-5 items-center gap-2 px-2 pb-2 pt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
              <span className="min-w-0 truncate">{item.subtitle ?? ''}</span>
            </span>
            {item.traits?.length ? (
              <span className="px-2 pb-2">
                <TraitChips traits={item.traits} />
              </span>
            ) : null}
          </button>
        )
      })}
      {adds.map((a) => (
        <ShellAddTile key={a.label} add={a} />
      ))}
    </div>
  )
}
