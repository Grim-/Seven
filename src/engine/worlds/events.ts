import path from 'node:path'
import { EventEmitter } from 'node:events'
import { notFound } from '@shared/errors'
import { toId } from '@shared/ids'
import {
  cleanWorldEvent,
  resolveWorldEventState,
  scoreWorldEventOutcomes,
  type ResolvedWorldEvent,
  type WorldEvent,
  type WorldEventResolution,
  type WorldEventRuntime,
  type WorldEventStatus,
  eventKey,
  eventPlace,
  triggerMet
} from '@shared/game/worldEvents'
import { worldLink } from '@shared/world'
import { triggerActionEffects } from '@shared/game/triggerActions'
import type { ComponentDef } from '@shared/game/core'
import { readJson, writeJson } from '../util/fs'
import { noteFailure } from '../util/report'
import { ToolError } from '../tools/types'
import { almanacs } from '../almanac/store'
import { factions } from '../factions/store'
import { triggerActionsStore } from '../triggerActions/store'
import { runEffects } from '../effects/run'
import { saves } from './saves'
import { worlds } from './store'

export class WorldEventStore extends EventEmitter {
  fileFor(worldId: string): string {
    return path.join(worlds.folder(worldId), 'events.json')
  }

  listDefinitions(worldId: string): WorldEvent[] {
    if (!worlds.exists(worldId)) return []
    const raw = readJson<unknown[]>(this.fileFor(worldId), [])
    if (!Array.isArray(raw)) return []
    return raw
      .map((item) =>
        cleanWorldEvent({
          ...(typeof item === 'object' && item ? (item as Record<string, unknown>) : {}),
          worldId
        })
      )
      .filter((e): e is WorldEvent => e !== null)
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  writeDefinitions(worldId: string, list: WorldEvent[]): void {
    const normalized = list
      .map((e) => cleanWorldEvent({ ...e, worldId }))
      .filter((e): e is WorldEvent => e !== null)
      .sort((a, b) => a.title.localeCompare(b.title))
    writeJson(this.fileFor(worldId), normalized)
    this.emit('changed')
  }

  private mergeRuntime(ev: WorldEvent, worldOverride?: string | null): ResolvedWorldEvent {
    const targetWorld = worldOverride || ev.worldId
    const save = targetWorld ? saves.current(targetWorld) : null
    const rt = save?.eventStates?.[ev.id]
    return resolveWorldEventState(ev, rt, Boolean(save))
  }

  private allDefinitions(worldId?: string | null): WorldEvent[] {
    if (worldId) return this.listDefinitions(worldId)
    return worlds
      .list()
      .flatMap((w) => this.listDefinitions(w.id))
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  list(worldId?: string | null): ResolvedWorldEvent[] {
    return this.allDefinitions(worldId).map((e) => this.mergeRuntime(e, e.worldId))
  }

  get(id: string, worldId?: string | null): ResolvedWorldEvent {
    const cleanId = eventKey(id)
    const hit = this.allDefinitions(worldId).find((e) => e.id === cleanId || e.id === id)
    if (!hit) throw notFound(new ToolError(`No world event "${cleanId}". Link events as @world:<world>/event/<id>.`))
    return this.mergeRuntime(hit, worldId ?? hit.worldId)
  }

  find(ref: string, worldId?: string | null): ResolvedWorldEvent | null {
    const trimmed = ref.trim().replace(/^"|"$/g, '')
    const parts = trimmed.split('/')
    const inferredWorld = parts.length >= 3 ? parts[0] : (worldId ?? null)
    const clean = eventKey(trimmed)
    const id = toId(clean)
    const all = this.allDefinitions(inferredWorld)
    const hit = all.find((e) => e.id === id || e.id === clean) ?? all.find((e) => toId(e.title) === id) ?? null
    return hit ? this.mergeRuntime(hit, hit.worldId) : null
  }

  save(raw: unknown, previousId: string | null = null): WorldEvent {
    const ev = cleanWorldEvent({
      ...(typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {}),
      updatedAt: Date.now()
    })
    if (!ev) throw new ToolError('Give the world event a title.')
    if (!ev.worldId || !worlds.exists(ev.worldId)) {
      throw new ToolError('Pick a valid world for this event.')
    }
    const prevClean = previousId ? eventKey(previousId) : null
    const rest = this.listDefinitions(ev.worldId).filter((x) => x.id !== ev.id && x.id !== prevClean)
    this.writeDefinitions(ev.worldId, [...rest, ev])
    return ev
  }

  remove(id: string, worldId?: string | null): void {
    const parts = id.split('/')
    const targetWorld = worldId || (parts.length >= 3 ? parts[0] : null)
    const cleanId = eventKey(id)
    if (targetWorld) {
      const all = this.listDefinitions(targetWorld)
      if (!all.some((e) => e.id === cleanId)) throw notFound(new ToolError(`No world event "${cleanId}".`))
      this.writeDefinitions(
        targetWorld,
        all.filter((e) => e.id !== cleanId)
      )
      return
    }
    for (const w of worlds.list()) {
      const all = this.listDefinitions(w.id)
      if (all.some((e) => e.id === cleanId)) {
        this.writeDefinitions(
          w.id,
          all.filter((e) => e.id !== cleanId)
        )
        return
      }
    }
    throw notFound(new ToolError(`No world event "${cleanId}".`))
  }

  setStatus(id: string, status: WorldEventStatus, worldId?: string | null): ResolvedWorldEvent {
    const ev = this.get(id, worldId)
    const targetWorld = worldId || ev.worldId
    const save = targetWorld ? saves.current(targetWorld) : null
    if (!save) throw new ToolError('Start or select a save before changing a world event’s play state.')
    const prev = save.eventStates?.[ev.id]
    const nextRuntime: WorldEventRuntime =
      status === 'dormant'
        ? { status: 'dormant' }
        : {
            ...(prev ?? { status }),
            status,
            ...(status === 'active' ? { activatedAt: prev?.activatedAt ?? save.clock?.time ?? Date.now() } : {})
          }
    saves.change(save.id, (s) => ({
      ...s,
      eventStates: {
        ...(s.eventStates ?? {}),
        [ev.id]: nextRuntime
      }
    }))
    this.emit('changed')
    return resolveWorldEventState(ev, nextRuntime, true)
  }

  resolve(
    id: string,
    opts: { worldId?: string | null; outcomeId?: string | null; transcriptSummary?: string | null } = {}
  ): ResolvedWorldEvent {
    const ev = this.get(id, opts.worldId)
    const targetWorld = opts.worldId || ev.worldId
    const save = targetWorld ? saves.current(targetWorld) : null
    if (!save) throw new ToolError('Start or select a save before resolving a world event.')

    let chosen = opts.outcomeId ? (ev.outcomes.find((o) => o.id === opts.outcomeId) ?? null) : null
    let mode: 'scored' | 'direct' = chosen ? 'direct' : 'scored'
    let breakdown: WorldEventResolution['breakdown'] = []

    if (!chosen) {
      const scored = scoreWorldEventOutcomes(ev, {
        flags: save.flags ?? {},
        factions: factions.list(targetWorld, 'play')
      })
      chosen = scored.winner
      breakdown = scored.breakdown
      mode = 'scored'
    }
    if (!chosen) throw new ToolError(`World event "${ev.title}" has no outcomes defined.`)

    const allEffects: ComponentDef[] = [...chosen.effects]
    for (const actionId of chosen.triggerActionIds) {
      const stored = triggerActionsStore.find(actionId)
      if (stored) allEffects.push(...triggerActionEffects(stored))
    }

    if (allEffects.length) runEffects({ user: null, target: null, defs: allEffects, world: targetWorld })

    const resolution: WorldEventResolution = {
      outcomeId: chosen.id,
      outcomeLabel: chosen.label,
      resolvedAt: Date.now(),
      mode,
      breakdown,
      ...(opts.transcriptSummary?.trim() ? { transcriptSummary: opts.transcriptSummary.trim() } : {})
    }

    const nextRuntime: WorldEventRuntime = {
      status: 'resolved',
      ...(ev.activatedAt !== undefined ? { activatedAt: ev.activatedAt } : {}),
      resolution
    }

    saves.change(save.id, (s) => ({
      ...s,
      eventStates: {
        ...(s.eventStates ?? {}),
        [ev.id]: nextRuntime
      }
    }))

    if (save.almanacId) {
      try {
        const who = ev.participants
          .flatMap((p) => {
            if (p.kind === 'sheet' && p.refId) return [`@sheet:${p.refId}`]
            if (p.kind === 'faction' && p.characters?.length) return p.characters.map((c) => `@sheet:${c}`)
            return p.name ? [p.name] : []
          })
          .filter(Boolean)
        almanacs.recordEntry(save.almanacId, {
          kind: 'world',
          title: `${ev.title} — ${chosen.label}`,
          summary: chosen.known || chosen.label,
          outcome: chosen.known,
          secret: [chosen.summary, opts.transcriptSummary?.trim() ?? ''].filter(Boolean).join('\n\n'),
          where: eventPlace(ev) ? worldLink(targetWorld, 'place', eventPlace(ev)) : '',
          who
        })
      } catch (err) {
        noteFailure(err, 'almanac', 'Could not record resolved World Event to Almanac')
      }
    }
    this.emit('changed')

    return resolveWorldEventState(ev, nextRuntime, true)
  }

  checkTriggers(worldId: string): void {
    const save = saves.current(worldId)
    if (!save) return
    const state = { time: save.clock?.time ?? null, flags: save.flags }
    for (const ev of this.list(worldId)) {
      if (ev.status === 'dormant' && triggerMet(ev, state)) this.setStatus(ev.id, 'active', worldId)
    }
  }
}

export const worldEvents = new WorldEventStore()
