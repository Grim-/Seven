import type { PlayerCommand, PlayerState } from '@shared/types'

let state: PlayerState = { playing: false, index: 0, queue: [] }
let send: (command: PlayerCommand) => void = () => undefined

export const player = {
  setSender(fn: (command: PlayerCommand) => void): void {
    send = fn
  },
  command(command: PlayerCommand): void {
    send(command)
  },
  report(next: PlayerState): boolean {
    state = next
    return true
  },
  state(): PlayerState {
    return state
  }
}
