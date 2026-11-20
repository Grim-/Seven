import { usePlaces } from './places'
import { create } from 'zustand'
import type { VaultStatus } from '@shared/types'
import { isVaultLockedError, main } from '../lib/ipc'
import { useSessions } from './sessions'
import { useData } from './data'
import { useDashboards } from './dashboards'
import { useWindows } from './windows'
import { useImageHost } from './image'

interface VaultState {
  status: VaultStatus
  asking: boolean
  ask: () => void
  dismiss: () => void
  unlock: (passphrase: string) => Promise<void>
  lock: () => Promise<void>
  setup: (passphrase: string) => Promise<void>
}

export const useVault = create<VaultState>((set) => ({
  status: { configured: false, unlocked: false },
  asking: false,
  ask: () => set({ asking: true }),
  dismiss: () => set({ asking: false }),
  unlock: async (passphrase) => {
    await main('vault.unlock', { passphrase })
    set({ asking: false })
  },
  lock: async () => {
    await main('vault.lock')
  },
  setup: async (passphrase) => {
    await main('vault.setup', { passphrase })
  }
}))

export function isLocked(): boolean {
  const s = useVault.getState().status
  return s.configured && !s.unlocked
}

export function isLockedError(err: unknown): boolean {
  return isVaultLockedError(err)
}

export function clearPersonal(): void {
  useSessions.setState({ messages: {}, outputs: {}, usage: {}, summaries: {}, pendingUi: {}, instructionsChanged: {}, drafts: {} })
  useData.setState({ pages: [], assets: [], full: {}, missingAssets: {} })
  useWindows.setState({ locations: {} })
  usePlaces.setState({ places: {}, loaded: false })
  useDashboards.setState({ list: [], activeId: null })
  useImageHost.setState({ history: [] })
}
