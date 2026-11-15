import type { ComponentType } from 'react'
import { moduleList } from '@shared/moduleList'
import type { KindVariation } from '../../registries/kinds'
import type { PlayWhere } from '../play/playStore'
import type { Card } from './model'

export interface CardVariation extends KindVariation {
  playable: (card: Card) => boolean
  play: (card: Card, where: PlayWhere) => void
  target?: (card: Card) => boolean
  Face?: ComponentType<{ card: Card }>
  blocked?: (card: Card, where: Pick<PlayWhere, 'sheet' | 'world'>) => Promise<string | null>
}

export const cardVariations = moduleList<CardVariation>()
