import { useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { ChevronDown, ChevronRight, ExternalLink, Layers, Maximize2, Minimize2, PanelRight, Sparkles, X } from 'lucide-react'
import { showName } from '@shared/ids'
import { on } from '../../lib/ipc'
import { presentOf, setDefaultEntrySlate, type EntrySlateProps } from '../../registries/kinds'
import { useEntryPreview } from './entryPreview'
import { AssetMedia } from '../pictures/AssetMedia'
import { Facts, InsideSlateContext } from './EntryCard'
import { Markdown } from '../chat/Markdown'
import { showInData } from '../../lib/library'
import { showInPanel } from '../data/showInPanel'
import { pinToChatTable } from '../chat/tabletopStore'
import { useEscapeLayer } from '../../lib/escape'
import { cn } from '../../lib/cn'

export type SlateResizeEdge = 'r' | 'b' | 'br'

export function SlateContainer({
  title,
  tag,
  subtitle,
  thumb,
  entryKey,
  expanded = true,
  maximized: controlledMaximized,
  width,
  height,
  fillCell = false,
  onToggleExpand,
  onToggleMaximize,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onPin,
  onShowInPanel,
  onOpenData,
  onRemove,
  actions,
  children,
  className
}: {
  title: ReactNode
  tag: string
  subtitle?: ReactNode
  thumb?: ReactNode
  entryKey?: string
  expanded?: boolean
  maximized?: boolean
  width?: number
  height?: number
  fillCell?: boolean
  onToggleExpand?: () => void
  onToggleMaximize?: () => void
  onHeaderPointerDown?: (e: React.PointerEvent) => void
  onHeaderPointerMove?: (e: React.PointerEvent) => void
  onHeaderPointerUp?: (e: React.PointerEvent) => void
  onResizePointerDown?: (e: React.PointerEvent, edge: SlateResizeEdge) => void
  onResizePointerMove?: (e: React.PointerEvent) => void
  onResizePointerUp?: (e: React.PointerEvent) => void
  onPin?: () => void
  onShowInPanel?: () => void
  onOpenData?: () => void
  onRemove?: () => void
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const [localMaximized, setLocalMaximized] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)
  const maximized = controlledMaximized ?? localMaximized
  const toggleMaximize = onToggleMaximize ?? (() => setLocalMaximized((v) => !v))

  useEffect(() => {
    if (!entryKey) return
    const slash = entryKey.indexOf('/')
    const kind = slash > 0 ? entryKey.slice(0, slash) : ''
    const id = slash > 0 ? entryKey.slice(slash + 1) : entryKey
    let timer: ReturnType<typeof setTimeout> | null = null
    const flash = () => {
      setJustUpdated(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setJustUpdated(false), 2600)
    }
    const offs: (() => void)[] = [
      on('page.changed', ({ id: changedId }) => {
        if (
          changedId === id ||
          changedId === `${kind}/${id}` ||
          changedId === `${kind}s/${id}` ||
          changedId.endsWith(`/${id}`)
        ) {
          flash()
        }
      })
    ]
    if (kind === 'file') {
      offs.push(
        on('asset.changed', ({ id: changedId }) => {
          if (changedId === id) flash()
        })
      )
    }
    if (kind === 'sheet') {
      offs.push(on('game.changed', flash))
    }
    return () => {
      if (timer) clearTimeout(timer)
      offs.forEach((off) => off())
    }
  }, [entryKey])

  useEscapeLayer(maximized, () => {
    if (controlledMaximized !== undefined) onToggleMaximize?.()
    else setLocalMaximized(false)
  })

  const showBody = expanded || maximized || fillCell
  const hasFixedHeight = maximized || fillCell || (expanded && typeof height === 'number')

  const sizeStyle =
    maximized || fillCell
      ? undefined
      : expanded
        ? {
            width: typeof width === 'number' ? width : 420,
            ...(typeof height === 'number' ? { height } : {})
          }
        : { width: 288 }

  const slateBody = (
    <motion.div
      layout={!onResizePointerDown && !fillCell}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={sizeStyle}
      className={cn(
        'notch-sm group/slate relative flex flex-col border border-l-2 border-l-accent bg-[#060b10]/78 backdrop-blur-md transition-all',
        justUpdated
          ? 'border-accent shadow-[0_0_28px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]'
          : 'border-line shadow-[0_14px_38px_rgba(0,0,0,0.85)] hover:border-line/90',
        maximized
          ? 'h-full w-full'
          : fillCell
            ? 'h-full w-full'
            : expanded
              ? 'max-w-[96vw]'
              : 'w-[288px]',
        className
      )}
    >
      {/* Header: single smooth compact line; click anywhere on header to expand/collapse (or restore when maximized), drag to move */}
      <div
        onPointerDown={!maximized ? onHeaderPointerDown : undefined}
        onPointerMove={!maximized ? onHeaderPointerMove : undefined}
        onPointerUp={!maximized ? onHeaderPointerUp : undefined}
        onClick={
          maximized
            ? toggleMaximize
            : !onHeaderPointerDown
              ? onToggleExpand
              : undefined
        }
        className={cn(
          'slate-drag-handle flex h-7 shrink-0 items-center gap-1.5 overflow-hidden px-2.5 whitespace-nowrap select-none',
          showBody && 'border-b border-line/40',
          (onToggleExpand || onHeaderPointerDown || fillCell || maximized) && 'cursor-pointer hover:bg-white/[0.03]'
        )}
      >
        {onToggleExpand && !maximized && !fillCell && (
          <span className="shrink-0 text-dim">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
        {thumb && !showBody && <div className="h-4 w-4 shrink-0 overflow-hidden border border-line/60">{thumb}</div>}
        <span
          title={typeof subtitle === 'string' ? subtitle : undefined}
          className="min-w-0 flex-1 truncate text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white"
        >
          {title}
        </span>
        {justUpdated && (
          <span className="flex shrink-0 items-center gap-1 border border-accent bg-accent/20 px-1.5 py-px font-mono text-[8.5px] font-bold uppercase leading-none tracking-[0.14em] text-accent animate-pulse">
            <Sparkles className="h-2.5 w-2.5" />
            UPDATED
          </span>
        )}
        <span className="shrink-0 border border-teal/35 px-1 py-px font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.12em] text-teal">
          {tag}
        </span>
        <div
          className="slate-actions ml-1 flex shrink-0 items-center gap-0.5"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className={cn(
              'items-center gap-0.5',
              showBody ? 'flex' : 'hidden group-hover/slate:flex'
            )}
          >
            {actions}
            {onPin && (
              <button
                type="button"
                onClick={onPin}
                title="Put on board"
                className="p-0.5 text-dim transition-colors hover:text-accent cursor-pointer"
              >
                <Layers className="h-3 w-3" />
              </button>
            )}
            {onShowInPanel && (
              <button
                type="button"
                onClick={onShowInPanel}
                title="Show in chat panel"
                className="p-0.5 text-dim transition-colors hover:text-white cursor-pointer"
              >
                <PanelRight className="h-3 w-3" />
              </button>
            )}
            {onOpenData && (
              <button
                type="button"
                onClick={onOpenData}
                title="Open in Data"
                className="p-0.5 text-dim transition-colors hover:text-white cursor-pointer"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </span>
          <button
            type="button"
            onClick={toggleMaximize}
            title={maximized ? 'Restore slate (Esc)' : 'Maximize slate'}
            className={cn(
              'p-0.5 transition-colors cursor-pointer',
              maximized ? 'text-accent hover:text-white' : 'text-dim hover:text-white'
            )}
          >
            {maximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Close / Remove"
              className="p-0.5 text-dim transition-colors hover:text-alert cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {showBody && (
        <InsideSlateContext.Provider value={true}>
          <div
            data-slate-body
            className={cn(
              'flex flex-col gap-2.5 overflow-y-auto px-3.5 py-3',
              hasFixedHeight ? 'min-h-0 flex-1' : 'max-h-[420px]'
            )}
          >
            {children}
          </div>
        </InsideSlateContext.Provider>
      )}

      {/* Direct resize handles for expanded slates in Tabletop mode */}
      {expanded && !maximized && !fillCell && onResizePointerDown && (
        <>
          <div
            onPointerDown={(e) => onResizePointerDown(e, 'r')}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            className="absolute top-2 right-0 bottom-3 w-1.5 cursor-ew-resize"
          />
          <div
            onPointerDown={(e) => onResizePointerDown(e, 'b')}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            className="absolute right-3 bottom-0 left-2 h-1.5 cursor-ns-resize"
          />
          <div
            title="Drag to resize slate"
            onPointerDown={(e) => onResizePointerDown(e, 'br')}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            className="group absolute right-0 bottom-0 flex h-4 w-4 cursor-nwse-resize items-end justify-end p-0.5"
          >
            <span className="h-2.5 w-2.5 border-r-2 border-b-2 border-accent/60 transition-colors group-hover:border-accent" />
          </div>
        </>
      )}
    </motion.div>
  )

  if (maximized) {
    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) toggleMaximize()
        }}
        className="pointer-events-auto fixed inset-0 z-[200] flex items-center justify-center bg-black/92 p-3 backdrop-blur-md"
      >
        {slateBody}
      </motion.div>,
      document.body
    )
  }

  return slateBody
}

