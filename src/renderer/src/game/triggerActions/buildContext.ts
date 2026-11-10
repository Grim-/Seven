import type { GameExecutionContext } from './context'
import type { GameSave } from '@shared/game/save'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'

interface BuildContextOptions {
  world: string
  map: string
  sheet: string
  party?: string[]
  save?: GameSave | null
  goTo?: (mapId: string, placeKey?: string) => Promise<void> | void
  onNotify?: (text: string, tone?: 'accent' | 'cyan' | 'warn' | 'danger') => void
}

export function createGameExecutionContext({
  world,
  map,
  sheet,
  party = [],
  save = null,
  goTo,
  onNotify
}: BuildContextOptions): GameExecutionContext {
  const flags = save?.flags ?? {}

  return {
    world,
    map,
    sheet,
    party: party.length ? party : [sheet],
    flags,

    engine: (method: string, payload?: unknown) => (engine as any)(method, payload),

    warp: async (mapId: string, at?: { x: number; y: number } | string) => {
      const placeKey = typeof at === 'string' ? at : ''
      if (goTo) {
        await goTo(mapId, placeKey)
      } else {
        toast.info('Warping', `Traveling to map: ${mapId}`)
      }
    },

    giveItem: async (itemId: string, count: number = 1, gold: number = 0) => {
      toast.info('Item Awarded', `Gained ${itemId ? `${count}x ${itemId}` : ''}${gold ? ` ${gold} gold` : ''}`)
    },

    removeItem: async (itemId: string, count: number = 1) => {
      toast.info('Item Consumed', `Removed ${count}x ${itemId}`)
    },

    setFlag: async (flag: string, value: unknown) => {
      if (save?.id) {
        await engine('saves.setFlag', { id: save.id, flag }).catch(() => {
          flags[flag] = value as string | number | boolean
        })
      } else {
        flags[flag] = value as string | number | boolean
      }
      toast.info('Flag Updated', `${flag} = ${String(value)}`)
    },

    modifyHealth: async (target: 'player' | 'party' | 'target', amount: number) => {
      const isHeal = amount > 0
      const verb = isHeal ? 'healed' : 'damaged'
      const label = isHeal ? `+${amount} HP` : `${amount} HP`
      toast.info(isHeal ? 'Healed' : 'Damage Taken', `${target} ${verb} for ${label}`)
    },

    spawnCreature: async (creatureId: string, _factionId?: string, _at?: { x: number; y: number }) => {
      toast.info('Spawned', `Creature "${creatureId}" entered the map`)
    },

    startCombat: async (encounterId: string) => {
      toast.info('Combat Engaged', `Battle initiated: ${encounterId}`)
    },

    playCue: async (_cueId: string, sound?: string) => {
      if (sound) {
        try {
          const audio = new Audio(sound)
          void audio.play()
        } catch {
          // ignore audio failure
        }
      }
    },

    notify: (text: string, tone: 'accent' | 'cyan' | 'warn' | 'danger' = 'accent') => {
      if (onNotify) {
        onNotify(text, tone)
      } else {
        if (tone === 'danger') toast.error('Action Alert', text)
        else toast.info('Action', text)
      }
    }
  }
}
