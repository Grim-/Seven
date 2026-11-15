import type { CSSProperties, MouseEventHandler, ReactNode } from 'react'
import type { VfxCue } from '../../store/vfx'
import { useVfx } from './useVfx'

export function VfxFrame({
  target,
  cue,
  as = 'div',
  className,
  style,
  title,
  onClick,
  onContextMenu,
  children
}: {
  target?: string | (string | null | undefined)[] | null
  cue?: VfxCue | null
  as?: 'div' | 'span'
  className?: string
  style?: CSSProperties
  title?: string
  onClick?: MouseEventHandler<HTMLElement>
  onContextMenu?: MouseEventHandler<HTMLElement>
  children: ReactNode
}) {
  const ref = useVfx<HTMLElement>(target, cue)
  const Tag = as
  return (
    <Tag ref={ref as never} style={style} title={title} onClick={onClick} onContextMenu={onContextMenu} className={className}>
      {children}
    </Tag>
  )
}
