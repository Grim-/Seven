import type { ShellViewProps } from './shellTypes'
import { ShellAddTile, enterStyle, shellState } from './ShellParts'

export function ShellGallery({ items, adds, bind, scale }: ShellViewProps) {
  return (
    <div className="shell-dots grid gap-4 p-1" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${180 * scale}px, 1fr))` }}>
      {items.map((item, i) => {
        const b = bind(item)
        return (
          <button key={item.key} {...b.props} {...shellState(b)} title={item.title} style={enterStyle(i)} className="shell-holo shell-enter group px-2.5 pb-2.5 pt-3">
            <span className="shell-corner left-0 top-0 border-l border-t" />
            <span className="shell-corner bottom-0 right-0 border-b border-r" />
            {item.thumb ? (
              <span className="shell-clip relative block aspect-[4/3] w-full overflow-hidden">
                {item.thumb}
                {(item.tag || item.subtitle) && <span className="absolute bottom-1 left-1.5 font-mono text-[9px] font-semibold tracking-[0.14em] text-cyan [text-shadow:0_0_6px_rgba(0,0,0,0.9)]">{[item.tag, item.subtitle].filter(Boolean).join(' // ')}</span>}
              </span>
            ) : (
              <span className="shell-holo-glyph flex aspect-[4/3] w-full items-center justify-center">
                {item.tile ?? <span className="flex h-full w-full items-center justify-center [&_svg]:h-[42%] [&_svg]:w-[42%]">{item.icon}</span>}
              </span>
            )}
            <span className="shell-holo-name mt-2 truncate font-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white">
              <span className={b.picked ? 'shell-cursor' : undefined}>{item.title}</span>
            </span>
            {!item.thumb && item.subtitle && <span className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{item.subtitle}</span>}
          </button>
        )
      })}
      {adds.map((a) => (
        <ShellAddTile key={a.label} add={a} />
      ))}
    </div>
  )
}
