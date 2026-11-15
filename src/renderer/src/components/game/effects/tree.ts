import type { ComponentDef } from '@shared/game/core'
import { laneTree, type EffectNode, type LaneNodes } from '@shared/game/effectWords'
import { branchesOf } from './pieces'

export type { EffectArm, EffectNode, LaneNodes } from '@shared/game/effectWords'

export type ListPath = number[]

export const buildLanes = laneTree

const freshEvent = (param: string): string => `${param}_${Math.random().toString(36).slice(2, 8)}`

export function flattenLanes(lanes: LaneNodes[]): ComponentDef[] {
  const out: ComponentDef[] = []
  const walk = (nodes: EffectNode[], event: string) => {
    for (const n of nodes) {
      const def: ComponentDef = { ...n.def, on: event }
      out.push(def)
      for (const arm of n.arms) {
        if (!arm.nodes.length) continue
        const named = typeof def[arm.branch.param] === 'string' ? String(def[arm.branch.param]) : ''
        const next = named || freshEvent(arm.branch.param)
        def[arm.branch.param] = next
        walk(arm.nodes, next)
      }
    }
  }
  for (const l of lanes) walk(l.nodes, l.lane.event)
  return out
}

export function nodesAt(lanes: LaneNodes[], path: ListPath): EffectNode[] {
  let list = lanes[path[0]]?.nodes ?? []
  for (let i = 1; i + 1 < path.length; i += 2) list = list[path[i]]?.arms[path[i + 1]]?.nodes ?? []
  return list
}

export const pathKey = (path: ListPath, index: number): string => `${path.join('.')}:${index}`

export function parseKey(key: string): { path: ListPath; index: number } {
  const [p, i] = key.split(':')
  return { path: p.split('.').map(Number), index: Number(i) }
}

export function nodeFor(def: ComponentDef): EffectNode {
  return { def, arms: branchesOf(def).map((branch) => ({ branch, nodes: [] })) }
}

export function renamed(node: EffectNode): EffectNode {
  const def = { ...node.def }
  for (const arm of node.arms) if (arm.nodes.length) def[arm.branch.param] = ''
  return { def, arms: node.arms.map((a) => ({ branch: a.branch, nodes: a.nodes.map(renamed) })) }
}
