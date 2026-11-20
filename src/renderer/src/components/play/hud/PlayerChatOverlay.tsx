import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, CornerDownLeft, ExternalLink, MessageSquare, Play, RefreshCw, Square, Unlink } from 'lucide-react'
import type { ChatMessage } from '@shared/types'
import { useDialogue } from '../dialogue/dialogueStore'
import { sendParleyToChat } from '../parleyBridge'
import { detachGameplaySession, findGameplaySession, rolloverGameplaySession, startGameplaySession } from '../gameplaySession'
import { ModelReadyControl } from '../ModelReadyControl'
import { useAgents } from '../../../store/agents'
import { useSessions } from '../../../store/sessions'
import { openChat } from '../../../lib/conversation'
import { useEscapeLayer } from '../../../lib/escape'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { noteFailure } from '../../../store/problems'
import { Markdown } from '../../chat/Markdown'
import { Button } from '../../ui/Button'
import { cn } from '../../../lib/cn'

function messageTextOf(m: ChatMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
    .trim()
}

interface PlayerChatOverlayProps {
  worldId?: string | null
  saveId?: string | null
  mapId?: string | null
  playerSheet?: string | null
  playerName?: string
  targetSheet?: string | null
  targetName?: string | null
  placeKey?: string | null
  placeName?: string | null
  onSendFreeform?: (target: string, text: string) => void
  className?: string
}

