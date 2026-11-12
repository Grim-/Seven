import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import { cn } from '../../lib/cn'

interface Pane {
  commit: () => void
  reset: () => void
}

const Panes = createContext<Map<string, Pane> | null>(null)

export function Split({ className, children }: { className?: string; children: ReactNode }) {
  const panes = useRef(new Map<string, Pane>()).current
  return (
    <Panes.Provider value={panes}>
      <Group
        className={cn('h-full phone:relative', className)}
        onLayoutChanged={(_layout, meta) => {
          if (meta.isUserInteraction) for (const pane of panes.values()) pane.commit()
        }}
      >
        {children}
      </Group>
    </Panes.Provider>
  )
}

export function MainPane({
  id,
  className,
  children
}: {
  id: string
  className?: string
  children: ReactNode
}) {
  return (
    <Panel id={id} minSize={240} className={cn('flex h-full min-w-0 flex-col phone:flex-[1_1_100%]!', className)}>
      {children}
    </Panel>
  )
}

export function SidePane({
  id,
  width,
  min,
  max,
  reset,
  onWidth,
  className,
  children
}: {
  id: string
  width: number
  min: number
  max: number
  reset: number
  onWidth: (width: number) => void
  className?: string
  children: ReactNode
}) {
  const panes = useContext(Panes)
  const ref = usePanelRef()
  const latest = useRef({ width, reset, onWidth })
  latest.current = { width, reset, onWidth }
  useEffect(() => {
    if (!panes) return
    panes.set(id, {
      commit: () => {
        const size = ref.current?.getSize().inPixels
        if (size === undefined) return
        const w = Math.round(size)
        if (w !== latest.current.width) latest.current.onWidth(w)
      },
      reset: () => {
        ref.current?.resize(`${latest.current.reset}px`)
        if (latest.current.width !== latest.current.reset)
          latest.current.onWidth(latest.current.reset)
      }
    })
    return () => {
      panes.delete(id)
    }
  }, [panes, id, ref])
  return (
    <Panel
      id={id}
      panelRef={ref}
      defaultSize={`${width}px`}
      minSize={`${min}px`}
      maxSize={`${max}px`}
      groupResizeBehavior="preserve-pixel-size"
      className={cn('flex h-full min-w-0 flex-col', className)}
    >
      {children}
    </Panel>
  )
}

export function Gutter({ resets }: { resets?: string }) {
  const panes = useContext(Panes)
  return (
    <Separator
      disableDoubleClick
      onDoubleClick={() => (resets ? panes?.get(resets)?.reset() : undefined)}
      title={resets ? 'Drag to resize. Double-click to reset.' : 'Drag to resize'}
      className="group/gutter relative w-3 tablet:w-4 shrink-0 outline-none phone:hidden"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/gutter:bg-accent/50 group-data-[separator=hover]/gutter:bg-accent/50 group-data-[separator=active]/gutter:bg-accent group-data-[separator=focus]/gutter:bg-accent" />
    </Separator>
  )
}

export function ListPane({
  id,
  open,
  width,
  min,
  max,
  reset,
  onWidth,
  onClose,
  children
}: {
  id: string
  open: boolean
  width: number
  min: number
  max: number
  reset: number
  onWidth: (width: number) => void
  onClose?: () => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <>
      {onClose && (
        <div
          aria-hidden
          onClick={onClose}
          className="hidden phone:block absolute inset-0 z-20 bg-black/60 backdrop-blur-[1px]"
        />
      )}
      <SidePane
        id={id}
        width={width}
        min={min}
        max={max}
        reset={reset}
        onWidth={onWidth}
        className="phone:absolute phone:inset-y-0 phone:left-0 phone:z-30 phone:w-[min(22rem,85%)]! phone:max-w-[85%]! phone:bg-bg phone:shadow-[8px_0_24px_rgba(0,0,0,0.7)]"
      >
        <div className="flex h-full min-h-0 w-full">
          <div className="h-full min-w-0 flex-1">{children}</div>
          {onClose && <ListToggle open onToggle={onClose} what="the list" className="hidden phone:block phone:w-5" />}
        </div>
      </SidePane>
      <Gutter resets={id} />
    </>
  )
}

export function ListToggle({
  open,
  onToggle,
  what = 'the list',
  className
}: {
  open: boolean
  onToggle: () => void
  what?: string
  className?: string
}) {
  return (
    <button
      type="button"
      title={open ? `Hide ${what}` : `Show ${what}`}
      onClick={onToggle}
      className={cn(
        'bracket-left group relative w-3.5 touch:w-5 shrink-0 self-stretch min-h-[48px] cursor-pointer select-none border-y border-r transition-all outline-none',
        open
          ? 'border-accent/80 bg-accent/15 text-accent shadow-[0_0_10px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]'
          : 'border-line bg-black/60 text-dim hover:border-accent hover:bg-accent/10',
        className
      )}
    >
      <span
        className={cn(
          'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1.5px] h-5 transition-all',
          open ? 'bg-accent shadow-[0_0_8px_var(--color-accent)]' : 'bg-dim/70 group-hover:bg-accent'
        )}
      />
    </button>
  )
}
