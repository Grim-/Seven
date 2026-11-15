import { noteFailure } from '../store/problems'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import type { VoiceRef } from '@shared/types'
import { engine } from './ipc'
import { plainText } from '@shared/text'

export { plainText }
import { useApp } from '../store/app'
import { volumeNow } from '../store/audio'
import { toast } from '../store/toasts'
import { errorText } from './format'

interface SpeechState {
  speaking: string | null
}

export const useSpeech = create<SpeechState>(() => ({ speaking: null }))

let token = 0
let stopCurrent: (() => void) | null = null

export function voicesOn(): boolean {
  return useApp.getState().settings?.voice.on ?? true
}

function chunks(text: string, size: number): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]+["”')\]]*\s*|[^.!?…]+$/g) ?? [text]
  const out: string[] = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + s).length > size && cur) {
      out.push(cur.trim())
      cur = ''
    }
    cur += s
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

export function systemVoiceList(): SpeechSynthesisVoice[] {
  return typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices()
}

export function useSystemVoices(): SpeechSynthesisVoice[] {
  const [list, setList] = useState(systemVoiceList)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const update = () => setList(speechSynthesis.getVoices())
    update()
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return list
}

export function usePiperVoices(): { name: string; file: string }[] {
  const folder = useApp((s) => s.settings?.voice.piperVoices ?? '')
  const [list, setList] = useState<{ name: string; file: string }[]>([])
  useEffect(() => {
    if (!folder) return setList([])
    void engine('tts.piperVoices', { folder })
      .then(setList)
      .catch((err: unknown) => (setList([]), noteFailure('voice', 'Could not list the Piper voices')(err)))
  }, [folder])
  return list
}

export function stopSpeaking(): void {
  token++
  stopCurrent?.()
  stopCurrent = null
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  useSpeech.setState({ speaking: null })
}

function speakSystem(text: string, voice: VoiceRef | null, mine: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') return resolve()
    const wanted = voice?.id.startsWith('system:') ? voice.id.slice(7) : null
    const found = wanted ? systemVoiceList().find((v) => v.voiceURI === wanted || v.name === wanted) : undefined
    const parts = chunks(text, 220)
    let i = 0
    const next = () => {
      if (mine !== token || i >= parts.length) return resolve()
      const u = new SpeechSynthesisUtterance(parts[i++])
      if (found) u.voice = found
      u.rate = voice?.rate ?? 1
      u.pitch = voice?.pitch ?? 1
      u.volume = Math.min(1, volumeNow())
      u.onend = next
      u.onerror = () => resolve()
      speechSynthesis.speak(u)
    }
    stopCurrent = () => resolve()
    next()
  })
}

async function speakPiper(text: string, voice: VoiceRef, mine: number): Promise<void> {
  const prefs = useApp.getState().settings?.voice
  if (!prefs) return
  const parts = chunks(text, 600)
  const fetchPart = (t: string) => engine('tts.piper', { exe: prefs.piperPath, folder: prefs.piperVoices, voice: voice.id.slice(6), text: t, rate: voice.rate })
  let pending = parts.length ? fetchPart(parts[0]) : null
  for (let i = 0; i < parts.length && pending; i++) {
    const b64 = await pending
    if (mine !== token) return
    pending = i + 1 < parts.length ? fetchPart(parts[i + 1]) : null
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
    await new Promise<void>((resolve) => {
      const audio = new Audio(url)
      audio.volume = Math.min(1, volumeNow())
      audio.preservesPitch = true
      audio.playbackRate = 1
      const done = () => {
        URL.revokeObjectURL(url)
        resolve()
      }
      audio.onended = done
      audio.onerror = done
      stopCurrent = () => {
        audio.pause()
        done()
      }
      void audio.play().catch(done)
    })
    if (mine !== token) return
  }
}

export async function speak(text: string, voice: VoiceRef | null, key: string | null = null): Promise<void> {
  stopSpeaking()
  const mine = ++token
  const clean = plainText(text)
  if (!clean) return
  const chosen = voice ?? useApp.getState().settings?.voice.fallback ?? null
  useSpeech.setState({ speaking: key ?? 'speech' })
  try {
    if (chosen?.id.startsWith('piper:')) await speakPiper(clean, chosen, mine)
    else await speakSystem(clean, chosen, mine)
  } catch (err) {
    toast.error('Could not speak', errorText(err))
  } finally {
    if (mine === token) {
      stopCurrent = null
      useSpeech.setState({ speaking: null })
    }
  }
}
