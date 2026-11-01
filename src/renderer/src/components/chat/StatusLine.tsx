import { useEffect, useState } from 'react'
import { BookOpen, Brain, Hourglass, LoaderCircle, MessageCircleQuestion } from 'lucide-react'
import type { TurnPhase } from '@shared/types'
import { usePhases } from '../../store/phases'
import { useSessions } from '../../store/sessions'

const pretty = (name: string) => name.replace(/_/g, ' ')

function describe(phase: TurnPhase | undefined): { icon: React.ReactNode; text: string } | null {
  if (!phase) return { icon: <Hourglass className="h-3.5 w-3.5" />, text: 'Starting' }
  switch (phase.kind) {
    case 'reading':
      return { icon: <BookOpen className="h-3.5 w-3.5" />, text: phase.tool ? `Reading the result of ${pretty(phase.tool)}` : 'Reading your message' }
    case 'thinking':
      return { icon: <Brain className="h-3.5 w-3.5" />, text: 'Thinking' }
    case 'tool':
      return { icon: <LoaderCircle className="h-3.5 w-3.5 animate-spin" />, text: phase.detail ? `${pretty(phase.tool ?? '')}: ${phase.detail}` : `Working on ${pretty(phase.tool ?? 'a tool')}` }
    case 'waiting':
      return { icon: <MessageCircleQuestion className="h-3.5 w-3.5" />, text: 'Waiting for you' }
    default:
      return null
  }
}

export function StatusLine({ messageId }: { messageId: string }) {
  const phase = usePhases((s) => s.phases[messageId])
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const shown = describe(phase)
  if (!shown) return null
  const seconds = phase ? Math.floor((now - phase.since) / 1000) : 0
  return (
    <div className="mt-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-teal/80">
      {shown.icon}
      <span className="truncate normal-case tracking-normal">{shown.text}</span>
      {seconds >= 2 && <span className="text-faint">{seconds}s</span>}
    </div>
  )
}

export function useLivePhase(sessionId: string | null): string | null {
  const messageId = useSessions((s) => (sessionId && s.running[sessionId] ? ((s.messages[sessionId] ?? []).findLast((m) => m.role === 'assistant')?.id ?? '') : null))
  const phase = usePhases((s) => (messageId ? s.phases[messageId] : undefined))
  if (messageId === null) return null
  return describe(phase)?.text ?? 'Writing'
}
