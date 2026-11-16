import { Component, registerComponent, type GameEntity, type TooltipRow } from '../core'
import { Buffs } from './Buffs'

export interface TagSource {
  grantedTags(): string[]
}

function hasGrantedTags(comp: Component): comp is Component & TagSource {
  return 'grantedTags' in comp && typeof (comp as unknown as TagSource).grantedTags === 'function'
}

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase()
}

export function allEntityTags(entity: GameEntity | null | undefined): string[] {
  if (!entity) return []
  const seen = new Map<string, string>()
  const push = (tag: string): void => {
    const trimmed = tag.trim()
    if (!trimmed) return
    const key = normalizeTag(trimmed)
    if (!seen.has(key)) seen.set(key, trimmed)
  }

  const direct = entity.comp(Tags)
  if (direct) for (const t of direct.list()) push(t)

  for (const comp of entity.comps) {
    if (comp === direct) continue
    if (hasGrantedTags(comp)) {
      for (const t of comp.grantedTags()) push(t)
    }
    for (const child of comp.comps) {
      if (hasGrantedTags(child)) {
        for (const t of child.grantedTags()) push(t)
      }
    }
  }

  const buffs = entity.comp(Buffs)
  if (buffs) {
    for (const buff of buffs.held) {
      for (const tag of (buff.params.tags as string[]) ?? []) push(tag)
    }
  }

  return [...seen.values()]
}

export function entityHasTag(entity: GameEntity | null | undefined, tag: string): boolean {
  const wanted = normalizeTag(tag)
  if (!wanted) return false
  return allEntityTags(entity).some((t) => normalizeTag(t) === wanted)
}

export class Tags extends Component {
  static readonly type: string = 'tags'
  static readonly LABEL: string = 'Tags'
  static readonly ICON: string = 'Tags'
  static readonly DESCRIPTION: string = 'Keyword labels on an entity, checked by conditions, classes, and traits.'
  static readonly PARAMS = {
    values: { kind: 'list' as const, default: [], description: 'Tags on this entity, e.g. undead, noble, martial.' }
  }

  canApply(host: Component | GameEntity): true | string {
    return 'catalog' in host ? true : 'tags belong on an entity'
  }

  list(): string[] {
    return ((this.params.values as string[]) ?? []).map((t) => String(t).trim()).filter(Boolean)
  }

  has(tag: string): boolean {
    const wanted = normalizeTag(tag)
    return wanted ? this.list().some((t) => normalizeTag(t) === wanted) : false
  }

  addTag(tag: string): boolean {
    const trimmed = tag.trim()
    if (!trimmed || this.has(trimmed)) return false
    this.params.values = [...this.list(), trimmed]
    return true
  }

  removeTag(tag: string): boolean {
    const wanted = normalizeTag(tag)
    const next = this.list().filter((t) => normalizeTag(t) !== wanted)
    if (next.length === this.list().length) return false
    this.params.values = next
    return true
  }

  tooltipRows(): TooltipRow[] {
    const tags = allEntityTags(this.entity)
    return tags.length ? [{ label: 'Tags', value: tags.join(', ') }] : []
  }
}

registerComponent(Tags)
