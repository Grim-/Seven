import { useState, type MouseEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PlaceNode } from '@shared/maps'
import { cn } from '../../lib/cn'

interface Props {
  nodes: PlaceNode[]
  selected: string | null
  onSelect: (key: string) => void
  onMenu?: (e: MouseEvent, key: string) => void
  depth?: number
}

function PlaceRow({ node, selected, onSelect, onMenu, depth }: Omit<Props, 'nodes' | 'depth'> & { node: PlaceNode; depth: number }) {
  const [open, setOpen] = useState(true)
  const on = node.key === selected
  return (
    <>
      <div
        onClick={() => onSelect(node.key)}
        onContextMenu={onMenu && ((e) => onMenu(e, node.key))}
        className={cn('flex cursor-pointer items-center gap-1.5 py-1 pr-2 text-[12.5px] hover:bg-accent/[0.06]', on && 'bg-accent/10 shadow-[inset_2px_0_var(--color-accent)]')}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setOpen(!open)
          }}
          className={cn('flex h-3.5 w-3.5 shrink-0 items-center justify-center text-faint', !node.children.length && 'invisible')}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <span className="min-w-0 flex-1 truncate text-ink/90">{node.name}</span>
        {!node.shaped && <span className="shrink-0 font-label text-[9px] caps-10 text-faint">No shape</span>}
      </div>
      {open && <PlaceTree nodes={node.children} selected={selected} onSelect={onSelect} onMenu={onMenu} depth={depth + 1} />}
    </>
  )
}

export function PlaceTree({ nodes, selected, onSelect, onMenu, depth = 0 }: Props) {
  return (
    <>
      {nodes.map((n) => (
        <PlaceRow key={n.key} node={n} selected={selected} onSelect={onSelect} onMenu={onMenu} depth={depth} />
      ))}
    </>
  )
}
