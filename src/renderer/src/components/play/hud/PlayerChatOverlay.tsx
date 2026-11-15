import { useState } from 'react'
import { ChevronUp, CornerDownLeft, MessageSquare, Minus } from 'lucide-react'
import { useDialogue } from '../dialogue/dialogueStore'
import { sendParleyToChat } from '../parleyBridge'
import { Button } from '../../ui/Button'
import { cn } from '../../../lib/cn'

interface PlayerChatOverlayProps {
  playerSheet?: string | null
  playerName?: string
  targetSheet?: string | null
  targetName?: string | null
  placeKey?: string | null
  onSendFreeform?: (target: string, text: string) => void
  className?: string
}

export function PlayerChatOverlay({
  playerSheet,
  playerName = 'Alistair Finch',
  targetSheet,
  targetName,
  placeKey = null,
  onSendFreeform,
  className
}: PlayerChatOverlayProps) {
  const [minimized, setMinimized] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')

  const activeNode = useDialogue((s) => s.activeNode)
  const pickChoice = useDialogue((s) => s.pickChoice)
  const closeDialogue = useDialogue((s) => s.closeDialogue)
  const chatLog = useDialogue((s) => s.playerChatLog)
  const say = useDialogue((s) => s.say)
  const addPlayerChat = useDialogue((s) => s.addPlayerChat)

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return

    // Show in-world speech bubble above player token
    if (playerSheet) {
      say(playerSheet, playerName, trimmed)
    } else {
      addPlayerChat(playerName, trimmed, 'pc')
    }

    const activeSpeakerSheet = targetSheet ?? useDialogue.getState().speakerSheet ?? null
    const activeSpeakerName = targetName ?? useDialogue.getState().speakerName ?? 'World Narrator'
    sendParleyToChat({
      npcSheet: activeSpeakerSheet,
      npcName: activeSpeakerName,
      playerSheet: playerSheet ?? null,
      playerName,
      placeKey,
      said: trimmed
    })

    onSendFreeform?.(targetName ?? 'dm', trimmed)
    setText('')
  }

  const isInteractive = expanded || Boolean(activeNode)

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-3 left-3 z-20 flex flex-col font-mono select-none transition-all duration-300 ease-out',
        minimized ? 'w-[220px]' : expanded ? 'h-[440px] w-[520px]' : 'h-[220px] w-[380px]',
        isInteractive
          ? 'border border-line bg-black/95 opacity-100 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md'
          : 'border border-line/30 bg-black/60 opacity-40 backdrop-blur-sm hover:border-line hover:bg-black/95 hover:opacity-100 focus-within:border-line focus-within:bg-black/95 focus-within:opacity-100 hover:shadow-[0_8px_32px_rgba(0,0,0,0.85)] focus-within:shadow-[0_8px_32px_rgba(0,0,0,0.85)]',
        className
      )}
    >
      {/* HEADER STRIP */}
      <div className="flex h-7 items-center justify-between border-b border-line/40 bg-subtle/50 px-2.5 text-[10px] font-bold uppercase tracking-wider text-dim">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3 w-3 text-cyan" />
          <span className="text-white">PLAYER CHAT</span>
          {targetName && (
            <span className="font-normal text-dim">
              · <span className="text-accent">{targetName}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="border border-line/40 bg-black/40 px-1.5 py-0.5 text-[8.5px] text-dim hover:border-accent hover:text-white transition-colors"
          >
            {expanded ? 'SHRINK' : 'EXPAND'}
          </button>
          <button
            type="button"
            onClick={() => setMinimized(!minimized)}
            className="border border-line/40 bg-black/40 px-1.5 py-0.5 text-[8.5px] text-dim hover:border-accent hover:text-white transition-colors"
          >
            {minimized ? <ChevronUp className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* CHAT LOG STREAM */}
          <div className="flex min-h-[60px] flex-1 flex-col gap-1.5 overflow-y-auto bg-black/40 p-2 text-[11px]">
            {chatLog.length === 0 ? (
              <span className="text-[10px] text-faint">
                Dialogue and player messages appear here.
              </span>
            ) : (
              chatLog.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'border-l-2 p-1.5 leading-relaxed',
                    c.kind === 'npc'
                      ? 'border-accent bg-accent/5 text-white/90'
                      : c.kind === 'pc'
                      ? 'border-cyan bg-cyan/5 text-cyan'
                      : 'border-purple bg-purple/5 text-purple'
                  )}
                >
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider text-faint">
                    <span>{c.speaker}</span>
                    <span>{c.at}</span>
                  </div>
                  <div className="mt-0.5 text-[11px]">{c.text}</div>
                </div>
              ))
            )}
          </div>

          {/* MANUAL CRPG CHOICE TREE (WHEN NPC DIALOGUE IS ACTIVE) */}
          {activeNode && (
            <div className="flex flex-col gap-1.5 border-t border-line/60 bg-subtle/80 p-2.5">
              <div className="flex items-center justify-between border-b border-line/40 pb-1 text-[9px] font-bold uppercase tracking-wider text-accent">
                <span>{activeNode.speakerName ?? 'NPC'}</span>
                <button
                  type="button"
                  onClick={closeDialogue}
                  className="text-faint hover:text-alert transition-colors cursor-pointer"
                >
                  [CLOSE]
                </button>
              </div>
              <div className="text-[11px] leading-relaxed text-white">
                &ldquo;{activeNode.prompt}&rdquo;
              </div>

              {/* CHOICES */}
              <div className="mt-1 flex flex-col gap-1">
                {activeNode.choices.map((choice, i) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => pickChoice(choice)}
                    className="group flex items-center justify-between border border-line/60 bg-black/60 p-1.5 text-left text-[10.5px] text-dim hover:border-accent hover:bg-accent/10 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>
                      <strong className="mr-1.5 text-cyan">[{i + 1}]</strong>
                      {choice.check ? (
                        <span className="font-semibold text-accent">
                          [{choice.check.stat.toUpperCase()} DC {choice.check.dc}]{' '}
                        </span>
                      ) : null}
                      {choice.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* INPUT COMPOSER STRIP */}
          <div className="flex flex-col gap-1 border-t border-line/40 bg-black/80 p-2">
            <div className="flex items-center justify-between text-[9px] text-faint">
              <span>{targetName ? `Speaking to ${targetName}` : 'World dialogue / action'}</span>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={
                  targetName
                    ? `Say something to ${targetName}...`
                    : `Speak or describe action (*I examine the room*)...`
                }
                className="h-7 flex-1 border border-line bg-black/60 px-2 font-mono text-[11px] text-white placeholder:text-faint focus:border-accent outline-none"
              />
              <Button
                size="sm"
                variant="badge"
                onClick={handleSend}
                disabled={!text.trim()}
                className="h-7 px-2 text-[10px]"
              >
                <span>SEND</span>
                <CornerDownLeft className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
