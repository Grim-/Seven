import { CHARACTER_TEMPLATES, ITEM_TEMPLATES, catalogFrom, defType, misfitsOf } from '@shared/game/defs'
import {
  Abilities,
  CharacterClass,
  Classes,
  Health,
  Inventory,
  Progression,
  Skills,
  Tags,
  Traits,
  allEntityTags,
  ensureCharacterDefaults,
  usableAbilities,
  type PendingClassUnlock
} from '@shared/game/components'
import type { Point } from '@shared/shapes'
import type { StoryMemory } from '@shared/story'
import { GameEntity, createComponent, spawn, type Catalog, type EntityRecord } from '@shared/game/core'
import { getSheet, registerSheetSection, setGame, setMind } from '../../engine/library/sheets'
import { ToolError } from '../../engine/tools/types'
import { noteFailure } from '../../engine/util/report'
import { gameDefs } from './store'
import { setEffectCatalog } from '../../engine/effects/catalog'
import { saveInPlay } from '../../engine/worlds/playLayer'
import { saves } from '../../engine/worlds/saves'

function catalog(): Catalog {
  return catalogFrom(gameDefs.catalog())
}

setEffectCatalog(catalog)

interface ProgressionEventEntry {
  summary: string
  detail?: string
  tags: string[]
}

function appendStoryEntries(sheetId: string, events: ProgressionEventEntry[]): void {
  if (!events.length) return
  try {
    const s = getSheet(sheetId)
    const now = new Date()
    const when = now.toISOString().slice(0, 10)
    const createdAt = now.toISOString()
    const added: StoryMemory[] = events.map((ev, i) => ({
      id: `prog:${Date.now()}:${i}:${Math.random().toString(36).slice(2, 6)}`,
      category: 'recent',
      summary: ev.summary,
      ...(ev.detail ? { detail: ev.detail } : {}),
      when,
      ...(s.story?.where ? { where: s.story.where } : {}),
      tags: ['progression', ...ev.tags],
      createdAt,
      updatedAt: createdAt
    }))
    const prev = s.mind?.memories ?? []
    setMind(s.id, { ...(s.mind ?? {}), memories: [...prev, ...added] })
  } catch (err) {
    noteFailure(err, 'game', 'Could not write progression event to Story Sheet')
  }
}

export function diffAndLogProgression(
  sheetId: string,
  beforeRecord: EntityRecord | null | undefined,
  afterRecord: EntityRecord | null | undefined,
  cat: Catalog,
  extra: ProgressionEventEntry[] = []
): ProgressionEventEntry[] {
  const events: ProgressionEventEntry[] = [...extra]
  if (beforeRecord && afterRecord) {
    const before = GameEntity.fromRecord(beforeRecord, cat)
    const after = GameEntity.fromRecord(afterRecord, cat)

    const bLevel = before.comp(Progression)?.level ?? 1
    const aLevel = after.comp(Progression)?.level ?? 1
    if (aLevel > bLevel) {
      events.push({ summary: `Reached character level ${aLevel}`, detail: `Advanced from level ${bLevel} to ${aLevel}.`, tags: ['level-up'] })
    }

    const bClasses = new Map((before.comp(Classes)?.held ?? []).map((c) => [c.id, c]))
    const aClasses = new Map((after.comp(Classes)?.held ?? []).map((c) => [c.id, c]))
    for (const [id, cls] of aClasses) {
      const prev = bClasses.get(id)
      if (!prev) {
        events.push({ summary: `Gained class: ${cls.title} (Lv ${cls.level})`, tags: ['class', 'class-gained'] })
      } else {
        if (cls.level > prev.level) {
          events.push({ summary: `${cls.title} reached level ${cls.level}`, tags: ['class', 'level-up'] })
        }
        const wasActive = prev.isActive()
        const nowActive = cls.isActive()
        if (wasActive && !nowActive) {
          const reasons = cls.restrictionReasons()
          events.push({
            summary: `${cls.title} became restricted`,
            detail: reasons.length ? `Unmet conditions: ${reasons.join('; ')}` : undefined,
            tags: ['class', 'class-restricted']
          })
        } else if (!wasActive && nowActive) {
          events.push({ summary: `${cls.title} restrictions cleared`, tags: ['class', 'class-restored'] })
        }
      }
    }
    for (const [id, prev] of bClasses) {
      if (!aClasses.has(id)) {
        events.push({ summary: `Lost class: ${prev.title}`, tags: ['class', 'class-lost'] })
      }
    }

    const bTraits = new Map((before.comp(Traits)?.held ?? []).map((t) => [t.id, t]))
    const aTraits = new Map((after.comp(Traits)?.held ?? []).map((t) => [t.id, t]))
    for (const [id, t] of aTraits) {
      if (!bTraits.has(id)) events.push({ summary: `Gained trait: ${t.title}`, tags: ['trait', 'trait-gained'] })
    }
    for (const [id, prev] of bTraits) {
      if (!aTraits.has(id)) events.push({ summary: `Lost trait: ${prev.title}`, tags: ['trait', 'trait-lost'] })
    }
  }
  appendStoryEntries(sheetId, events)
  return events
}

