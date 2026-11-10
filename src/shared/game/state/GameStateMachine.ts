export type GameModeState = 'EXPLORATION' | 'INTERACTION' | 'BATTLE' | 'CUTSCENE' | 'MODAL'

export interface GameStateContext {
  mode: GameModeState
  activeEntityId: string | null
  activeTargetId: string | null
  activeModalId: string | null
  paused: boolean
}

export type GameEvent =
  | { type: 'START_INTERACTION'; targetId: string; targetName?: string }
  | { type: 'END_INTERACTION' }
  | { type: 'START_BATTLE'; encounterId?: string }
  | { type: 'END_BATTLE'; outcome: 'victory' | 'defeat' | 'flee' }
  | { type: 'START_CUTSCENE'; sceneId: string }
  | { type: 'END_CUTSCENE' }
  | { type: 'OPEN_MODAL'; modalId: string }
  | { type: 'CLOSE_MODAL' }

export function transitionGameState(
  current: GameStateContext,
  event: GameEvent
): GameStateContext {
  switch (event.type) {
    case 'START_INTERACTION':
      return {
        ...current,
        mode: 'INTERACTION',
        activeTargetId: event.targetId,
        paused: true
      }

    case 'END_INTERACTION':
      return {
        ...current,
        mode: 'EXPLORATION',
        activeTargetId: null,
        paused: false
      }

    case 'START_BATTLE':
      return {
        ...current,
        mode: 'BATTLE',
        paused: false
      }

    case 'END_BATTLE':
      return {
        ...current,
        mode: 'EXPLORATION',
        activeTargetId: null
      }

    case 'START_CUTSCENE':
      return {
        ...current,
        mode: 'CUTSCENE',
        paused: true
      }

    case 'END_CUTSCENE':
      return {
        ...current,
        mode: 'EXPLORATION',
        paused: false
      }

    case 'OPEN_MODAL':
      return {
        ...current,
        mode: 'MODAL',
        activeModalId: event.modalId,
        paused: true
      }

    case 'CLOSE_MODAL':
      return {
        ...current,
        mode: 'EXPLORATION',
        activeModalId: null,
        paused: false
      }

    default:
      return current
  }
}
