import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, X } from 'lucide-react'
import type { SceneActor, SceneBeat, SceneFields } from '@shared/types'
import { poseOf } from '@shared/moods'
import { registerPresentation, useStage, type PresentationProps } from '../../registries/presentations'
import { useAgents } from '../../store/agents'
import { speak, stopSpeaking, voicesOn } from '../../lib/speech'
import { runCue } from '../shell/ThemeStage'
import { PartView } from '../data/PartView'
import { Portrait, highlightQuotes, useTypewriter } from './story'
import { cn } from '../../lib/cn'

function sceneOf(fields: Record<string, unknown>): SceneFields {
  const f = fields as Partial<SceneFields>
  return { title: f.title ?? 'Scene', beats: Array.isArray(f.beats) ? f.beats : [], cast: f.cast ?? {}, narrator: f.narrator ?? { agentId: null, voice: null } }
}

function Actor({ actor, mood, size, active }: { actor: SceneActor; mood?: string; size: number; active: boolean }) {
  const agent = useAgents((s) => (actor.agentId ? (s.list.find((a) => a.id === actor.agentId) ?? null) : null))
  return (
    <div className={cn('flex flex-col items-center gap-1.5 transition-all duration-500', active ? 'scale-105 opacity-100' : 'scale-95 opacity-60')} style={{ animation: 'reveal-fade 0.6s ease-out both' }}>
      <div className={cn('overflow-hidden border-2 bg-black/50', active ? 'border-accent' : 'border-white/30')} style={{ width: size, height: size }}>
        <Portrait agent={agent} image={actor.image ?? ''} name={actor.name} mood={poseOf(mood)} size={size} />
      </div>
      <div className={cn('font-mono text-[11px] uppercase tracking-[0.16em]', active ? 'text-accent' : 'text-dim')}>{actor.name}</div>
    </div>
  )
}

function Line({ name, text, kind }: { name: string; text: string; kind: 'say' | 'act' }) {
  const [shown, typing] = useTypewriter(text, kind === 'say')
  if (kind === 'act')
    return (
      <div className="text-[18px] italic leading-relaxed text-white/85">
        <span className="font-semibold not-italic text-accent-soft">{name}</span> {text}
      </div>
    )
  return (
    <div>
      <div className="mb-1 text-[15px] font-bold uppercase tracking-[0.12em] text-[#9fd3ff]">{name}</div>
      <div className="whitespace-pre-wrap text-[20px] leading-relaxed text-white">
        {highlightQuotes(shown)}
        {typing && <span className="ml-0.5 inline-block h-[1em] w-2 animate-blink bg-white/80 align-middle" />}
      </div>
    </div>
  )
}

