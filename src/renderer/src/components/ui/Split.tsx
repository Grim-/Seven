import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { PanelLeft } from 'lucide-react'
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
        className={cn('h-full', className)}
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
    <Panel id={id} minSize={240} className={cn('flex h-full min-w-0 flex-col', className)}>
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
      className="group/gutter relative w-3 shrink-0 outline-none"
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
  children
}: {
  id: string
  open: boolean
  width: number
  min: number
  max: number
  reset: number
  onWidth: (width: number) => void
  children: ReactNode
}) {
  if (!open) return null
  return (
    <>
      <SidePane id={id} width={width} min={min} max={max} reset={reset} onWidth={onWidth}>
        {children}
      </SidePane>
      <Gutter resets={id} />
    </>
  )
}

export function ListToggle({
  open,
  onToggle,
  what
}: {
  open: boolean
  onToggle: () => void
  what: string
}) {
  return (
    <button
      title={open ? `Hide ${what}` : `Show ${what}`}
      onClick={onToggle}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center border',
        open ? 'border-line/60 text-dim hover:text-white' : 'border-accent/70 text-accent'
      )}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  )
}
