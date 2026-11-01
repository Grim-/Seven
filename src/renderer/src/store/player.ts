import { create } from 'zustand'
import type { PlayerCommand, PlayerTrack } from '@shared/types'
import { engine } from '../lib/ipc'
import { assetUrl, useData } from './data'
import { audioPrefs, useAudio, volumeNow } from './audio'
import { useApp } from './app'

interface PlayerStore {
  queue: PlayerTrack[]
  index: number
  playing: boolean
  position: number
  duration: number
}

export const usePlayer = create<PlayerStore>(() => ({ queue: [], index: 0, playing: false, position: 0, duration: 0 }))

const audio = new Audio()

function report(): void {
  const { queue, index, playing } = usePlayer.getState()
  void engine('player.report', { queue, index, playing }).catch(() => undefined)
}

function tracks(ids: string[]): PlayerTrack[] {
  const assets = useData.getState().assets
  return ids.flatMap((id) => {
    const a = assets.find((x) => x.id === id && x.kind === 'audio')
    return a ? [{ id: a.id, name: a.name.replace(/\.[a-z0-9]+$/i, '') }] : []
  })
}

function load(index: number, start: boolean): void {
  const { queue } = usePlayer.getState()
  const track = queue[index]
  const asset = track && useData.getState().assets.find((a) => a.id === track.id)
  if (!track || !asset) {
    stop()
    return
  }
  audio.src = assetUrl(asset)
  audio.volume = Math.min(1, volumeNow())
  usePlayer.setState({ index, position: 0, duration: 0, playing: start })
  if (start) void audio.play().catch(() => usePlayer.setState({ playing: false }))
  report()
}

export function playNow(ids: string[]): void {
  const list = tracks(ids)
  if (!list.length) return
  usePlayer.setState({ queue: list, index: 0 })
  load(0, true)
}

export function addToQueue(ids: string[], start = true): void {
  const list = tracks(ids)
  if (!list.length) return
  const { queue } = usePlayer.getState()
  usePlayer.setState({ queue: [...queue, ...list] })
  if (!queue.length) load(0, start)
  else report()
}

export function jump(index: number): void {
  load(index, true)
}

export function pause(): void {
  audio.pause()
  usePlayer.setState({ playing: false })
  report()
}

export function resume(): void {
  if (!usePlayer.getState().queue.length) return
  if (!audio.src) return load(usePlayer.getState().index, true)
  void audio.play().then(() => usePlayer.setState({ playing: true }), () => undefined)
  report()
}

export function next(): void {
  const { index, queue } = usePlayer.getState()
  if (index + 1 < queue.length) load(index + 1, true)
  else stop()
}

export function previous(): void {
  const { index } = usePlayer.getState()
  if (audio.currentTime > 3 || index === 0) {
    audio.currentTime = 0
    return
  }
  load(index - 1, true)
}

export function stop(): void {
  audio.pause()
  audio.removeAttribute('src')
  usePlayer.setState({ queue: [], index: 0, playing: false, position: 0, duration: 0 })
  report()
}

export function seek(seconds: number): void {
  audio.currentTime = seconds
}

export function runPlayerCommand(command: PlayerCommand): void {
  const start = audioPrefs().music
  if (command.action === 'play') {
    if (start) playNow(command.assetIds)
    else {
      stop()
      addToQueue(command.assetIds, false)
    }
  } else if (command.action === 'queue') addToQueue(command.assetIds, start)
  else if (command.action === 'pause') pause()
  else if (command.action === 'resume') {
    if (start) resume()
  } else if (command.action === 'next') next()
  else if (command.action === 'previous') previous()
  else if (command.action === 'stop') stop()
}

audio.addEventListener('ended', next)
audio.addEventListener('timeupdate', () => usePlayer.setState({ position: audio.currentTime }))
audio.addEventListener('loadedmetadata', () => usePlayer.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 }))
audio.addEventListener('pause', () => usePlayer.getState().playing && !audio.ended && usePlayer.setState({ playing: false }))
audio.addEventListener('play', () => usePlayer.setState({ playing: true }))

const applyVolume = () => {
  audio.volume = Math.min(1, volumeNow())
}
useAudio.subscribe(applyVolume)
useApp.subscribe(applyVolume)