export function joinCharacter(sheet: string, template: string): EntityRecord {
  const s = getSheet(sheet)
  if (s.game) throw new ToolError(`${s.title} is already in the game.`)
  const cat = catalog()
  const made = cat.entity(CHARACTER_TEMPLATES, template)
  if (!made) throw new ToolError(`No character template "${template}".`)
  const entity = spawn({ ...made, name: s.title }, cat)
  ensureCharacterDefaults(entity)
  const record = entity.toRecord()
  entity.stop()
  setGame(s.id, record)
  return record
}

export function saveCharacter(sheet: string, record: EntityRecord): EntityRecord {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  if (record.uid !== s.game.uid) throw new ToolError(`That game record belongs to another character.`)
  const cat = catalog()
  const clean = GameEntity.fromRecord(record, cat).toRecord()
  setGame(s.id, clean)
  diffAndLogProgression(s.id, s.game, clean, cat)
  return clean
}

export function leaveCharacter(sheet: string): boolean {
  const s = getSheet(sheet)
  if (s.game) {
    try {
      const entity = GameEntity.fromRecord(s.game, catalog())
      entity.start()
      entity.destroy()
    } catch (err) {
      noteFailure(err, 'game', 'Could not clean up departing character entity')
    }
  }
  setGame(s.id, null)
  return true
}

registerSheetSection((sheet) => {
  if (!sheet.game) return null
  try {
    const entity = GameEntity.fromRecord(sheet.game, catalog())
    const prog = entity.comp(Progression)
    const classes = entity.comp(Classes)?.held ?? []
    const traits = entity.comp(Traits)?.held ?? []
    const skills = entity.comp(Skills)
    const tags = allEntityTags(entity)
    const lines: string[] = []
    if (prog) lines.push(`- Level ${prog.level} (${prog.xp}/${prog.xpNeeded()} XP)`)
    if (classes.length) {
      lines.push(
        `- Classes: ${classes.map((c) => `${c.title} Lv ${c.level}${c.isActive() ? '' : ' [restricted]'}`).join(', ')}`
      )
    }
    if (traits.length) {
      lines.push(`- Traits: ${traits.map((t) => `${t.title}${t.isActive() ? '' : ' [inactive]'}`).join(', ')}`)
    }
    if (skills && Object.keys(skills.ranks()).length) {
      lines.push(
        `- Skills: ${Object.entries(skills.ranks())
          .map(([k, v]) => `${k} ${v >= 0 ? `+${v}` : v}`)
          .join(', ')}`
      )
    }
    if (tags.length) lines.push(`- Tags: ${tags.join(', ')}`)
    for (const comp of entity.comps) {
      if (comp instanceof Progression || comp instanceof Classes || comp instanceof Traits || comp instanceof Skills || comp instanceof Tags) continue
      const rows = comp.tooltipRows()
      if (rows.length) lines.push(`- ${comp.type}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`)
    }
    return `## Game\n${lines.join('\n')}`
  } catch (err) {
    noteFailure(err, 'game', 'Could not render Game section on sheet')
    return null
  }
})

export function tickCharacters(sheets: string[], seconds: number): number {
  let ticked = 0
  for (const id of sheets) {
    try {
      const s = getSheet(id)
      if (!s.game) continue
      const entity = GameEntity.fromRecord(s.game, catalog())
      entity.start()
      entity.tickSim(seconds)
      const record = entity.toRecord()
      entity.stop()
      setGame(s.id, record)
      ticked++
    } catch (err) {
      noteFailure(err, 'game', `Could not advance timers for character ${id}`)
      continue
    }
  }
  return ticked
}

