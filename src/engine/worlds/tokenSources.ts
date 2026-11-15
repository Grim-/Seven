import type { GameSave } from '@shared/game/save'
import type { Standing, TokenVisitor } from '@shared/maps'

import { contribute } from '../modules/contributions'

export interface TokenSource {
  id: string
  module: string
  label: string
  owns(token: string, save: GameSave | null): boolean
  resolve(tokens: string[], save: GameSave | null, world: string): TokenVisitor[]
  placed?(token: string, save: GameSave): GameSave
  removed?(token: string, save: GameSave): GameSave
}

const sources: TokenSource[] = []

export function registerTokenSource(source: TokenSource): void {
  const at = sources.findIndex((s) => s.id === source.id)
  if (at >= 0) sources[at] = source
  else sources.push(source)
  contribute(source.module, 'Map tokens', source.label)
}

export function tokenOwner(token: string, save: GameSave | null): TokenSource | null {
  return sources.find((s) => s.owns(token, save)) ?? null
}

export function resolveTokens(tokens: string[], save: GameSave | null, world: string): TokenVisitor[] {
  const groups = new Map<TokenSource, string[]>()
  for (const token of tokens) {
    const owner = tokenOwner(token, save)
    if (owner) groups.set(owner, [...(groups.get(owner) ?? []), token])
  }
  const found = new Map([...groups].flatMap(([source, list]) => source.resolve(list, save, world)).map((v) => [v.token, v]))
  return tokens.map((token) => found.get(token) ?? missingToken(token))
}

function missingToken(token: string): TokenVisitor {
  return { token, source: '', sheet: '', name: 'Missing token', image: null, line: `Nothing owns "${token}" any more`, dnd: null, hp: null, agent: null }
}

const standing = (save: GameSave): Set<string> => new Set(Object.values(save.stand).flatMap((list) => Object.keys(list)))

export function restand(save: GameSave, map: string, stand: Record<string, Standing>): GameSave {
  const leaving = Object.keys(save.stand[map] ?? {}).filter((t) => !(t in stand))
  const arriving = Object.keys(stand)
  const owners = new Map([...leaving, ...arriving].map((t) => [t, tokenOwner(t, save)]))
  let next: GameSave = { ...save, stand: { ...save.stand, [map]: stand } }
  const still = standing(next)
  for (const token of leaving) if (!still.has(token)) next = owners.get(token)?.removed?.(token, next) ?? next
  for (const token of arriving) next = owners.get(token)?.placed?.(token, next) ?? next
  return next
}
