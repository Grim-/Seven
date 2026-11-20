import path from 'node:path'
import { EventEmitter } from 'node:events'
import { notFound } from '@shared/errors'
import { toId } from '@shared/ids'
import {
  cleanWorldEvent,
  scoreWorldEventOutcomes,
  type ResolvedWorldEvent,
  type WorldEvent,
  type WorldEventResolution,
  type WorldEventStatus
} from '@shared/game/worldEvents'
import { triggerActionEffects } from '@shared/game/triggerActions'
import type { ComponentDef } from '@shared/game/core'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'
import { noteFailure } from '../util/report'
import { ToolError } from '../tools/types'
import { almanacs } from '../almanac/store'
import { triggerActionsStore } from '../triggerActions/store'
import { saves } from './saves'

const FILE = path.join(dataRoot, 'world-events.json')

function applyOutcomeEffects(saveId: string, effects: ComponentDef[]): void {
  for (const eff of effects) {
    if (eff.type === 'world.setFlag') {
      const flag = String(eff.flag ?? '').trim()
      if (!flag) continue
      const rawVal = eff.value
      const val: string | number | boolean =
        rawVal === 'true'
          ? true
          : rawVal === 'false'
            ? false
            : typeof rawVal === 'number' || typeof rawVal === 'boolean'
              ? rawVal
              : String(rawVal ?? true)
      saves.change(saveId, (s) => ({ ...s, flags: { ...s.flags, [flag]: val } }))
    }
  }
}

export class WorldEventStore extends EventEmitter {
  constructor(private readonly file: string = FILE) {
    super()
  }

  private rawList(): WorldEvent[] {
    const raw = readJson<unknown[]>(this.file, [])
    if (!Array.isArray(raw)) return []
    return raw
      .map(cleanWorldEvent)
      .filter((e): e is WorldEvent => e !== null)
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  private mergeRuntime(ev: WorldEvent, worldOverride?: string | null): ResolvedWorldEvent {
    const targetWorld = worldOverride || ev.worldId
    const save = targetWorld ? saves.current(targetWorld) : null
    const rt = save?.eventStates?.[ev.id]
    return {
      ...ev,
      status: rt?.status ?? ev.status,
      resolution: rt?.resolution ?? null
    }
  }

  list(worldId?: string | null): ResolvedWorldEvent[] {
    const all = this.rawList()
    const filtered = worldId ? all.filter((e) => !e.worldId || e.worldId === worldId) : all
    return filtered.map((e) => this.mergeRuntime(e, worldId))
  }

  get(id: string, worldId?: string | null): ResolvedWorldEvent {
    const hit = this.rawList().find((e) => e.id === id)
    if (!hit) throw notFound(new ToolError(`No world event "${id}". find with kind world_event lists them.`))
    return this.mergeRuntime(hit, worldId)
  }

  find(ref: string, worldId?: string | null): ResolvedWorldEvent | null {
    const clean = ref.trim().replace(/^@?world_event:/i, '').replace(/^"|"$/g, '')
    const id = toId(clean)
    const all = this.rawList()
    const hit = all.find((e) => e.id === id || e.id === clean) ?? all.find((e) => toId(e.title) === id) ?? null
    return hit ? this.mergeRuntime(hit, worldId) : null
  }

  save(raw: unknown, previousId: string | null = null): WorldEvent {
    const ev = cleanWorldEvent({ ...(typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {}), updatedAt: Date.now() })
    if (!ev) throw new ToolError('Give the world event a title.')
    this.write([...this.rawList().filter((x) => x.id !== ev.id && x.id !== previousId), ev])
    return ev
  }

  remove(id: string): void {
    const all = this.rawList()
    if (!all.some((e) => e.id === id)) throw notFound(new ToolError(`No world event "${id}".`))
    this.write(all.filter((e) => e.id !== id))
  }

  setStatus(id: string, status: WorldEventStatus, worldId?: string | null): ResolvedWorldEvent {
    const ev = this.get(id, worldId)
    const targetWorld = worldId || ev.worldId
    const save = targetWorld ? saves.current(targetWorld) : null
    if (save) {
      saves.change(save.id, (s) => ({
        ...s,
        eventStates: {
          ...(s.eventStates ?? {}),
          [id]: { ...(s.eventStates?.[id] ?? { status }), status }
        }
      }))
      this.emit('changed')
    } else {
      this.save({ ...ev, status }, ev.id)
    }
    return { ...ev, status }
  }

  resolve(
    id: string,
    opts: { worldId?: string | null; outcomeId?: string | null; transcriptSummary?: string | null } = {}
  ): ResolvedWorldEvent {
    const ev = this.get(id, opts.worldId)
    const targetWorld = opts.worldId || ev.worldId
    const save = targetWorld ? saves.current(targetWorld) : null

    let chosen = opts.outcomeId ? (ev.outcomes.find((o) => o.id === opts.outcomeId) ?? null) : null
    let mode: 'scored' | 'direct' = chosen ? 'direct' : 'scored'
    let breakdown: WorldEventResolution['breakdown'] = []

    if (!chosen) {
      const scored = scoreWorldEventOutcomes(ev, { flags: save?.flags ?? {} })
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

    if (save) applyOutcomeEffects(save.id, allEffects)

    const resolution: WorldEventResolution = {
      outcomeId: chosen.id,
      outcomeLabel: chosen.label,
      resolvedAt: Date.now(),
      mode,
      breakdown,
      ...(opts.transcriptSummary?.trim() ? { transcriptSummary: opts.transcriptSummary.trim() } : {})
    }

    if (save) {
      saves.change(save.id, (s) => ({
        ...s,
        eventStates: {
          ...(s.eventStates ?? {}),
          [id]: { status: 'resolved', resolution }
        }
      }))
      if (save.almanacId) {
        try {
          almanacs.recordEntry(save.almanacId, {
            kind: 'world',
            title: `${ev.title} — ${chosen.label}`,
            summary: chosen.summary || ev.premise || ev.title,
            outcome: chosen.summary || chosen.label,
            where: ev.scope.level === 'place' && ev.scope.refId ? `@place:${ev.scope.refId}` : ''
          })
        } catch (err) {
          noteFailure(err, 'almanac', 'Could not record resolved World Event to Almanac')
        }
      }
      this.emit('changed')
    } else {
      this.save({ ...ev, status: 'resolved' }, ev.id)
    }

    return { ...ev, status: 'resolved', resolution }
  }

  private write(list: WorldEvent[]): void {
    writeJson(this.file, list)
    this.emit('changed')
  }
}

export const worldEvents = new WorldEventStore()
