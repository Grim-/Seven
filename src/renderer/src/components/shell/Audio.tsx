import { useEffect, useMemo, useRef } from 'react'
import { MessageSquareOff, MessageSquareText, Music, SkipForward, VolumeX } from 'lucide-react'
import type { ThemeSoundEvent } from '@shared/theme'
import { on } from '../../lib/ipc'
import { useApp } from '../../store/app'
import { assetUrl, useData } from '../../store/data'
import { useActiveTheme } from '../../store/themes'
import { cn } from '../../lib/cn'
import { useAgents } from '../../store/agents'
import { useSessions } from '../../store/sessions'
import { speak, stopSpeaking, voicesOn } from '../../lib/speech'
import { DEFAULT_AUDIO, audioPrefs as prefs, useAudio, volumeNow } from '../../store/audio'
import { usePlayer } from '../../store/player'
import { focusedConversation } from '../../lib/conversation'
import { noteFailure } from '../../store/problems'
import { failed } from '../../lib/notify'

export function playSound(assetId: string): void {
  if (!prefs().sounds) return
  const asset = useData.getState().assets.find((a) => a.id === assetId && a.kind === 'audio')
  if (!asset) return
  const audio = new Audio(assetUrl(asset))
  audio.volume = Math.min(1, volumeNow())
  void audio.play().catch(noteFailure('audio', 'Could not play the sound'))
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function setVolume(v: number): void {
  useAudio.setState({ volume: v })
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void useApp.getState().updateSettings({ audio: { ...prefs(), volume: v } }).catch(failed('Could not save the volume')), 400)
}

function fade(audio: HTMLAudioElement, to: number, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const from = audio.volume
    const start = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / ms)
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * t))
      if (t < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}

export function AudioHost() {
  const { theme, ambience } = useActiveTheme()
  const player = usePlayer((s) => s.playing)
  const music = useApp((s) => (s.settings?.audio ?? DEFAULT_AUDIO).music) && !player
  const saved = useApp((s) => (s.settings?.audio ?? DEFAULT_AUDIO).volume)
  const live = useAudio((s) => s.volume)
  const skip = useAudio((s) => s.skip)
  const assets = useData((s) => s.assets)
  const ids = ambience.music ?? theme.music
  const tracks = useMemo(() => ids.map((id) => assets.find((a) => a.id === id && a.kind === 'audio')).filter((a) => a !== undefined), [ids.join(','), assets])
  const key = tracks.map((t) => t.id).join(',')
  const target = Math.min(1, (live ?? saved) * theme.volume)
  const el = useRef<HTMLAudioElement | null>(null)
  const index = useRef(0)
  const lastSkip = useRef(skip)
  const targetRef = useRef(target)
  targetRef.current = target

  useEffect(() => {
    el.current ??= new Audio()
    const audio = el.current
    let cancelled = false
    let plays = 0
    const playAt = async (i: number) => {
      if (!tracks.length) return
      index.current = ((i % tracks.length) + tracks.length) % tracks.length
      const track = tracks[index.current]
      audio.src = assetUrl(track)
      audio.volume = 0
      useAudio.setState({ playing: track.name })
      const ticket = ++plays
      try {
        await audio.play()
      } catch (err) {
        if (ticket === plays && !cancelled) noteFailure('audio', `Could not play ${track.name}`)(err)
        return
      }
      if (!cancelled) await fade(audio, targetRef.current, 1200)
    }
    audio.onended = () => void playAt(index.current + 1)
    const run = async () => {
      if (!audio.paused) await fade(audio, 0, 800)
      if (cancelled) return
      audio.pause()
      if (!music || !tracks.length) {
        useAudio.setState({ playing: null })
        return
      }
      const skipped = skip !== lastSkip.current
      lastSkip.current = skip
      await playAt(skipped ? index.current + 1 : 0)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [key, music, skip])

  useEffect(() => {
    const audio = el.current
    if (audio && !audio.paused) audio.volume = target
  }, [target])

  useEffect(() => {
    useAudio.setState({ volume: null })
  }, [saved])

  const sounds = theme.sounds
  const soundsRef = useRef(sounds)
  soundsRef.current = sounds
  useEffect(() => {
    const play = (e: ThemeSoundEvent) => {
      const id = soundsRef.current[e]
      if (id) playSound(id)
    }
    const asked = new Set<string>()
    const offs = [
      on('turn.finish', ({ sessionId, message }) => {
        play('reply')
        const sessions = useSessions.getState()
        if (!voicesOn() || sessionId !== focusedConversation()?.sessionId) return
        const agentId = sessions.list.find((x) => x.id === sessionId)?.agentId
        const agent = useAgents.getState().list.find((a) => a.id === agentId)
        if (!agent?.readAloud) return
        const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('\n')
        if (text.trim()) void speak(text, agent.voice ?? null, message.id)
      }),
      on('reminder.fired', () => play('reminder')),
      on('message.part', ({ part }) => {
        if (part.ui?.status === 'pending' && !asked.has(part.ui.id)) {
          asked.add(part.ui.id)
          play('ask')
        }
      })
    ]
    return () => offs.forEach((off) => off())
  }, [])

  return null
}

export function SoundControl() {
  const audio = useApp((s) => s.settings?.audio ?? DEFAULT_AUDIO)
  const live = useAudio((s) => s.volume)
  const playing = useAudio((s) => s.playing)
  const volume = live ?? audio.volume
  const toggle = () => void useApp.getState().updateSettings({ audio: { ...audio, music: !audio.music } }).catch(failed('Could not change the music'))
  const voice = useApp((s) => s.settings?.voice)
  const toggleVoice = () => {
    if (!voice) return
    if (voice.on) stopSpeaking()
    void useApp.getState().updateSettings({ voice: { ...voice, on: !voice.on } }).catch(failed('Could not change the voice'))
  }
  return (
    <div className="flex items-center gap-1.5 normal-case" title={audio.music ? (playing ? `Playing ${playing}` : 'Music on, nothing playing') : 'Music off'}>
      <button onClick={toggle} className={cn('flex h-6 w-6 items-center justify-center', audio.music ? 'text-accent hover:text-white' : 'text-faint hover:text-white')}>
        {audio.music ? <Music className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      </button>
      <button onClick={toggleVoice} title={voice?.on ? 'Voices on: agents that read aloud and scenes speak' : 'Voices off'} className={cn('flex h-6 w-6 items-center justify-center', voice?.on ? 'text-accent hover:text-white' : 'text-faint hover:text-white')}>
        {voice?.on ? <MessageSquareText className="h-3.5 w-3.5" /> : <MessageSquareOff className="h-3.5 w-3.5" />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        className="h-1 w-16 cursor-pointer appearance-none bg-line accent-[var(--color-accent)]"
      />
      {audio.music && playing && (
        <button title="Next track" onClick={() => useAudio.setState((s) => ({ skip: s.skip + 1 }))} className="text-dim hover:text-white">
          <SkipForward className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
