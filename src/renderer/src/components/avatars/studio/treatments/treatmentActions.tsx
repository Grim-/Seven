import { ArrowDown, ArrowUp, CopyPlus, Eraser, Trash2 } from 'lucide-react'
import type { TreatmentEntry } from '@shared/avatars'
import type { MenuItem } from '../../../ui'
import type { TreatmentStackState } from './useTreatmentStack'

export function treatmentActions(stack: TreatmentStackState, entry: TreatmentEntry): MenuItem[] {
  const at = stack.entries.findIndex((e) => e.key === entry.key)
  return [
    { label: 'Duplicate', icon: <CopyPlus />, onSelect: () => stack.duplicate(entry.key) },
    { label: 'Move up', icon: <ArrowUp />, disabled: at === 0, onSelect: () => stack.move(entry.key, -1) },
    { label: 'Move down', icon: <ArrowDown />, disabled: at === stack.entries.length - 1, onSelect: () => stack.move(entry.key, 1) },
    ...(stack.posed ? [{ label: "Clear this pose's changes", icon: <Eraser />, disabled: !stack.overridden(entry), onSelect: () => stack.clearPose(entry.key) }] : []),
    { label: '', separator: true },
    { label: 'Remove', icon: <Trash2 />, hint: 'Del', danger: true, onSelect: () => stack.remove(entry.key) }
  ]
}
