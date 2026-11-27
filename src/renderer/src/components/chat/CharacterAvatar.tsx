import type { CSSProperties, MouseEvent } from 'react'
import { showName } from '@shared/ids'
import { actorEntry, actorLink } from '@shared/worldNpcs'
import { cn } from '../../lib/cn'
import { useEntryPreview } from '../entries/entryPreview'
import { AssetMedia } from '../pictures/AssetMedia'
import { openEntry } from '../../lib/library'

export function CharacterAvatar({
  sheetId,
  size = 28,
  className,
  title,
  onClick,
  onContextMenu,
  openOnClick = false
}: {
  sheetId?: string | null
  size?: number
  className?: string
  title?: string
  onClick?: () => void
  onContextMenu?: (e: MouseEvent) => void
  openOnClick?: boolean
}) {
  const preview = useEntryPreview(sheetId ? actorLink(sheetId) : '')
  const valid = preview && !('missing' in preview) ? preview : null
  const style: CSSProperties = { width: size, height: size }

  const defaultTitle = sheetId
    ? (title ?? (valid ? showName(valid.title) : sheetId))
    : (title ?? 'No character selected')

  const handleClick = (e: MouseEvent) => {
    if (onClick) {
      onClick()
    } else if (openOnClick && sheetId) {
      e.stopPropagation()
      const entry = actorEntry(sheetId)
      openEntry(entry.kind, entry.id)
    }
  }

  if (!sheetId) {
    return (
      <span
        style={style}
        title={defaultTitle}
        onClick={handleClick}
        onContextMenu={onContextMenu}
        className={cn(
          'inline-flex shrink-0 items-center justify-center border border-dashed border-line/60 tone-panel-50 font-label text-[9.5px] font-bold caps-5 text-faint transition-colors select-none',
          onClick && 'cursor-pointer hover:border-accent hover:text-accent',
          className
        )}
      >
        <span>+</span>
      </span>
    )
  }

  if (valid?.image) {
    return (
      <span
        style={style}
        title={defaultTitle}
        onClick={handleClick}
        onContextMenu={onContextMenu}
        className={cn(
          'relative inline-block shrink-0 overflow-hidden border border-accent/60 bg-panel transition-colors select-none',
          (onClick || openOnClick) && 'cursor-pointer hover:border-accent hover:opacity-90',
          className
        )}
      >
        <AssetMedia id={valid.image} className="h-full w-full object-cover" />
      </span>
    )
  }

  const name = valid ? showName(valid.title) : sheetId
  const initial = (name.trim().charAt(0) || '?').toUpperCase()

  return (
    <span
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.44)) }}
      title={defaultTitle}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center border border-accent/60 bg-accent/10 font-label font-bold caps text-accent transition-colors select-none',
        (onClick || openOnClick) && 'cursor-pointer hover:border-accent hover:bg-accent/20',
        className
      )}
    >
      <span>{initial}</span>
    </span>
  )
}
