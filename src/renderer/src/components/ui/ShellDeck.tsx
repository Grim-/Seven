import type { ShellViewProps } from './shellTypes'
import { FaceCount, FaceGrid, ShellAddTile, asideOf, enterStyle, shellState } from './ShellParts'
import { ShellFace } from './ShellFace'
import { Pressable } from './Pressable'

export function ShellDeck({ items, adds, bind, scale }: ShellViewProps) {
  return (
    <FaceGrid scale={scale}>
      {items.map((item, i) => {
        const b = bind(item)
        return (
          <Pressable key={item.key} {...b.props} {...shellState(b)} title={item.title} style={enterStyle(i, b.props.style)} className="shell-enter group relative block min-w-0 cursor-pointer text-left">
            {item.face ?? (
              <ShellFace
                title={item.title}
                label={item.tag}
                aside={asideOf(item)}
                color={item.color}
                art={item.thumb ?? item.tile}
                type={item.subtitle}
                body={item.excerpt}
              />
            )}
            <FaceCount count={item.count} />
            {item.action && (
              <span
                className="absolute right-2 top-2 z-10"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {item.action}
              </span>
            )}
          </Pressable>
        )
      })}
      {adds.map((a) => (
        <ShellAddTile key={a.label} add={a} />
      ))}
    </FaceGrid>
  )
}
