import { create } from 'zustand'
import { forgetStored, readStored, writeStored } from '../../../lib/stored'

export interface KeybindDef {
  id: string
  label: string
  category: 'Movement' | 'Panels' | 'Combat' | 'Hotbar' | 'System'
  code: string
  display: string
}

export interface GameplaySettings {
  // Controls
  mouseMoveButton: 'right' | 'left'
  shiftForceMove: boolean
  interactionReachFt: number
  cameraFollow: boolean
  
  // Display
  ambientOpacity: number
  bubbleWideDefault: boolean
  showCombatQueue: boolean
  
  // Rules & Agent
  autoPauseOnDialogue: boolean
  autoPauseOnCombat: boolean
  characterSheetGrounding: boolean

  // Keybinds
  keybinds: Record<string, { code: string; display: string }>
}

const DEFAULT_KEYBINDS: Record<string, { code: string; display: string }> = {
  sheet: { code: 'KeyC', display: 'C' },
  inventory: { code: 'KeyI', display: 'I' },
  spells: { code: 'KeyK', display: 'K' },
  endTurn: { code: 'Space', display: 'Space' },
  pause: { code: 'KeyP', display: 'P' },
  cancel: { code: 'Escape', display: 'Esc' },
  slot1: { code: 'Digit1', display: '1' },
  slot2: { code: 'Digit2', display: '2' },
  slot3: { code: 'Digit3', display: '3' },
  slot4: { code: 'Digit4', display: '4' },
  slot5: { code: 'Digit5', display: '5' },
  slot6: { code: 'Digit6', display: '6' },
  slot7: { code: 'Digit7', display: '7' },
  slot8: { code: 'Digit8', display: '8' },
  slot9: { code: 'Digit9', display: '9' }
}

const DEFAULT_SETTINGS: GameplaySettings = {
  mouseMoveButton: 'right',
  shiftForceMove: true,
  interactionReachFt: 5,
  cameraFollow: true,
  ambientOpacity: 35,
  bubbleWideDefault: false,
  showCombatQueue: true,
  autoPauseOnDialogue: true,
  autoPauseOnCombat: true,
  characterSheetGrounding: true,
  keybinds: DEFAULT_KEYBINDS
}

const STORAGE_KEY = 'seven.gameplaySettings'

function loadPersistedSettings(): GameplaySettings {
  const parsed = readStored<Partial<GameplaySettings> | null>(STORAGE_KEY, null)
  if (!parsed) return DEFAULT_SETTINGS
  return {
    ...DEFAULT_SETTINGS,
    ...parsed,
    keybinds: { ...DEFAULT_KEYBINDS, ...(parsed.keybinds ?? {}) }
  }
}

interface GameplaySettingsStore {
  settings: GameplaySettings
  update: (patch: Partial<GameplaySettings>) => void
  rebindKey: (actionId: string, code: string, display: string) => void
  resetDefaults: () => void
}

export const useGameplaySettings = create<GameplaySettingsStore>((set) => ({
  settings: loadPersistedSettings(),
  update: (patch) =>
    set((state) => {
      const next = { ...state.settings, ...patch }
      writeStored(STORAGE_KEY, next)
      return { settings: next }
    }),
  rebindKey: (actionId, code, display) =>
    set((state) => {
      const nextKeybinds = {
        ...state.settings.keybinds,
        [actionId]: { code, display }
      }
      const next = { ...state.settings, keybinds: nextKeybinds }
      writeStored(STORAGE_KEY, next)
      return { settings: next }
    }),
  resetDefaults: () =>
    set(() => {
      forgetStored(STORAGE_KEY)
      return { settings: DEFAULT_SETTINGS }
    })
}))
