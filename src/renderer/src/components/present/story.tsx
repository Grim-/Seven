import { useEffect, useState } from 'react'
import type { AgentProfile, AvatarState } from '@shared/types'
import { registerPresentation, str, type PresentationProps } from '../../registries/presentations'
import { AgentAvatar } from '../agents/look'
import { Markdown } from '../chat/Markdown'
import { useAgents } from '../../store/agents'
import { cn } from '../../lib/cn'
import { AssetMedia } from '../pictures/AssetMedia'
import { AreaMedia } from '../pictures/AreaLayer'
import { useAgentIdOf, useFocusedConversation } from '../../lib/conversation'

const MOODS: AvatarState[] = ['idle', 'happy', 'laughing', 'talking', 'thinking', 'sad', 'angry']
const TRANSITIONS = ['fade', 'flash', 'shake', 'iris', 'slide', 'glitch', 'zoom']

const moodOf = (v: unknown): AvatarState | undefined => (MOODS.includes(v as AvatarState) ? (v as AvatarState) : undefined)

function useAgent(name: unknown, fallbackToChat: boolean): AgentProfile | null {
  const agents = useAgents((s) => s.list)
  const chatAgentId = useAgentIdOf(useFocusedConversation())
  const wanted = str(name).trim().toLowerCase()
  if (wanted) return agents.find((a) => a.name.toLowerCase() === wanted) ?? null
  return fallbackToChat ? (agents.find((a) => a.id === chatAgentId) ?? null) : null
}


export function useTypewriter(text: string, on: boolean): [string, boolean] {
  const [n, setN] = useState(on ? 0 : text.length)
  useEffect(() => {
    if (!on) return setN(text.length)
    setN(0)
    const timer = setInterval(() => setN((v) => (v >= text.length ? v : v + 2)), 22)
    return () => clearInterval(timer)
  }, [text, on])
  return [text.slice(0, n), n < text.length]
}

export function highlightQuotes(text: string) {
  return text.split(/("[^"]*"?|“[^”]*”?)/g).map((piece, i) =>
    /^["“]/.test(piece) ? (
      <span key={i} className="font-semibold text-[#ffe680]">
        {piece}
      </span>
    ) : (
      <span key={i}>{piece}</span>
    )
  )
}

export function Portrait({ agent, image, name, mood, size }: { agent: AgentProfile | null; image: string; name: string; mood?: AvatarState; size: number }) {
  if (agent) return <AgentAvatar agent={agent} size={size} mood={mood} />
  if (image) return <AssetMedia id={image} className="h-full w-full" />
  return <div className="flex h-full w-full items-center justify-center bg-black/60 font-mono text-[40px] font-bold text-accent/80">{name.slice(0, 1).toUpperCase() || '?'}</div>
}

function Dialogue({ fields, draft, stage }: PresentationProps) {
  const agent = useAgent(fields.speaker, true)
  const name = str(fields.speaker) || agent?.name || ''
  const [shown, typing] = useTypewriter(str(fields.text), stage && !draft)
  const size = stage ? 180 : 104
  return (
    <div className="my-2 border border-accent border-l-[3px] bg-black/80 shadow-[0_0_14px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]">
      <div className="flex gap-3 p-3">
        <div className="shrink-0 overflow-hidden border border-line-strong bg-black/40" style={{ width: size, height: size }}>
          <Portrait agent={agent} image={str(fields.image)} name={name} mood={moodOf(fields.mood)} size={size} />
        </div>
        <div className="min-w-0 flex-1">
          {name && <div className={cn('mb-1.5 border-b border-line/50 pb-1 font-mono font-bold uppercase tracking-[0.18em] text-accent', stage ? 'text-[16px]' : 'text-[12px]')}>{name}</div>}
          <div className={cn('whitespace-pre-wrap leading-relaxed text-white', stage ? 'text-[20px]' : 'text-[14.5px]')}>
            {highlightQuotes(shown)}
            {(draft || typing) && <span className="ml-0.5 inline-block h-[1em] w-2 animate-blink bg-accent align-middle" />}
          </div>
        </div>
      </div>
    </div>
  )
}

interface PanelFields {
  image?: unknown
  character?: unknown
  mood?: unknown
  caption?: unknown
  speech?: unknown
}