export function giveItem(sheet: string, item: string, count: number, gold: number): { given: number; gold: number } {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const cat = catalog()
  const entity = GameEntity.fromRecord(s.game, cat)
  const bag = entity.comp(Inventory)
  if (!bag) throw new ToolError(`${s.title} has no inventory.`)
  const def = item ? cat.template(ITEM_TEMPLATES, item) : null
  if (item && !def) throw new ToolError(`No item "${item}".`)
  const given = def ? bag.give(def, Math.max(1, Math.floor(count))) : 0
  if (gold > 0) bag.changeGold(gold)
  setGame(s.id, entity.toRecord())
  return { given, gold: gold > 0 ? gold : 0 }
}

export function changeHealth(sheet: string, delta: number): { from: number; to: number } {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const entity = GameEntity.fromRecord(s.game, catalog())
  const health = entity.comp(Health)
  if (!health) throw new ToolError(`${s.title} has no health.`)
  const from = health.get()
  health.set(from + delta)
  setGame(s.id, entity.toRecord())
  return { from, to: health.get() }
}

export function changeCreatureHealth(world: string, uid: string, delta: number): { from: number; to: number } {
  const save = saveInPlay(world, true)
  const creature = save?.creatures.find((c) => c.uid === uid)
  if (!save || !creature) throw new ToolError('That creature is not in this save.')
  const entity = GameEntity.fromRecord(creature, catalog())
  const health = entity.comp(Health)
  if (!health) throw new ToolError(`${creature.name} has no health.`)
  const from = health.get()
  health.set(from + delta)
  const record = entity.toRecord()
  saves.write({ ...save, creatures: save.creatures.map((c) => (c.uid === uid ? { ...record, faction: c.faction } : c)) })
  return { from, to: health.get() }
}

export function takeItem(sheet: string, item: string, count: number): number {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const entity = GameEntity.fromRecord(s.game, catalog())
  const bag = entity.comp(Inventory)
  if (!bag) throw new ToolError(`${s.title} has no inventory.`)
  let left = Math.max(1, Math.floor(count))
  for (const stack of bag.items.filter((i) => i.id === item)) left -= bag.take(stack, left)
  setGame(s.id, entity.toRecord())
  return Math.max(1, Math.floor(count)) - left
}

export function characterMisfits(sheet: string): string[] {
  const s = getSheet(sheet)
  if (!s.game) return []
  const ids = new Map<string, Set<string>>()
  const has = (kind: string, id: string) => {
    if (!defType(kind)) return false
    if (!ids.has(kind)) ids.set(kind, new Set(gameDefs.list(kind).map((d) => d.id)))
    return ids.get(kind)?.has(id) ?? false
  }
  return misfitsOf(s.game, has).map((m) => `${defType(m.kind)?.label ?? m.kind} ${m.id}`)
}

export function useAbility(sheet: string, ability: string, target: string | null, at: Point | null, distance: number): string {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const cat = catalog()
  const user = GameEntity.fromRecord(s.game, cat)
  const t = target && target !== s.id ? getSheet(target) : null
  if (t && !t.game) throw new ToolError(`${t.title} is not in the game.`)
  const other = t?.game ? GameEntity.fromRecord(t.game, cat) : null
  user.start()
  other?.start()
  try {
    const found = usableAbilities(user).find((a) => a.uid === ability)
    if (!found) throw new ToolError(`${s.title} can't use that now.`)
    const done = found.use({ user, target: target === s.id ? user : other, at, distance })
    if (done !== true) throw new ToolError(done)
    const nextUser = user.toRecord()
    setGame(s.id, nextUser)
    diffAndLogProgression(s.id, s.game, nextUser, cat)
    if (t && other) {
      const nextOther = other.toRecord()
      setGame(t.id, nextOther)
      diffAndLogProgression(t.id, t.game, nextOther, cat)
    }
    return `${s.title} used ${String(found.params.label || found.id)}${t ? ` on ${t.title}` : ''}.`
  } finally {
    user.stop()
    other?.stop()
  }
}

function ensureComp<T extends Progression | Classes | Traits | Abilities>(
  entity: GameEntity,
  cls: new () => T,
  type: string
): T {
  const existing = entity.comp(cls)
  if (existing) return existing
  const made = createComponent({ type })
  if (made) entity.add(made)
  return entity.comp(cls)!
}

