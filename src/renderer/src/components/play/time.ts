import type { MapToken } from '../maps/TokenLayer'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'

const inPlay = (tokens: MapToken[]): string[] => tokens.filter((t) => t.visitor.game).map((t) => t.visitor.sheet)

export function passTime(saveId: string, tokens: MapToken[], seconds: number, source: string): void {
  if (!(seconds > 0)) return
  void engine('saves.advance', { id: saveId, seconds, source, sheets: inPlay(tokens) }).catch(failed('Could not move time on'))
}

export function restShort(saveId: string, tokens: MapToken[], hitDice: Record<string, number>): void {
  void engine('saves.shortRest', { id: saveId, sheets: inPlay(tokens), hitDice }).catch(failed('Could not take a short rest'))
}

export function restLong(saveId: string, tokens: MapToken[]): void {
  void engine('saves.longRest', { id: saveId, sheets: inPlay(tokens) }).catch(failed('Could not take a long rest'))
}
