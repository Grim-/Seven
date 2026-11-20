import type { SessionMeta } from '@shared/types'
import { isGameplayScene } from '@shared/almanac'
import { engine } from '../../lib/ipc'
import { openChat } from '../../lib/conversation'
import { failed } from '../../lib/notify'
import { useSessions } from '../../store/sessions'
import { toast } from '../../store/toasts'

export interface StartGameplayOptions {
  agentId: string
  presetId?: string | null
  worldId: string
  worldName?: string | null
  saveId?: string | null
  mapId?: string | null
  placeKey?: string | null
  placeName?: string | null
  playerSheet?: string | null
  playerName?: string | null
  openInChat?: boolean
}

/** Finds the active Gameplay Chat session bound to a given world (preferring exact saveId match). */
export function findGameplaySession(
  list: SessionMeta[],
  worldId: string | null | undefined,
  saveId?: string | null
): SessionMeta | null {
  if (!worldId) return null
  const match = (strictSave: boolean) =>
    list.find((s) => {
      if (!isGameplayScene(s.scene)) return false
      if (s.scene?.worldId !== worldId) return false
      if (strictSave && saveId) return s.scene.saveId === saveId
      return !saveId || !s.scene.saveId || s.scene.saveId === saveId
    }) ?? null
  return (saveId ? match(true) : null) ?? match(false)
}

/** Creates a bound Gameplay Chat session (or reuses an existing one for the same world/save), freezes its world instructions, and dispatches the opening scene prompt. */
export async function startGameplaySession(opts: StartGameplayOptions): Promise<SessionMeta> {
  const existing = findGameplaySession(useSessions.getState().list, opts.worldId, opts.saveId)
  if (existing) {
    await useSessions.getState().load(existing.id)
    if (opts.openInChat) openChat(existing.id)
    return existing
  }

  const resolvedAgentId = opts.presetId
    ? (await engine('agents.ensurePreset', { id: opts.presetId })).id
    : opts.agentId

  const label = opts.worldName?.trim() || opts.worldId
  const meta = await engine('sessions.bindGameplay', {
    agentId: resolvedAgentId,
    worldId: opts.worldId,
    saveId: opts.saveId ?? null,
    mapId: opts.mapId ?? null,
    placeKey: opts.placeKey ?? null,
    playerSheet: opts.playerSheet ?? null,
    title: `${label} · Gameplay`
  })

  const where = opts.placeKey
    ? opts.placeName
      ? `${opts.placeName} (@place:${opts.placeKey})`
      : `@place:${opts.placeKey}`
    : null
  const who = opts.playerSheet
    ? `${opts.playerName ?? opts.playerSheet} (@sheet:${opts.playerSheet})`
    : opts.playerName ?? null

  const kickOff = [
    `Begin the scene${where ? ` at ${where}` : ''}.`,
    ...(who ? [`The player is ${who}.`] : []),
    'Describe what they perceive right here and wait for their action.'
  ].join(' ')

  await useSessions.getState().load(meta.id)
  void engine('sessions.send', { id: meta.id, text: kickOff }).catch(failed('Could not send opening scene prompt'))

  if (opts.openInChat) openChat(meta.id)
  toast.success('Gameplay Chat Started', `Bound to ${label}`)
  return meta
}

/** Detaches a Gameplay Chat from its world/scene binding, turning it back into a regular chat with history preserved. */
export async function detachGameplaySession(sessionId: string): Promise<SessionMeta> {
  const updated = await engine('sessions.detachGameplay', { id: sessionId })
  toast.info('Detached from World', `"${updated.title}" is now a regular chat.`)
  return updated
}

/** Zero-compaction rollover: spawns a fresh Gameplay Chat with live world state + verbatim last user/agent exchange only. */
export async function rolloverGameplaySession(sessionId: string, openInChat = false): Promise<SessionMeta> {
  const next = await engine('sessions.rolloverGameplay', { id: sessionId })
  await useSessions.getState().load(next.id)
  if (openInChat) openChat(next.id)
  toast.success('Fresh Gameplay Session', `Continuing in "${next.title}" (last exchange preserved)`)
  return next
}