export function awardCharacterXp(
  sheet: string,
  opts: { amount: number; classId?: string; reason?: string }
): { gained: number; level: number; xp: number; classUpdated: number; offers: PendingClassUnlock[] } {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const cat = catalog()
  const before = s.game
  const entity = GameEntity.fromRecord(before, cat)
  const offers: PendingClassUnlock[] = []
  entity.start()
  try {
    entity.signals.on('OnClassOffer', (p) => {
      offers.push(p as unknown as PendingClassUnlock)
    })
    const classes = ensureComp(entity, Classes as unknown as new () => Classes, Classes.type)
    if (opts.classId) {
      const count = classes.awardXp(opts.amount, { classId: opts.classId, reason: opts.reason ?? '' })
      if (!count) throw new ToolError(`${s.title} does not have class "${opts.classId}".`)
      const prog = entity.comp(Progression)
      const after = entity.toRecord()
      setGame(s.id, after)
      diffAndLogProgression(s.id, before, after, cat, [
        { summary: `Awarded ${opts.amount} XP to ${opts.classId}`, detail: opts.reason || undefined, tags: ['xp', 'class'] }
      ])
      return { gained: opts.amount, level: prog?.level ?? 1, xp: prog?.xp ?? 0, classUpdated: count, offers }
    }
    const prog = ensureComp(entity, Progression as unknown as new () => Progression, Progression.type)
    const res = prog.grantXp(opts.amount, opts.reason ?? '')
    const after = entity.toRecord()
    setGame(s.id, after)
    diffAndLogProgression(s.id, before, after, cat)
    return {
      gained: res.gained,
      level: res.level,
      xp: res.xp,
      classUpdated: classes.held.length,
      offers
    }
  } finally {
    entity.stop()
  }
}

export function setCharacterClass(
  sheet: string,
  opts: {
    action: 'add' | 'remove' | 'level' | 'accept_offer' | 'dismiss_offer'
    classId: string
    level?: number
    bypassConditions?: boolean
    reason?: string
  }
): { message: string; cls: CharacterClass | null; offers: PendingClassUnlock[] } {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const cat = catalog()
  const before = s.game
  const entity = GameEntity.fromRecord(before, cat)
  entity.start()
  try {
    const classes = ensureComp(entity, Classes as unknown as new () => Classes, Classes.type)
    let message = ''
    if (opts.action === 'add') {
      const res = classes.grantClass(opts.classId, {
        level: opts.level,
        bypassConditions: opts.bypassConditions,
        reason: opts.reason
      })
      if (!res.ok) throw new ToolError((res.reasons ?? ['Cannot grant class.']).join('; '))
      message = `${s.title} gained class ${res.cls?.title ?? opts.classId} (Lv ${res.cls?.level ?? 1}).`
    } else if (opts.action === 'remove') {
      const removed = classes.loseClass(opts.classId, opts.reason || 'removed')
      if (!removed) throw new ToolError(`${s.title} does not have class "${opts.classId}".`)
      message = `${s.title} permanently lost class ${opts.classId}.`
    } else if (opts.action === 'level') {
      const cls = classes.byId(opts.classId)
      if (!cls) throw new ToolError(`${s.title} does not have class "${opts.classId}".`)
      const targetLevel = Math.max(1, Math.floor(opts.level ?? cls.level + 1))
      cls.setLevel(targetLevel)
      classes.refreshRestrictions()
      message = `${s.title}'s ${cls.title} is now level ${cls.level}.`
    } else if (opts.action === 'accept_offer') {
      const res = classes.acceptUnlock(opts.classId)
      if (!res.ok) throw new ToolError((res.reasons ?? ['Cannot accept offer.']).join('; '))
      message = `${s.title} unlocked class ${res.cls?.title ?? opts.classId}.`
    } else {
      const ok = classes.dismissUnlock(opts.classId)
      message = ok ? `Dismissed offer for ${opts.classId}.` : `No pending offer for ${opts.classId}.`
    }
    const after = entity.toRecord()
    setGame(s.id, after)
    diffAndLogProgression(s.id, before, after, cat)
    return {
      message,
      cls: classes.byId(opts.classId),
      offers: [...classes.pendingUnlocks]
    }
  } finally {
    entity.stop()
  }
}

