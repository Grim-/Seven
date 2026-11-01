import { create } from 'zustand'
import type { AudioPrefs } from '@shared/types'
import { useApp } from './app'

export const DEFAULT_AUDIO: AudioPrefs = { music: true, sounds: true, volume: 0.6 }

interface AudioState {
  volume: number | null
  playing: string | null
  skip: number
}

export const useAudio = create<AudioState>(() => ({ volume: null, playing: null, skip: 0 }))

export function audioPrefs(): AudioPrefs {
  return useApp.getState().settings?.audio ?? DEFAULT_AUDIO
}

export function volumeNow(): number {
  return useAudio.getState().volume ?? audioPrefs().volume
}
