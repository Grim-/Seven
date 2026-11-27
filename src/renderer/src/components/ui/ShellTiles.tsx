import type { ShellViewProps } from './shellTypes'
import { Pressable } from './Pressable'
import { ShellAddTile, ShellSweep, asideOf, enterStyle, shellState } from './ShellParts'
import { TraitChips } from './TraitChips'

export function ShellTiles({ items, adds, bind, scale }: ShellViewProps) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${150 * scale}px, 1fr))` }}>
      {items.map((item, i) => {
        const b = bind(item)
        return (
          <Pressable key={item.key} {...b.props} {...shellState(b)} title={item.title} style={enterStyle(i, b.props.style)} className="shell-slate shell-enter group cursor-pointer flex-col text-left">
            <ShellSweep />
            <span className="flex items-center justify-between gap-2 border-b border-line/40 px-2 py-1 font-label text-[9.5px] font-bold tracking-[0.16em]">
              <span className="truncate text-accent-soft">{item.tag ?? ''}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {asideOf(item) && <span className="font-normal text-faint">{asideOf(item)}</span>}
                {item.action && (
                  <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    {item.action}
                  </span>
                )}
              </span>
            </span>
            <span className="shell-art aspect-[4/3] w-full">{item.thumb ?? item.tile ?? <span className="flex h-full w-full items-center justify-center [&_svg]:h-[42%] [&_svg]:w-[42%]">{item.icon}</span>}</span>
            <span className="truncate px-2 pt-1.5 font-ui text-[11.5px] font-semibold caps-6 text-ink">
              <span className={b.picked ? 'shell-cursor' : undefined}>{item.title}</span>
            </span>
            <span className="flex min-h-5 items-center gap-2 px-2 pb-2 pt-0.5 font-label text-[10px] caps-8 text-faint">
              <span className="min-w-0 truncate">{item.subtitle ?? ''}</span>
            </span>
            {item.traits?.length ? (
              <span className="px-2 pb-2">
                <TraitChips traits={item.traits} />
              </span>
            ) : null}
          </Pressable>
        )
      })}
      {adds.map((a) => (
        <ShellAddTile key={a.label} add={a} />
      ))}
    </div>
  )
}