function ComicPanel({ panel, index, stage, animate }: { panel: PanelFields; index: number; stage: boolean; animate: boolean }) {
  const agent = useAgent(panel.character, false)
  const image = str(panel.image)
  const caption = str(panel.caption)
  const speech = str(panel.speech)
  return (
    <div
      className="relative aspect-[4/3] overflow-hidden border-[3px] border-black bg-[radial-gradient(circle,#2a2a2a_1px,transparent_1.5px)] bg-[length:7px_7px] bg-[#151515]"
      style={animate ? { animation: `comic-in 0.5s ease-out ${index * (stage ? 0.7 : 0.25)}s both` } : undefined}
    >
      {image ? (
        <AssetMedia id={image} className="absolute inset-0 h-full w-full" />
      ) : agent ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <AgentAvatar agent={agent} size={stage ? 220 : 120} mood={moodOf(panel.mood)} />
        </div>
      ) : null}
      {caption && (
        <div className={cn('absolute left-1.5 top-1.5 max-w-[80%] border-2 border-black bg-[#fff2a8] px-2 py-1 font-bold uppercase leading-snug text-black', stage ? 'text-[15px]' : 'text-[11.5px]')}>{caption}</div>
      )}
      {speech && (
        <div className={cn('absolute bottom-2.5 right-2.5 max-w-[78%] rounded-[18px] border-2 border-black bg-white px-3 py-1.5 font-semibold leading-snug text-black', stage ? 'text-[17px]' : 'text-[13px]')}>
          {speech}
          <span className="absolute -bottom-[9px] left-5 h-0 w-0 border-x-[7px] border-t-[9px] border-x-transparent border-t-black" />
          <span className="absolute -bottom-[5.5px] left-[22px] h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-white" />
        </div>
      )}
    </div>
  )
}

function Comic({ fields, draft, stage }: PresentationProps) {
  const panels = (Array.isArray(fields.panels) ? fields.panels : []).filter((p): p is PanelFields => !!p && typeof p === 'object')
  const cols = panels.length <= 1 ? 1 : panels.length === 2 || panels.length === 4 ? 2 : 3
  const title = str(fields.title)
  return (
    <div className="border-[3px] border-black bg-[#f4f0e6] p-2 shadow-[0_6px_18px_rgba(0,0,0,0.6)]">
      {title && <div className={cn('mb-2 font-black uppercase italic tracking-wide text-black', stage ? 'text-[26px]' : 'text-[17px]')}>{title}</div>}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {panels.map((p, i) => (
          <ComicPanel key={i} panel={p} index={i} stage={stage} animate={!draft} />
        ))}
      </div>
    </div>
  )
}

function Reveal({ fields, draft, stage }: PresentationProps) {
  const transition = TRANSITIONS.includes(str(fields.transition)) ? str(fields.transition) : 'fade'
  const seconds = typeof fields.seconds === 'number' ? Math.min(10, Math.max(0.5, fields.seconds)) : 2.5
  const [run, setRun] = useState(0)
  const image = str(fields.image)
  const title = str(fields.title)
  const text = str(fields.text)
  return (
    <div className={cn('relative overflow-hidden border border-line/60 bg-black', stage ? 'p-8' : 'p-5')} onClick={() => !draft && setRun(run + 1)}>
      <div key={run} className="flex flex-col items-center gap-4 text-center" style={draft ? undefined : { animation: `reveal-${transition} ${seconds}s cubic-bezier(0.2, 0.7, 0.2, 1) both` }}>
        {image && <AreaMedia id={image} className={cn('block w-auto border border-line/50', stage ? 'max-h-[55vh]' : 'max-h-72')} />}
        {title && <div className={cn('font-black uppercase tracking-[0.08em] text-accent [text-shadow:0_0_18px_color-mix(in_srgb,var(--color-accent)_55%,transparent)]', stage ? 'text-[44px] leading-tight' : 'text-[26px]')}>{title}</div>}
        {text && (
          <div className={cn('max-w-2xl text-left', stage && 'text-[17px]')}>
            <Markdown text={text} />
          </div>
        )}
      </div>
      {!draft && transition === 'flash' && <div key={`f${run}`} className="pointer-events-none absolute inset-0 bg-white" style={{ animation: `reveal-flash-cover ${Math.min(1.2, seconds)}s ease-out both` }} />}
    </div>
  )
}

interface ChoiceQuestion {
  question?: unknown
  options?: unknown
}

interface ChoiceAnswer {
  question: string
  choices: string[]
  other: string | null
}

function Choices({ fields, draft }: PresentationProps) {
  const questions = (Array.isArray(fields.questions) ? fields.questions : []).filter((q): q is ChoiceQuestion => !!q && typeof q === 'object')
  const answers = (Array.isArray(fields.answers) ? fields.answers : []) as ChoiceAnswer[]
  return (
    <div className="notch-sm flex flex-col gap-3 border border-line border-l-2 border-l-accent bg-black/60 p-3.5">
      {questions.map((q, i) => {
        const options = Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === 'string') : []
        const answer = answers[i]
        return (
          <div key={i} className="flex flex-col gap-2">
            <div className="text-[14px] text-white">{str(q.question)}</div>
            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => (
                <span key={o} className={cn('border px-2.5 py-1 text-[12.5px]', answer?.choices.includes(o) ? 'border-accent bg-accent/15 text-accent' : 'border-line/60 text-dim')}>
                  {o}
                </span>
              ))}
            </div>
            {answer?.other && <div className="text-[12.5px] text-accent">“{answer.other}”</div>}
          </div>
        )
      })}
      {draft && <span className="inline-block h-3.5 w-1.5 animate-blink bg-accent" />}
    </div>
  )
}

registerPresentation('dialogue', Dialogue)
registerPresentation('comic', Comic)
registerPresentation('reveal', Reveal)
registerPresentation('choices', Choices)
