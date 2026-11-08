import { SignalBus } from './signals'
import type { Component, ComponentRecord, SignalSource } from './Component'
import { createComponent, restoreComponent, type ComponentDef } from './registry'
import type { Catalog } from './catalog'

export interface TemplateRef {
  kind: string
  id: string
}

export interface Template {
  ref: TemplateRef
  name: string
  components: ComponentDef[]
}

export interface EntityRecord {
  uid: string
  template: TemplateRef
  name: string
  comps: ComponentRecord[]
}

export interface EntityLookup {
  find(uid: string): GameEntity | null
}

export class GameEntity implements SignalSource {
  readonly signals = new SignalBus()
  world: EntityLookup | null = null
  comps: Component[] = []
  private live = false

  constructor(
    readonly uid: string,
    readonly template: TemplateRef,
    public name: string,
    readonly catalog: Catalog
  ) {}

  comp<T extends Component>(Type: abstract new (...args: never[]) => T): T | null {
    for (const c of this.comps) if (c instanceof Type) return c
    return null
  }

  add(comp: Component): boolean {
    if (comp.canApply(this) !== true) return false
    comp.host = this
    this.comps.push(comp)
    if (this.live) comp.attach()
    return true
  }

  remove(comp: Component): boolean {
    const i = this.comps.indexOf(comp)
    if (i < 0) return false
    this.comps.splice(i, 1)
    comp.detach()
    comp.host = null
    return true
  }

  emit(signal: string, payload: Record<string, unknown> = {}): void {
    this.signals.emit(signal, { ...payload, entity: this.uid })
  }

  tickSim(seconds: number): void {
    for (const c of [...this.comps]) c.tickSim(seconds)
  }

  modifyStat(domain: string, key: string, value: number): number {
    let out = value
    for (const c of this.comps) out = c.modifyStat(domain, key, out)
    return out
  }

  modifyStatLate(domain: string, key: string, value: number): number {
    let out = value
    for (const c of this.comps) out = c.modifyStatLate(domain, key, out)
    return out
  }

  start(): void {
    if (this.live) return
    this.live = true
    for (const c of this.comps) c.attach()
  }

  stop(): void {
    for (const c of this.comps) c.detach()
    this.live = false
    this.signals.clear()
  }

  toRecord(): EntityRecord {
    return { uid: this.uid, template: { ...this.template }, name: this.name, comps: this.comps.map((c) => c.toJSON()) }
  }

  static fromRecord(record: EntityRecord, catalog: Catalog): GameEntity {
    const entity = new GameEntity(record.uid, record.template, record.name, catalog)
    for (const r of record.comps) {
      const comp = restoreComponent(r)
      if (comp) entity.add(comp)
    }
    return entity
  }
}

export function spawn(template: Template, catalog: Catalog): GameEntity {
  const entity = new GameEntity(crypto.randomUUID(), template.ref, template.name, catalog)
  for (const def of template.components) {
    const comp = createComponent(def)
    if (comp) entity.add(comp)
  }
  entity.start()
  return entity
}
