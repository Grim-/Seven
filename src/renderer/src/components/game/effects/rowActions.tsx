import { ArrowDown, ArrowUp, Copy, CornerDownRight, Plus, Trash2 } from 'lucide-react'
import type { MenuItem } from '../../ui'
import type { EffectsScope } from './context'
import type { EffectNode, ListPath } from './tree'

export function rowActions(scope: EffectsScope, path: ListPath, index: number, node: EffectNode, size: number): MenuItem[] {
  const own = path.concat(index)
  const hiddenArms = node.arms.flatMap((arm, a) => (!arm.branch.always && !arm.nodes.length && !scope.shownArms.has(`${own.join('.')}.${a}`) ? [{ arm, a }] : []))
  return [
    { label: 'Add effect after', hint: 'A', icon: <Plus className="h-3.5 w-3.5" />, onSelect: () => scope.setAdding({ path, index: index + 1 }) },
    ...hiddenArms.map(({ arm, a }) => ({ label: `Add effects "${arm.branch.label.toLowerCase()}"`, icon: <CornerDownRight className="h-3.5 w-3.5" />, onSelect: () => {
      scope.showArm(`${own.join('.')}.${a}`)
      scope.setAdding({ path: own.concat(a), index: 0 })
    } })),
    { label: 'Duplicate', hint: 'Ctrl D', icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => scope.duplicate(path, index) },
    { label: 'Move up', hint: 'Alt ↑', icon: <ArrowUp className="h-3.5 w-3.5" />, disabled: index === 0, onSelect: () => scope.move(path, index, index - 1) },
    { label: 'Move down', hint: 'Alt ↓', icon: <ArrowDown className="h-3.5 w-3.5" />, disabled: index === size - 1, onSelect: () => scope.move(path, index, index + 1) },
    { label: '', separator: true },
    { label: 'Remove', hint: 'Del', icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onSelect: () => scope.remove(path, index) }
  ]
}
