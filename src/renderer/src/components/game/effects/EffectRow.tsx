import { useState } from 'react'
import { Copy, GripVertical, X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { NamedIcon, openMenu, type ReorderProps } from '../../ui'
import { useEffectsScope } from './context'
import { EffectArmView } from './EffectArmView'
import { EffectExtras } from './EffectExtras'
import { EffectSentence } from './EffectSentence'
import { pieceClass } from './pieces'
import { rowActions } from './rowActions'
import { pathKey, type EffectNode, type ListPath } from './tree'

export function EffectRow({ node, path, index, size, drag, dragging, over }: { node: EffectNode; path: ListPath; index: number; size: number; drag: ReorderProps; dragging: boolean; over: boolean }) {
  const scope = useEffectsScope()
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const Class = pieceClass(node.def.type)
  const key = pathKey(path, index)
  const own = path.concat(index)
  const selected = scope.selected === key
  const tone = Class?.GROUP?.tone ?? 'var(--color-line)'
  const actions = () => rowActions(scope, path, index, node, size)
  return (
    <div className="relative before:absolute before:-left-[13px] before:top-[21px] before:h-0.5 before:w-3 before:bg-accent/60">
      {over && <div className="absolute -top-1 left-0 right-0 h-0.5 bg-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_calc(100%*var(--glow)),transparent)]" />}
      <div
        {...drag}
        tabIndex={0}
        onClick={() => scope.select(key)}
        onContextMenu={(e) => {
          e.preventDefault()
          scope.select(key)
          openMenu(e, Class ? Class.GROUP?.label ?? 'Effect' : node.def.type, actions())
        }}
        style={{ ['--tone' as string]: tone }}
        className={cn(
          'notch-sm group relative flex items-start gap-3 outline-none border border-l-[3px] border-card-hover border-l-[var(--tone)] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--tone)_7%,var(--color-card)),var(--color-card)_60%)] py-2.5 pl-2.5 pr-2 transition-colors hover:border-ink/15 hover:border-l-[var(--tone)]',
          selected && 'border-[color-mix(in_srgb,var(--tone)_70%,transparent)] shadow-[0_0_24px_color-mix(in_srgb,var(--tone)_12%,transparent)]',
          dragging && 'opacity-35'
        )}
      >
        <NamedIcon name={Class?.ICON ?? 'Box'} className="mt-1 h-[18px] w-[18px] shrink-0 text-[var(--tone)]" />
        <div className="min-w-0 flex-1 text-[15px] leading-[30px] text-ink/90">
          <EffectSentence def={node.def} revealed={revealed} onChange={(def) => scope.update(path, index, def)} />
        </div>
        <div className={cn('flex shrink-0 items-center gap-0.5 transition-opacity', selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 touch:opacity-100')}>
          {Class && <EffectExtras Class={Class} def={node.def} revealed={revealed} reveal={(at) => setRevealed((s) => new Set(s).add(at))} onChange={(def) => scope.update(path, index, def)} />}
          <span title="Drag to move" className="grid h-[26px] w-[26px] cursor-grab place-items-center text-faint phone:hidden">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <button type="button" title="Duplicate (Ctrl D)" onClick={(e) => {
              e.stopPropagation()
              scope.duplicate(path, index)
            }} className="grid h-[26px] w-[26px] place-items-center text-faint hover:bg-ink/5 hover:text-ink">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Remove (Del)" onClick={(e) => {
              e.stopPropagation()
              scope.remove(path, index)
            }} className="grid h-[26px] w-[26px] place-items-center text-faint hover:bg-ink/5 hover:text-alert">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {node.arms.some((arm, a) => arm.branch.always || arm.nodes.length || scope.shownArms.has(`${own.join('.')}.${a}`)) && (
        <div className="ml-3.5 mt-2 grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-2.5">
          {node.arms.map((arm, a) => (arm.branch.always || arm.nodes.length || scope.shownArms.has(`${own.join('.')}.${a}`) ? <EffectArmView key={a} arm={arm} path={own.concat(a)} /> : null))}
        </div>
      )}
    </div>
  )
}