export function setCharacterTrait(
  sheet: string,
  opts: { action: 'add' | 'remove' | 'reset'; traitId: string; sourceClass?: string; permanent?: boolean; reason?: string }
): { message: string } {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const cat = catalog()
  const before = s.game
  const entity = GameEntity.fromRecord(before, cat)
  entity.start()
  try {
    const traits = ensureComp(entity, Traits as unknown as new () => Traits, Traits.type)
    let message = ''
    if (opts.action === 'add') {
      const tpl = cat.template('game_trait', opts.traitId)
      if (!tpl) throw new ToolError(`Unknown trait template "${opts.traitId}".`)
      const granted = traits.grant({ ...tpl, id: opts.traitId }, { sourceClass: opts.sourceClass, permanent: opts.permanent })
      if (!granted) throw new ToolError(`Could not add trait "${opts.traitId}".`)
      message = `${s.title} gained trait ${granted.title}.`
    } else if (opts.action === 'remove') {
      const removed = traits.removeById(opts.traitId, opts.reason || 'removed')
      if (!removed) throw new ToolError(`${s.title} does not have trait "${opts.traitId}".`)
      message = `${s.title} lost trait ${opts.traitId}.`
    } else {
      const trait = traits.byId(opts.traitId)
      if (!trait) throw new ToolError(`${s.title} does not have trait "${opts.traitId}".`)
      trait.resetUsage()
      message = `Reset cooldown/uses on trait ${trait.title}.`
    }
    const after = entity.toRecord()
    setGame(s.id, after)
    diffAndLogProgression(s.id, before, after, cat)
    return { message }
  } finally {
    entity.stop()
  }
}

export function triggerStoryMoment(
  sheet: string,
  opts: { tag?: string; summary: string; detail?: string; flags?: Record<string, unknown> }
): { offers: PendingClassUnlock[]; logged: number } {
  const s = getSheet(sheet)
  if (!s.game) throw new ToolError(`${s.title} is not in the game.`)
  const cat = catalog()
  const before = s.game
  const entity = GameEntity.fromRecord(before, cat)
  const offers: PendingClassUnlock[] = []
  entity.start()
  try {
    entity.signals.on('OnClassOffer', (p) => {
      offers.push(p as unknown as PendingClassUnlock)
    })
    entity.emit('OnStoryMoment', {
      tag: opts.tag ?? '',
      summary: opts.summary,
      detail: opts.detail ?? '',
      flags: opts.flags ?? (opts.tag ? { [opts.tag]: true } : {})
    })
    const after = entity.toRecord()
    setGame(s.id, after)
    const logged = diffAndLogProgression(s.id, before, after, cat, [
      { summary: opts.summary, detail: opts.detail, tags: ['story-moment', ...(opts.tag ? [opts.tag] : [])] }
    ])
    return { offers, logged: logged.length }
  } finally {
    entity.stop()
  }
}

export function onEntityMoved(opts: { sheet?: string; world?: string; token?: string; distance?: number }): { triggered: string[] } {
  const cat = catalog()
  const distance = opts.distance ?? 5
  const triggered: string[] = []
  if (opts.sheet) {
    const s = getSheet(opts.sheet)
    if (!s.game) return { triggered }
    const before = s.game
    const entity = GameEntity.fromRecord(before, cat)
    entity.start()
    try {
      entity.signals.on('OnBuffApplied', (p) => triggered.push(String(p.buff ?? 'buff')))
      entity.emit('OnMove', { distance })
      const after = entity.toRecord()
      setGame(s.id, after)
      diffAndLogProgression(s.id, before, after, cat)
    } finally {
      entity.stop()
    }
    return { triggered }
  }
  if (opts.world && opts.token) {
    const save = saveInPlay(opts.world, true)
    const creature = save?.creatures.find((c) => c.uid === opts.token)
    if (!save || !creature) return { triggered }
    const entity = GameEntity.fromRecord(creature, cat)
    entity.start()
    try {
      entity.signals.on('OnBuffApplied', (p) => triggered.push(String(p.buff ?? 'buff')))
      entity.emit('OnMove', { distance })
      const record = entity.toRecord()
      saves.write({ ...save, creatures: save.creatures.map((c) => (c.uid === opts.token ? { ...record, faction: c.faction } : c)) })
    } finally {
      entity.stop()
    }
  }
  return { triggered }
}