function ScenePlayer({ scene, onDone }: { scene: SceneFields; onDone?: () => void }) {
  const [i, setI] = useState(0)
  const [run, setRun] = useState(0)
  const [cast, setCast] = useState<string[]>([])
  const [moods, setMoods] = useState<Record<string, string>>({})
  const [line, setLine] = useState<{ who: string; text: string; kind: 'say' | 'act' } | null>(null)
  const [narration, setNarration] = useState<string | null>(null)
  const [view, setView] = useState<SceneBeat['view']>(null)
  const index = useRef(0)
  index.current = i
  const done = i >= scene.beats.length

  useEffect(() => () => stopSpeaking(), [])

  useEffect(() => {
    if (done) return
    const b = scene.beats[i]
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const next = (ms: number) => {
      timer = setTimeout(() => !cancelled && setI((n) => (n === index.current ? n + 1 : n)), ms)
    }
    const voiced = async (text: string, voice: SceneActor['voice'], minimum: number) => {
      if (!voicesOn()) return next(minimum + text.length * 25)
      const start = Date.now()
      await speak(text, voice, 'scene')
      if (!cancelled) next(Math.max(400, minimum - (Date.now() - start)))
    }
    const actor = b.who ? scene.cast[b.who] : undefined
    const onStage = (who: string) => setCast((c) => (c.includes(who) ? c : [...c, who]))
    if (b.mood && b.who) setMoods((m) => ({ ...m, [b.who!]: b.mood! }))
    switch (b.do) {
      case 'enter':
        onStage(b.who!)
        next(700)
        break
      case 'exit':
        setCast((c) => c.filter((x) => x !== b.who))
        setLine((l) => (l?.who === b.who ? null : l))
        next(600)
        break
      case 'say':
        onStage(b.who!)
        setNarration(null)
        setLine({ who: b.who!, text: b.text ?? '', kind: 'say' })
        void voiced(b.text ?? '', actor?.voice ?? null, (b.text ?? '').length * 11 + 1400)
        break
      case 'act':
        onStage(b.who!)
        setNarration(null)
        setLine({ who: b.who!, text: b.text ?? '', kind: 'act' })
        next(1200 + (b.text ?? '').length * 35)
        break
      case 'narrate':
        setLine(null)
        setNarration(b.text ?? '')
        void voiced(b.text ?? '', scene.narrator.voice, 1600)
        break
      case 'show':
        setView(b.view)
        next((b.seconds ?? 3) * 1000)
        break
      case 'cue':
        runCue({ sound: b.sound, flash: b.flash, shake: b.shake })
        next(500)
        break
      case 'wait':
        next((b.seconds ?? 2) * 1000)
        break
    }
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [i, run])

  const skip = () => {
    if (done) return
    stopSpeaking()
    setI((n) => n + 1)
  }
  const replay = () => {
    stopSpeaking()
    setCast([])
    setMoods({})
    setLine(null)
    setNarration(null)
    setView(null)
    setI(0)
    setRun((r) => r + 1)
  }
  const speaker = line?.who ?? null

  return (
    <div className="relative flex h-[min(82vh,680px)] w-full cursor-pointer select-none flex-col overflow-hidden border border-line/50 bg-black/70" onClick={skip}>
      <div className="flex shrink-0 items-center gap-3 border-b border-line/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em]">
        <span className="text-accent">{scene.title}</span>
        <span className="ml-auto text-faint">{Math.min(i + 1, scene.beats.length)} / {scene.beats.length} · click to skip</span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {view && (
          <div key={JSON.stringify(view.data)} className="max-h-full max-w-[80%] overflow-auto border border-line/50 bg-black/60 p-3" style={{ animation: 'reveal-fade 0.6s ease-out both' }} onClick={(e) => e.stopPropagation()}>
            <PartView data={view.data} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-end justify-center gap-6 px-4 pb-3">
        {cast.map((key) => scene.cast[key] && <Actor key={key} actor={scene.cast[key]} mood={moods[key]} size={112} active={speaker === key} />)}
      </div>
      <div className="min-h-[120px] shrink-0 border-t border-line/40 bg-gradient-to-b from-black/60 to-black/90 px-6 py-4">
        {line && scene.cast[line.who] && <Line key={`${i}-${line.who}`} name={scene.cast[line.who].name} text={line.text} kind={line.kind} />}
        {narration && (
          <div key={`n${i}`} className="text-center text-[18px] italic leading-relaxed text-white/80" style={{ animation: 'reveal-fade 0.8s ease-out both' }}>
            {narration}
          </div>
        )}
      </div>
      {done && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70" onClick={(e) => e.stopPropagation()} style={{ animation: 'reveal-fade 0.8s ease-out both' }}>
          <div className="font-mono text-[13px] uppercase tracking-[0.3em] text-accent">{scene.title}</div>
          <div className="flex gap-2">
            <button onClick={replay} className="flex items-center gap-1.5 border border-line/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white hover:border-accent">
              <RotateCcw className="h-3.5 w-3.5" /> Replay
            </button>
            {onDone && (
              <button onClick={onDone} className="flex items-center gap-1.5 border border-line/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white hover:border-accent">
                <X className="h-3.5 w-3.5" /> Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Transcript({ scene, fields }: { scene: SceneFields; fields: Record<string, unknown> }) {
  const name = (key: string | null) => (key ? (scene.cast[key]?.name ?? key) : '')
  return (
    <div className="border border-line/50 bg-black/50">
      <div className="flex items-center gap-2 border-b border-line/40 px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{scene.title}</span>
        <span className="font-mono text-[10.5px] text-faint">{scene.beats.length} beats</span>
        <button
          onClick={() => useStage.getState().play({ type: 'scene', fields, where: 'stage', key: null })}
          className="ml-auto flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent hover:text-white"
        >
          <Play className="h-3.5 w-3.5" /> Play
        </button>
      </div>
      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto px-3 py-2 text-[13.5px] leading-relaxed">
        {scene.beats.map((b, i) => {
          if (b.do === 'say')
            return (
              <div key={i}>
                <span className="font-semibold text-[#9fd3ff]">{name(b.who)}:</span> <span className="text-white">{highlightQuotes(b.text ?? '')}</span>
              </div>
            )
          if (b.do === 'act')
            return (
              <div key={i} className="italic text-white/75">
                {name(b.who)} {b.text}
              </div>
            )
          if (b.do === 'narrate')
            return (
              <div key={i} className="italic text-white/65">
                {b.text}
              </div>
            )
          if (b.do === 'enter' || b.do === 'exit')
            return (
              <div key={i} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                {name(b.who)} {b.do === 'enter' ? 'enters' : 'leaves'}
              </div>
            )
          if (b.do === 'show')
            return (
              <div key={i} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                shows {b.view?.title ?? 'something'}
              </div>
            )
          return null
        })}
      </div>
    </div>
  )
}

function Scene({ fields, stage, onDone }: PresentationProps) {
  const scene = sceneOf(fields)
  if (!scene.beats.length) return null
  return stage ? <ScenePlayer scene={scene} onDone={onDone} /> : <Transcript scene={scene} fields={fields} />
}

registerPresentation('scene', Scene)
