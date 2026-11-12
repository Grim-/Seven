import type { Standing, WorldMapUse } from '@shared/maps'
import type { Point } from '@shared/shapes'
import type { WorldEntity } from '@shared/world'
import type { MenuEvent, MenuItem } from '../components/ui'
import type { MapToken } from '../components/maps/TokenLayer'
import type { PlayHolder } from '../components/play/playHolder'

export interface TokenContext {
  token: MapToken
  tokens: MapToken[]
  world: string
  use: WorldMapUse
  places: Record<string, WorldEntity>
  player: string | null
  editing: boolean
  standing: Standing
  holder: PlayHolder
  setStanding: (token: string, next: Standing | null) => void
  approach: (cb: () => void) => void
  openMenu: (e: MenuEvent) => void
  onSelect?: (sheet: string) => void
}

export interface TokenSourceUi {
  items(ctx: TokenContext): MenuItem[]
  pick?(ctx: TokenContext, e: MenuEvent): void
  moved?(ctx: TokenContext, at: Point): void
}

const uis = new Map<string, TokenSourceUi>()

export function registerTokenSourceUi(source: string, ui: TokenSourceUi): void {
  uis.set(source, ui)
}

export function tokenSourceUi(source: string): TokenSourceUi | null {
  return uis.get(source) ?? null
}