export function PlayerChatOverlay({
  worldId = null,
  saveId = null,
  mapId = null,
  playerSheet,
  playerName = 'Player',
  targetSheet,
  targetName,
  placeKey = null,
  placeName = null,
  onSendFreeform,
  className
}: PlayerChatOverlayProps) {
  const [open, setOpen] = useState(false)
  const [tall, setTall] = useState(false)
  const [text, setText] = useState('')
  const [starting, setStarting] = useState(false)

  const agents = useAgents((s) => s.list)
  const sessions = useSessions((s) => s.list)
  const [presets, setPresets] = useState<{ id: string; name: string; installed: boolean }[]>([])
  const [pickedAgentId, setPickedAgentId] = useState<string>('')
  const gameplaySession = findGameplaySession(sessions, worldId, saveId)
  const sessionId = gameplaySession?.id ?? null
  const sessionMessages = useSessions((s) => (sessionId ? s.messages[sessionId] : undefined))
  const sessionRunning = useSessions((s) => (sessionId ? Boolean(s.running[sessionId]) : false))
  const boundAgent = gameplaySession ? agents.find((a) => a.id === gameplaySession.agentId) ?? null : null

  useEffect(() => {
    if (!worldId || gameplaySession) return
    void engine('agents.presets', { role: 'gameplay' })
      .then((list) => setPresets(list.map((p) => ({ id: p.id, name: p.name, installed: p.installed }))))
      .catch(noteFailure('play', 'Could not load gameplay agent presets'))
  }, [worldId, gameplaySession, agents.length])

  const presetIds = new Set(presets.map((p) => p.id))
  const defaultChoice = presets[0]?.id ?? agents[0]?.id ?? ''
  const effectiveAgentId =
    pickedAgentId && (agents.some((a) => a.id === pickedAgentId) || presetIds.has(pickedAgentId))
      ? pickedAgentId
      : defaultChoice
  const selectedPreset = presets.find((p) => p.id === effectiveAgentId && !agents.some((a) => a.id === p.id)) ?? null
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionId) return
    void useSessions.getState().load(sessionId).catch(noteFailure('play', 'Could not load Gameplay Chat messages'))
  }, [sessionId])

  const lastMessage = sessionMessages?.[sessionMessages.length - 1]
  const lastLen = lastMessage ? messageTextOf(lastMessage).length : 0
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [open, sessionMessages?.length, lastLen, sessionRunning])

  const activeNode = useDialogue((s) => s.activeNode)
  const pickChoice = useDialogue((s) => s.pickChoice)
  const closeDialogue = useDialogue((s) => s.closeDialogue)
  const chatLog = useDialogue((s) => s.playerChatLog)
  const say = useDialogue((s) => s.say)
  const addPlayerChat = useDialogue((s) => s.addPlayerChat)

  // Auto-expand when an NPC dialogue choice tree opens
  useEffect(() => {
    if (activeNode) setOpen(true)
  }, [activeNode])

  useEscapeLayer(open, () => setOpen(false))

  const handleStartGameplay = () => {
    if (!worldId || !effectiveAgentId || starting) return
    setStarting(true)
    void startGameplaySession({
      agentId: effectiveAgentId,
      presetId: selectedPreset?.id ?? null,
      worldId,
      saveId,
      mapId,
      placeKey,
      placeName,
      playerSheet,
      playerName
    })
      .catch(failed('Could not start Gameplay Chat'))
      .finally(() => setStarting(false))
  }

  const handleDetach = () => {
    if (!gameplaySession) return
    void detachGameplaySession(gameplaySession.id).catch(failed('Could not detach Gameplay Chat'))
  }

  const handleAbort = () => {
    if (!sessionId) return
    void engine('sessions.abort', { id: sessionId }).catch(failed('Could not stop generation'))
  }

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
      worldId,
      saveId,
      playerSheet: playerSheet ?? null,
      playerName,
      placeKey,
      said: trimmed
    })

    onSendFreeform?.(targetName ?? 'dm', trimmed)
    setText('')
  }

  if (!open) {
    return (
      <div
        className={cn(
          'pointer-events-auto absolute bottom-0 left-3 z-50 flex h-7 items-center gap-2 border border-b-0 bg-black/95 px-2.5 font-mono text-[10px] font-bold uppercase tracking-wider shadow-[0_-4px_18px_rgba(0,0,0,0.85)] backdrop-blur-md transition-colors',
          sessionRunning || (worldId && !gameplaySession)
            ? 'border-accent/70 text-white'
            : 'border-line/70 text-dim hover:border-cyan hover:text-white',
          className
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Expand Gameplay Chat drawer (overlays action bar)"
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <MessageSquare className={cn('h-3 w-3 shrink-0', sessionRunning ? 'text-accent animate-pulse' : 'text-cyan')} />
          <span className="text-white">{gameplaySession ? 'GAMEPLAY' : 'CHAT'}</span>
          {boundAgent && <span className="max-w-[110px] truncate font-normal text-cyan">· {boundAgent.name}</span>}
          {worldId && !gameplaySession && (
            <span className="border border-accent/60 bg-accent/15 px-1 text-[8.5px] text-accent">START</span>
          )}
          {sessionRunning && <span className="h-1.5 w-1.5 bg-accent animate-pulse" />}
          <ChevronUp className="h-3 w-3 text-dim" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'pointer-events-auto absolute bottom-0 left-1/2 -translate-x-1/2 z-50 flex flex-col border border-b-0 border-line bg-black/95 font-mono select-none shadow-[0_-12px_40px_rgba(0,0,0,0.95)] backdrop-blur-md transition-all duration-200 ease-out',
        'w-[min(760px,calc(100%-24px))]',
        tall ? 'h-[min(560px,74vh)]' : 'h-[min(360px,50vh)]',
        className
      )}
    >
      {/* HEADER STRIP */}
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-line/40 bg-subtle/50 px-2.5 text-[10px] font-bold uppercase tracking-wider text-dim">
        <div className="flex min-w-0 items-center gap-1.5">
          <MessageSquare className={cn('h-3 w-3 shrink-0', sessionRunning ? 'text-accent animate-pulse' : 'text-cyan')} />
          <span className="text-white">{gameplaySession ? 'GAMEPLAY' : 'PLAYER CHAT'}</span>
          {boundAgent && (
            <span className="truncate font-normal text-cyan">
              · {boundAgent.name}
            </span>
          )}
          {targetName && (
            <span className="truncate font-normal text-dim">
              · <span className="text-accent">{targetName}</span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {gameplaySession && (
            <>
              <button
                type="button"
                onClick={() => void rolloverGameplaySession(gameplaySession.id).catch(failed('Could not roll over Gameplay Chat'))}
                title="Continue in a fresh session (zero compaction: keeps live state + last exchange)"
                className="border border-line/40 bg-black/40 p-0.5 text-dim hover:border-ok hover:text-ok transition-colors cursor-pointer"
              >
                <RefreshCw className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                onClick={() => openChat(gameplaySession.id)}
                title="Open bound Gameplay Chat"
                className="border border-line/40 bg-black/40 p-0.5 text-dim hover:border-cyan hover:text-cyan transition-colors cursor-pointer"
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                onClick={handleDetach}
                title="Detach Gameplay Chat from this world"
                className="border border-line/40 bg-black/40 p-0.5 text-dim hover:border-alert hover:text-alert transition-colors cursor-pointer"
              >
                <Unlink className="h-2.5 w-2.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setTall(!tall)}
            className="border border-line/40 bg-black/40 px-1.5 py-0.5 text-[8.5px] text-dim hover:border-accent hover:text-white transition-colors cursor-pointer"
          >
            {tall ? 'COMPACT' : 'TALL'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Collapse chat to bottom bar (Esc)"
            className="flex items-center gap-0.5 border border-line/40 bg-black/40 px-1.5 py-0.5 text-[8.5px] text-dim hover:border-accent hover:text-white transition-colors cursor-pointer"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
          {/* GAMEPLAY CHAT ONBOARDING STRIP (WHEN NO AGENT IS BOUND TO THIS WORLD) */}
          {worldId && !gameplaySession && (
            <div className="flex flex-col gap-1.5 border-b border-accent/40 bg-accent/10 px-2 py-1.5 text-[10px]">
              <div className="flex items-center gap-1.5">
                <select
                  value={effectiveAgentId}
                  onChange={(e) => setPickedAgentId(e.target.value)}
                  aria-label="Choose agent for Gameplay Chat"
                  className="h-6 min-w-0 flex-1 border border-line/70 bg-black/90 px-1.5 font-mono text-[10px] text-white outline-none focus:border-accent"
                >
                  {agents.length === 0 && presets.length === 0 ? (
                    <option value="">No agents available</option>
                  ) : (
                    <>
                      {presets
                        .filter((p) => !agents.some((a) => a.id === p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Default)
                          </option>
                        ))}
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Play className="h-2.5 w-2.5" />}
                  onClick={handleStartGameplay}
                  disabled={!effectiveAgentId || starting}
                  className="h-6 shrink-0 px-2 text-[9.5px]"
                >
                  {starting ? 'STARTING…' : 'START GAMEPLAY'}
                </Button>
              </div>
              <ModelReadyControl agent={agents.find((a) => a.id === effectiveAgentId) ?? null} compact />
            </div>
          )}
          {/* CHAT LOG STREAM */}
          <div ref={scrollRef} className="flex min-h-[60px] flex-1 flex-col gap-1.5 overflow-y-auto bg-black/40 p-2 text-[11px] select-text">
            {gameplaySession && sessionMessages ? (
              sessionMessages.length === 0 ? (
                <span className="text-[10px] text-faint">
                  {sessionRunning ? `${boundAgent?.name ?? 'Agent'} is narrating the opening scene…` : 'Gameplay Chat ready. Speak or act to begin.'}
                </span>
              ) : (
                sessionMessages.map((m) => {
                  const body = messageTextOf(m)
                  const isAssistant = m.role === 'assistant'
                  const hasThought = m.parts.some((p) => p.type === 'thought')
                  if (!body && !isAssistant) return null
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        'border-l-2 p-1.5 leading-relaxed',
                        isAssistant ? 'border-accent bg-accent/5 text-white/95' : 'border-cyan bg-cyan/5 text-cyan'
                      )}
                    >
                      <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider text-faint">
                        <span>{isAssistant ? (boundAgent?.name ?? 'DM') : playerName}</span>
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="mt-0.5 text-[11px]">
                        {body ? (
                          isAssistant ? (
                            <Markdown text={body} className="font-sans text-[11.5px] leading-relaxed text-neutral-100" />
                          ) : (
                            <span className="whitespace-pre-wrap">{body}</span>
                          )
                        ) : (
                          <span className="animate-pulse text-[10px] text-dim">
                            {hasThought ? 'Thinking…' : 'Narrating…'}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )
            ) : chatLog.length === 0 ? (
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
              {sessionRunning ? (
                <Button
                  size="sm"
                  variant="badge"
                  onClick={handleAbort}
                  className="h-7 border-alert/70 px-2 text-[10px] text-alert hover:bg-alert/15"
                >
                  <Square className="h-2.5 w-2.5" />
                  <span>STOP</span>
                </Button>
              ) : (
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
              )}
            </div>
          </div>
        </div>
    </div>
  )
}
