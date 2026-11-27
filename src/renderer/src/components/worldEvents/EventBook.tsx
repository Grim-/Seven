import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@shared/types'
import { Markdown } from '../chat/Markdown'
import { parseRoleplay } from '../chat/Roleplay'
import { messageText } from './messageText'

function Passage({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      {parseRoleplay(text).map((b, i) =>
        b.speaker ? (
          <div key={i} className="border-l-2 border-accent/55 bg-accent/[0.03] px-3 py-2 text-[14.5px] leading-[1.75] text-ink">
            <span className="mr-2 font-label text-[10.5px] font-bold caps-10 text-accent">{b.speaker}</span>
            <span>{b.text}</span>
          </div>
        ) : (
          <Markdown key={i} text={b.text} className="font-body text-[14.5px] leading-[1.75] text-ink/85" />
        )
      )}
    </div>
  )
}

export function EventBook({ messages, running, opening }: { messages: ChatMessage[]; running: boolean; opening: string }) {
  const end = useRef<HTMLDivElement>(null)
  const last = messages[messages.length - 1]
  const tail = last ? messageText(last).length : 0
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [messages.length, tail])
  const entries = messages.slice(1)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto border border-line/40 tone-surface-80 px-5 py-4 select-text">
      {opening && (
        <div className="border-b border-line/40 pb-3">
          <div className="mb-1 font-label text-[9.5px] caps-14 text-accent-soft">Opening premise</div>
          <p className="font-body text-[13.5px] italic leading-relaxed text-dim">{opening}</p>
        </div>
      )}
      {entries.length === 0 && !running && (
        <div className="py-6 text-center font-ui text-[12px] text-faint">Awaiting opening narration…</div>
      )}
      {entries.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className="border-l-2 border-secondary-ink/70 tone-well-40 px-3 py-1.5 font-label text-[11px] caps-5 text-secondary-ink">
            Director · {messageText(m)}
          </div>
        ) : (
          <Passage key={m.id} text={messageText(m)} />
        )
      )}
      {running && (
        <div className="flex items-center gap-2 font-label text-[10.5px] caps-10 text-accent">
          <span className="h-1.5 w-1.5 animate-pulse bg-accent" />
          <span>Narrating scene…</span>
        </div>
      )}
      <div ref={end} />
    </div>
  )
}
