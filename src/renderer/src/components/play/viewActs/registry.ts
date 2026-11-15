import type { ViewEvent } from '@shared/effects'
import type { Catalog } from '@shared/game/core'
import type { GameSave } from '@shared/game/save'
import { mapArea, type MapData } from '@shared/maps'
import type { Point } from '@shared/shapes'
import type { MapToken } from '../../maps/TokenLayer'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'

export interface WorldViewHost {
  world: string
  map: MapData
  save: GameSave | null
  catalog: Catalog | null
  tokens: MapToken[]
  goTo: (token: string, map: string, place: string) => Promise<unknown>
  stand: (token: string, at: Point) => Promise<unknown>
}

export interface ViewActContext {
  host: WorldViewHost
  title: string
  token: MapToken | null
}

export type ViewAct = (data: Record<string, unknown>, ctx: ViewActContext) => Promise<unknown> | void
export type AmbientViewAct = (data: Record<string, unknown>, ctx: { target: string | null; token: MapToken | null }) => void

const acts = new Map<string, ViewAct>()
const ambientActs = new Map<string, AmbientViewAct>()
let current: (() => WorldViewHost) | null = null

export function registerViewAct(kind: string, act: ViewAct): void {
  acts.set(kind, act)
}

export function registerAmbientAct(kind: string, act: AmbientViewAct): void {
  ambientActs.set(kind, act)
}

export function setWorldViewHost(get: (() => WorldViewHost) | null): void {
  current = get
}

export function spotBeside(host: WorldViewHost, token: MapToken | null): Point {
  if (token) return { x: token.at.x + host.map.tile.w, y: token.at.y }
  const area = mapArea(host.map)
  return { x: Math.round(area.w / 2), y: Math.round(area.h / 2) }
}

const tokenOf = (host: WorldViewHost, id: string | null | undefined): MapToken | null => (id ? (host.tokens.find((t) => t.visitor.token === id || t.visitor.sheet === id) ?? null) : null)

export async function playViewEvents(events: ViewEvent[], title: string, world: string | null): Promise<void> {
  if (!events.length) return
  const host = current?.() ?? null
  const worldEvents: ViewEvent[] = []
  for (const event of events) {
    const ambient = ambientActs.get(event.kind)
    if (ambient) ambient(event.data, { target: event.target ?? null, token: host && host.world === world ? tokenOf(host, event.target) : null })
    else worldEvents.push(event)
  }
  if (!worldEvents.length) return
  if (!host || host.world !== world) return void toast.info(title, 'This only happens in the world.')
  for (const event of worldEvents) {
    const act = acts.get(event.kind)
    if (!act) {
      toast.info(title, 'Not carried out in the world yet.')
      continue
    }
    await Promise.resolve(act(event.data, { host, title, token: tokenOf(host, event.target) })).catch(failed(`Could not carry out ${title}`))
  }
}
