import type { ComponentType, ReactNode } from 'react'
import type { Catalog, GameEntity } from '@shared/game/core'
import type { PlaceVisitor } from '@shared/maps'

export type GameAct = (change: (entity: GameEntity) => true | string) => void

export interface ScreenProps {
  entity: GameEntity
  catalog: Catalog
  visitor: PlaceVisitor
  act: GameAct
  onClose?: () => void
  onAim?: (aim: { uid: string; label: string } | null) => void
}

export interface GameScreen {
  id: string
  label: string
  icon: ReactNode
  key: string
  order: number
  Screen: ComponentType<ScreenProps>
}

const screens = new Map<string, GameScreen>()

export function registerGameScreen(screen: GameScreen): void {
  screens.set(screen.id, screen)
}

export function gameScreens(): GameScreen[] {
  return [...screens.values()].sort((a, b) => a.order - b.order)
}

export function gameScreen(id: string): GameScreen | null {
  return screens.get(id) ?? null
}
