import type { ComponentType, ReactNode } from 'react'
import type { Catalog } from '@shared/game/core'
import type { MapToken } from '../../maps/TokenLayer'
import type { View } from '../../../game/engine/Camera'
import type { ClockView } from '../../../game/explore/WorldClock'
import type { ClockControls, StageNavigation } from '../../worlds/PlayStage'

export interface PlayAim {
  uid: string
  label: string
}

export interface PlayHud {
  world: string
  saveId: string | null
  mapId: string
  embedded?: boolean
  tokens: MapToken[]
  camera: View | null
  player: string | null
  partyIds: string[]
  who: string | null
  setWho: (id: string | null) => void
  pickWho: (sheet: string) => void
  target: MapToken | null
  actor: MapToken | null
  catalog: Catalog | null
  screen: string | null
  setScreen: (screen: string | null) => void
  screenSheet: string | null
  nav: StageNavigation | null
  time: ClockView | null
  clock: ClockControls | null
  aim: PlayAim | null
  setAim: (aim: PlayAim | null) => void
  roundSeconds: number
  placeKey: string | null
  placeName: string | null
  placeCard: ReactNode
  cardHand: ReactNode
}

export interface PlayScene {
  readonly Screen: ComponentType<{ hud: PlayHud }>
  talk(target: MapToken): void
  act(target: MapToken, hud: PlayHud): void
  walked(hud: PlayHud, sheet: string, feet: number): void
  startBattle?(): PlayScene
  endBattle?(): PlayScene
}
