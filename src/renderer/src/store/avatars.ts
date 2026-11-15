import { create } from 'zustand'
import { builtinAvatars, type Avatar } from '@shared/avatars'
import { engine } from '../lib/ipc'

interface AvatarsState {
  list: Avatar[]
  refresh: () => Promise<void>
}

export const useAvatars = create<AvatarsState>((set) => ({
  list: builtinAvatars(),
  refresh: async () => {
    set({ list: await engine('avatars.list') })
  }
}))
