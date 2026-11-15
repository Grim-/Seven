import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff } from 'lucide-react'
import { showName } from '@shared/ids'
import { agentSheets, type AgentProfile } from '@shared/types'
import { cn } from '../../lib/cn'
import { FaceCount } from '../ui'
import { AgentAvatar } from '../agents/look'
import { CharacterAvatar } from './CharacterAvatar'
import { StatusChip } from './status/StatusChip'
import { useCharacterStatus } from './status/useCharacterStatus'
import { CardBack } from '../cards/CardBack'
import { LiveCard } from '../cards/LiveCard'
import { useDeckInUse } from '../cards/useDeckInUse'
import { useHeldCards, type HeldCard } from '../cards/useHeldCards'
import { showInPanel } from '../data/showInPanel'

const PREVIEW_W = 220

function BarAgentHand({
  agent,
  sheet,
  name,
  status,
  held,
  height
}: {
  agent: AgentProfile
  sheet: string | null
  name: string
  status: ReturnType<typeof useCharacterStatus>
  held: HeldCard[]
  height: number
}) {
  const [fronts, setFronts] = useState(true)
  const [hovered, setHovered] = useState<{ id: string; top: number; left: number } | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const avatarPx = Math.max(18, height - 8)
  const cardH = Math.max(22, height - 6)
  const cardW = Math.max(30, Math.round(cardH * 1.35))
  const step = held.length ? Math.min(cardW + 3, Math.max(20, Math.floor(240 / held.length))) : 0
  const stripW = held.length ? Math.max(cardW, (held.length - 1) * step + cardW) : 0
  const baseScale = cardW / PREVIEW_W
  const hoveredCard = hovered ? (held.find((h) => h.id === hovered.id) ?? null) : null

  useEffect(() => {
    if (!hovered) return
    const clear = () => setHovered(null)
    window.addEventListener('blur', clear)
    return () => window.removeEventListener('blur', clear)
  }, [hovered])

  const previewCard = (id: string, target: HTMLElement) => {
    const stripRect = stripRef.current?.getBoundingClientRect()
    const boxRect = target.getBoundingClientRect()
    const anchorBottom = Math.max(stripRect?.bottom ?? 0, boxRect.bottom)
    const rawLeft = boxRect.left + boxRect.width / 2 - PREVIEW_W / 2
    const left = Math.max(12, Math.min(window.innerWidth - PREVIEW_W - 12, rawLeft))
    setHovered({ id, top: anchorBottom + 8, left })
  }

  return (
    <div
      style={{ height }}
      className="relative flex items-center gap-2 border border-line/50 bg-black/60 px-2"
    >
      {sheet ? (
        <CharacterAvatar sheetId={sheet} size={avatarPx} openOnClick />
      ) : (
        <AgentAvatar agent={agent} size={avatarPx} />
      )}
      <span className="max-w-28 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-white/90">
        {name}
      </span>
      {status && <StatusChip status={status} />}
      {held.length > 0 && (
        <>
          <div
            ref={stripRef}
            onMouseLeave={() => setHovered(null)}
            className="relative flex items-center"
            style={{ height: cardH, width: stripW }}
          >
            {held.map((h, i) => {
              const isHovered = hoveredCard?.id === h.id
              return (
                <div
                  key={h.id}
                  onMouseEnter={(e) => previewCard(h.id, e.currentTarget)}
                  onClick={() => fronts && void showInPanel(`card/${h.id}`)}
                  style={{ left: i * step, height: cardH, width: cardW, zIndex: isHovered ? held.length + 1 : i + 1 }}
                  className={cn(
                    'absolute top-0 cursor-pointer overflow-hidden border bg-black/80 shadow-md transition-colors',
                    isHovered ? 'border-accent ring-1 ring-accent/60' : 'border-accent/50 hover:border-accent'
                  )}
                >
                  <div
                    style={{ transform: `scale(${baseScale})` }}
                    className="h-[312px] w-[220px] origin-top-left pointer-events-none"
                  >
                    {fronts ? <LiveCard id={h.id} /> : <CardBack className="w-full" />}
                  </div>
                  <FaceCount count={h.count > 1 ? h.count : undefined} />
                </div>
              )
            })}
          </div>
          <span className="font-mono text-[10px] font-semibold text-accent">
            {held.reduce((n, c) => n + c.count, 0)}
          </span>
          <button
            type="button"
            onClick={() => setFronts((v) => !v)}
            title={fronts ? `Hide ${name}'s card fronts` : `Show ${name}'s card fronts`}
            className="flex h-5 w-5 items-center justify-center text-dim hover:text-white cursor-pointer"
          >
            {fronts ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </>
      )}
      {hoveredCard &&
        hovered &&
        createPortal(
          <div
            style={{ top: hovered.top, left: hovered.left, width: PREVIEW_W }}
            className="pointer-events-none fixed z-[90] drop-shadow-[0_14px_36px_rgba(0,0,0,0.9)]"
          >
            <div className="relative w-full">
              {fronts ? <LiveCard id={hoveredCard.id} /> : <CardBack className="w-full" />}
              <FaceCount count={hoveredCard.count > 1 ? hoveredCard.count : undefined} />
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

function Side({ agent, sheet, height }: { agent: AgentProfile; sheet: string | null; height: number }) {
  const status = useCharacterStatus(sheet)
  const sheetDeck = useDeckInUse(sheet ? { character: sheet } : null)
  const agentDeck = useDeckInUse({ agent: agent.id })
  const entries = sheetDeck?.entries.length ? sheetDeck.entries : (agentDeck?.entries ?? [])
  const held = useHeldCards(entries)
  if (!status && !held.length) return null
  const name = status ? showName(status.name) : agent.name

  return <BarAgentHand agent={agent} sheet={sheet} name={name} status={status} held={held} height={height} />
}

export function AgentSide({ agent, height = 30 }: { agent: AgentProfile | null; height?: number }) {
  if (!agent) return null
  const sheets = agentSheets(agent)

  return (
    <div className="flex items-center gap-2 empty:hidden">
      {(sheets.length ? sheets : [null]).map((sheet) => (
        <Side key={sheet ?? 'agent'} agent={agent} sheet={sheet} height={height} />
      ))}
    </div>
  )
}
