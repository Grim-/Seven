import { useMemo, useState } from 'react'
import type { ComponentDef } from '@shared/game/core'
import type { EffectLane } from '@shared/game/components'
import { buildLanes, flattenLanes, nodeFor, nodesAt, pathKey, renamed, type LaneNodes, type ListPath } from './tree'

export interface AddSpot {
  path: ListPath
  index: number
}

export interface EffectsEditing {
  tree: LaneNodes[]
  selected: string | null
  select: (key: string | null) => void
  adding: AddSpot | null
  setAdding: (spot: AddSpot | null) => void
  shownArms: Set<string>
  showArm: (key: string) => void
  insert: (spot: AddSpot, def: ComponentDef) => void
  update: (path: ListPath, index: number, def: ComponentDef) => void
  remove: (path: ListPath, index: number) => void
  duplicate: (path: ListPath, index: number) => void
  move: (path: ListPath, from: number, to: number) => void
}

export function useEffectsEditing(value: ComponentDef[], lanes: EffectLane[], onChange: (next: ComponentDef[]) => void): EffectsEditing {
  const tree = useMemo(() => buildLanes(value, lanes), [value, lanes])
  const [selected, select] = useState<string | null>(null)
  const [adding, setAdding] = useState<AddSpot | null>(null)
  const [shownArms, setShownArms] = useState<Set<string>>(new Set())
  const commit = (change: (t: LaneNodes[]) => void) => {
    const next = structuredClone(tree)
    change(next)
    onChange(flattenLanes(next))
  }
  return {
    tree,
    selected,
    select,
    adding,
    setAdding,
    shownArms,
    showArm: (key) => setShownArms((s) => new Set(s).add(key)),
    insert: (spot, def) => {
      commit((t) => nodesAt(t, spot.path).splice(spot.index, 0, nodeFor(def)))
      select(pathKey(spot.path, spot.index))
      setAdding(null)
    },
    update: (path, index, def) => commit((t) => (nodesAt(t, path)[index].def = def)),
    remove: (path, index) => {
      commit((t) => nodesAt(t, path).splice(index, 1))
      select(null)
    },
    duplicate: (path, index) => {
      commit((t) => {
        const list = nodesAt(t, path)
        list.splice(index + 1, 0, renamed(list[index]))
      })
      select(pathKey(path, index + 1))
    },
    move: (path, from, to) => {
      const size = nodesAt(tree, path).length
      if (to < 0 || to >= size || from === to) return
      commit((t) => {
        const list = nodesAt(t, path)
        const [node] = list.splice(from, 1)
        list.splice(to, 0, node)
      })
      select(pathKey(path, to))
    }
  }
}