export function EntrySlate({
  kind,
  id,
  part,
  mode = 'slate',
  onToggleExpand,
  onRemove,
  onOpenData
}: EntrySlateProps) {
  const [localExpanded, setLocalExpanded] = useState(mode !== 'token')
  const expanded = onToggleExpand ? mode !== 'token' : localExpanded
  const toggle = onToggleExpand ?? (() => setLocalExpanded((v) => !v))

  const link = `@${kind}:${id}${part ? `#${part}` : ''}`
  const preview = useEntryPreview(link)
  const resolvedKind = preview && !('missing' in preview) ? preview.kind : kind
  const resolvedId = preview && !('missing' in preview) ? preview.id : id
  const { Chat, Thumb } = presentOf(resolvedKind)

  const title = preview && !('missing' in preview) ? showName(preview.title) : showName(id)
  const tag = preview && !('missing' in preview) ? preview.label : kind
  const subtitle = preview && !('missing' in preview) ? preview.line : undefined
  const openData = onOpenData ?? (() => showInData({ kind: resolvedKind, id: resolvedId }))
  const inspectInChat = () => void showInPanel(`${resolvedKind}/${resolvedId}`, part || null)

  const thumbNode =
    preview && !('missing' in preview) && preview.image ? (
      <AssetMedia id={preview.image} className="h-full w-full object-cover" />
    ) : Thumb ? (
      <Thumb id={resolvedId} />
    ) : undefined

  const insideSlate = useContext(InsideSlateContext)
  const fields = preview && !('missing' in preview) ? (preview.fields ?? []) : []
  const cardBody = preview && !('missing' in preview) ? preview.card.trim() : ''
  const hasCustomChat = Boolean(Chat && Chat !== EntrySlate)

  const content =
    hasCustomChat && Chat ? (
      <Chat kind={resolvedKind} id={resolvedId} part={part} />
    ) : (
      <>
        {preview && !('missing' in preview) && preview.image && (
          <div className="max-h-64 overflow-hidden border border-line/50 bg-black/50">
            <AssetMedia id={preview.image} className="h-full w-full object-cover" />
          </div>
        )}
        {subtitle && <div className="font-mono text-[11px] text-dim">{subtitle}</div>}
        {fields.length > 0 && (
          <Facts
            rows={fields.map((f): [string, ReactNode] => [
              f.name,
              <Markdown key={f.name} text={f.text} />
            ])}
          />
        )}
        {cardBody && fields.length === 0 && (
          <div className="text-[12.5px] leading-relaxed text-white/90">
            <Markdown text={cardBody} />
          </div>
        )}
        {preview && 'missing' in preview && (
          <div className="font-mono text-[11px] text-dim">{preview.missing}</div>
        )}
        {!preview && <div className="font-mono text-[11px] text-dim">Loading…</div>}
      </>
    )

  if (insideSlate) return content

  return (
    <SlateContainer
      title={title}
      tag={tag}
      subtitle={subtitle}
      thumb={thumbNode}
      entryKey={`${resolvedKind}/${resolvedId}`}
      expanded={expanded}
      onToggleExpand={toggle}
      onPin={() => void pinToChatTable(resolvedKind, resolvedId, title)}
      onShowInPanel={inspectInChat}
      onOpenData={openData}
      onRemove={onRemove}
    >
      {content}
    </SlateContainer>
  )
}

setDefaultEntrySlate(EntrySlate)
