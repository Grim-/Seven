import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { FloatLayer, useReorder } from '../../ui'
import { useEffectsScope } from './context'
import { EffectPalette } from './EffectPalette'
import { EffectRow } from './EffectRow'
import { newPiece } from './pieces'
import type { EffectNode, ListPath } from './tree'

const samePath = (a: ListPath, b: ListPath): boolean => a.length === b.length && a.every((n, i) => n === b[i])

export function EffectSteps({ nodes, path, compact = false }: { nodes: EffectNode[]; path: ListPath; compact?: boolean }) {
  const scope = useEffectsScope()
  const reorder = useReorder((from, to) => scope.move(path, from, to))
  const addingAt = scope.adding && samePath(scope.adding.path, path) ? scope.adding.index : null
  const anchor = useRef<HTMLSpanElement>(null)
  const palette = (
    <>
      <span ref={anchor} className="block h-0.5 bg-accent shadow-[0_0_8px_var(--color-accent)]" />
      <FloatLayer anchor={anchor} onClose={() => scope.setAdding(null)} align="start" className="notch-sm w-[min(40rem,94vw)] border-accent/60 bg-[#0b0c10]">
        <EffectPalette choices={scope.choices} onClose={() => scope.setAdding(null)} onPick={(type) => addingAt !== null && scope.insert({ path, index: addingAt }, newPiece(type))} />
      </FloatLayer>
    </>
  )
  return (
    <div className="flex flex-col">
      {nodes.length > 0 && (
        <div className={cn('relative flex flex-col gap-2 before:absolute before:bottom-4 before:top-0 before:w-0.5 before:bg-gradient-to-b before:from-accent/60 before:to-accent/10', compact ? 'pl-4 before:left-[5px]' : 'pl-[22px] before:left-[9px]')}>
          {nodes.map((node, i) => (
            <div key={i} className="group/gap flex flex-col gap-2">
              {addingAt === i && palette}
              {i > 0 && addingAt !== i && (
                <button type="button" title="Add here" onClick={() => scope.setAdding({ path, index: i })} className="absolute -mt-[13px] -ml-[22px] grid h-4 w-5 place-items-center bg-bg text-accent opacity-0 hover:opacity-100 focus:opacity-100">
                  <Plus className="h-3 w-3" />
                </button>
              )}
              <EffectRow node={node} path={path} index={i} size={nodes.length} drag={reorder.props(i)} dragging={reorder.dragging === i} over={reorder.isOver(i)} />
            </div>
          ))}
        </div>
      )}
      {!nodes.length && addingAt === null && <span className="px-1 py-1 text-[12.5px] text-faint">Nothing happens.</span>}
      {addingAt !== null && addingAt >= nodes.length && palette}
      {addingAt === null && (
        <button type="button" onClick={() => scope.setAdding({ path, index: nodes.length })} className="mt-1.5 inline-flex items-center gap-2 self-start border border-dashed border-[#2f3340] px-2.5 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-dim hover:border-accent hover:text-accent">
          <Plus className="h-3 w-3" />
          {compact ? 'Add' : 'Add effect'}
        </button>
      )}
    </div>
  )
}
