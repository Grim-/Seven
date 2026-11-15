import { componentClass, componentFits, type ComponentClass, type ComponentDef, type ParamSpec } from '@shared/game/core'
import type { EffectBranch, EffectLane } from '@shared/game/components'
import type { EffectGroup } from '@shared/game/effectGroups'

export interface PieceClass extends ComponentClass {
  readonly SENTENCE: string
  readonly GROUP: EffectGroup | null
  readonly ICON: string
  readonly BRANCHES: EffectBranch[]
  readonly AIMS: boolean
}

export interface PieceChoice {
  Class: PieceClass
  fits: true | string
}

const asPiece = (Class: ComponentClass | null): PieceClass | null => {
  const sentence = (Class as Partial<PieceClass> | null)?.SENTENCE
  return Class && typeof sentence === 'string' && sentence ? (Class as PieceClass) : null
}

export const pieceClass = (type: string): PieceClass | null => asPiece(componentClass(type))

export const branchesOf = (def: ComponentDef): EffectBranch[] => pieceClass(def.type)?.BRANCHES ?? []

export const hostTries = (host: string): boolean => (componentClass(host) as { TRIES?: boolean } | null)?.TRIES === true

export function hostLanes(host: string): EffectLane[] | null {
  const lanes = (componentClass(host) as { LANES?: EffectLane[] } | null)?.LANES
  return lanes?.length ? lanes : null
}

export function pieceChoices(host: string): PieceChoice[] {
  return componentFits(host).flatMap((f) => {
    const Class = asPiece(f.Class)
    return Class ? [{ Class, fits: f.fits }] : []
  })
}

export function groupsOf(choices: PieceChoice[]): EffectGroup[] {
  const seen = new Map<string, EffectGroup>()
  for (const c of choices) if (c.Class.GROUP) seen.set(c.Class.GROUP.id, c.Class.GROUP)
  return [...seen.values()].sort((a, b) => a.order - b.order)
}

export const toneOf = (def: ComponentDef): string => pieceClass(def.type)?.GROUP?.tone ?? 'var(--color-line)'

export function newPiece(type: string): ComponentDef {
  const Class = componentClass(type)
  const params = Object.fromEntries(Object.entries(Class?.PARAMS ?? {}).map(([k, spec]: [string, ParamSpec]) => [k, structuredClone(spec.default)]))
  return { type, ...params, comps: [] }
}

export function hiddenKeys(Class: PieceClass): Set<string> {
  return new Set(['on', 'emit', ...Class.BRANCHES.map((b) => b.param), ...(Class.AIMS ? [] : ['who'])])
}
