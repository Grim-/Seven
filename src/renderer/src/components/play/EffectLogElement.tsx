import { ScrollText, Swords } from 'lucide-react'
import type { ChatElement } from '@shared/chatElements'
import { registerChatElement, type ChatElementProps } from '../../registries/chatElements'
import { Markdown } from '../chat/Markdown'
import { readOutcome } from '../cards/cardPlay'
import { PlayStamp } from './PlayStamp'
import type { PlayOutcome } from './playStore'

export const EFFECT_LOG = 'effect_log'

export interface EffectLogData {
  title?: string
  attempt?: string
  said?: string
  actor?: string | null
  target?: string | null
  place?: string | null
  outcome?: PlayOutcome | null
  lines?: string[]
}

export function effectLogElement(data: EffectLogData): ChatElement {
  return {
    type: EFFECT_LOG,
    data: {
      title: data.title ?? 'TACTICAL TELEMETRY',
      attempt: data.attempt ?? '',
      said: data.said ?? '',
      actor: data.actor ?? null,
      target: data.target ?? null,
      place: data.place ?? null,
      outcome: data.outcome ?? null,
      lines: data.lines ?? data.outcome?.effects ?? []
    }
  }
}

export function EffectLinesList({ lines }: { lines: string[] }) {
  if (!lines.length) return null
  return (
    <div className="flex flex-col gap-1 border-t border-line/40 pt-1.5 font-ui text-[11.5px]">
      {lines.map((line, i) => (
        <div
          key={i}
          className="flex items-start gap-2 border-l-2 border-l-secondary-ink/60 bg-secondary-ink/[0.04] px-2.5 py-1 text-ink/90"
        >
          <Swords className="mt-1 h-3 w-3 shrink-0 text-secondary-ink/80" />
          <div className="min-w-0 flex-1 leading-relaxed">
            <Markdown text={line} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EffectLogRecord({ data }: ChatElementProps) {
  const title = typeof data.title === 'string' && data.title ? data.title : 'TACTICAL TELEMETRY'
  const attempt = typeof data.attempt === 'string' ? data.attempt : ''
  const said = typeof data.said === 'string' ? data.said : ''
  const actor = typeof data.actor === 'string' ? data.actor : null
  const target = typeof data.target === 'string' ? data.target : null
  const place = typeof data.place === 'string' ? data.place : null
  const outcome = readOutcome(data.outcome)
  const rawLines = Array.isArray(data.lines) ? data.lines.filter((x): x is string => typeof x === 'string') : []
  const lines = rawLines.length ? rawLines : (outcome?.effects ?? [])

  const contextChips = [
    place ? (place.startsWith('@') ? place : `@place:${place}`) : null,
    actor ? (actor.startsWith('@') ? actor : `@sheet:${actor}`) : null,
    target ? (target.startsWith('@') ? target : `@sheet:${target}`) : null
  ].filter((x): x is string => Boolean(x))

  return (
    <div className="notch-sm flex flex-col gap-2 border border-line/70 tone-surface-95 p-3 font-ui shadow-[0_6px_24px_color-mix(in_srgb,var(--color-shade)_50%,transparent)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-1.5">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-secondary-ink" />
          <span className="text-[10px] font-bold caps-18 text-secondary-ink">{title}</span>
          {contextChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <Markdown text={contextChips.join(' › ')} />
            </div>
          )}
        </div>
        {outcome && <PlayStamp outcome={outcome} className="play-stamp-inline" />}
      </div>
      {attempt && (
        <div className="text-[13px] font-semibold text-ink/95">
          <Markdown text={attempt} />
        </div>
      )}
      {said && (
        <div className="border-l-2 border-l-accent/60 bg-accent/[0.05] px-2.5 py-1.5 text-[13px] italic text-ink/90">
          <Markdown text={said} />
        </div>
      )}
      <EffectLinesList lines={lines} />
    </div>
  )
}

registerChatElement(EFFECT_LOG, {
  View: EffectLogRecord,
  covers: () => 'fold'
})
