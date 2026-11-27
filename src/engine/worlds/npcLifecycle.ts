import { sheetWithHold } from '@shared/characterHold'
import { shapeBounds } from '@shared/shapes'
import { relinkStory } from '@shared/story'
import type { CharacterSheet } from '@shared/types'
import { PLACE_TYPE_KEY, worldLink } from '@shared/world'
import { actorLink, npcActorId, splitNpcRef, type WorldNpc } from '@shared/worldNpcs'
import { almanacs } from '../almanac/store'
import { addCard, deckCards, deckOf, setDeckOwner } from '../cards/decks'
import { factions } from '../factions/store'
import { campaignHold } from '../library/holds'
import { getSheet, saveSheet, setSheetImage, setSheetSave } from '../library/sheets'
import { ToolError } from '../tools/types'
import { moveCharacter } from './members'
import { npcs } from './npcs'
import { saveInPlay } from './playLayer'
import { saves } from './saves'
import { WorldError, worlds } from './store'

export function hasSaveNpcOverrides(worldId: string, idOrRef: string): boolean {
  const save = saveInPlay(worldId, false)
  if (!save) return false
  const cleanId = splitNpcRef(idOrRef)?.id ?? idOrRef.trim()
  if (!npcs.hasTemplate(worldId, cleanId)) return cleanId in save.npcs && save.npcs[cleanId] !== null
  return save.npcs[cleanId] !== undefined
}

function copyDeckBetweenActors(fromActorId: string, toActorId: string): void {
  for (const entry of deckCards({ character: fromActorId })) {
    if (entry.count > 0) addCard({ character: toActorId }, entry.card, entry.count)
  }
}

function moveDeckBetweenActors(fromActorId: string, toActorId: string): void {
  const { deck } = deckOf({ character: fromActorId }, false)
  if (deck) {
    setDeckOwner(deck, { character: toActorId })
  }
}

export function writeNpcToTemplate(
  worldId: string,
  idOrRef: string,
  opts: { asArchetype?: boolean } = {}
): WorldNpc {
  if (!worlds.exists(worldId)) throw new WorldError(`There is no world "${worldId}".`)
  const playNpc = npcs.get(idOrRef, worldId, 'play')
  const saved = npcs.saveTemplate(
    worldId,
    {
      ...playNpc,
      id: playNpc.id,
      archetype: opts.asArchetype ?? false,
      sourceTemplateId: null
    },
    playNpc.id
  )
  const save = saveInPlay(worldId, false)
  if (save && playNpc.id in save.npcs && !saved.archetype) {
    const { [playNpc.id]: _cleared, ...restNpcs } = save.npcs
    saves.write({
      ...save,
      npcs: restNpcs
    })
    npcs.emit('changed', worldId)
  }
  return saved
}

export function resetNpcInSave(worldId: string, idOrRef: string): WorldNpc {
  if (!worlds.exists(worldId)) throw new WorldError(`There is no world "${worldId}".`)
  const cleanId = splitNpcRef(idOrRef)?.id ?? idOrRef.trim()
  const tpl = npcs.find(cleanId, worldId, 'template')
  if (!tpl) throw new ToolError(`"${cleanId}" has no world template to reset to.`)
  const save = saveInPlay(worldId, false)
  if (!save) return tpl

  const actorId = npcActorId(worldId, tpl.id)
  const { [tpl.id]: _cleared, ...restNpcs } = save.npcs
  const nextStand: typeof save.stand = Object.fromEntries(
    Object.entries(save.stand).map(([m, list]) => [
      m,
      Object.fromEntries(Object.entries(list).filter(([tok]) => tok !== actorId))
    ])
  )

  const whereMatch = /^@world:([^/#\s]+)\/place\/([^#\s]+)$/i.exec(tpl.story.where.trim())
  const placeKey = whereMatch && whereMatch[1] === worldId ? whereMatch[2] : null
  if (placeKey && !tpl.archetype) {
    for (const u of worlds.mapUses(worldId)) {
      const explicit = u.spawns?.[placeKey]
      const form = u.shapes[placeKey]
      if (!explicit && !form) continue
      const box = form ? shapeBounds(form) : null
      const at = explicit ?? { x: Math.round(box!.x + box!.w / 2), y: Math.round(box!.y + box!.h / 2) }
      nextStand[u.map] = { ...(nextStand[u.map] ?? {}), [actorId]: { at, actions: '', decisions: '' } }
      break
    }
  }

  saves.write({
    ...save,
    npcs: restNpcs,
    stand: nextStand
  })
  npcs.emit('changed', worldId)
  return npcs.get(tpl.id, worldId, 'play')
}

export function copyNpcToSheet(
  worldId: string,
  idOrRef: string,
  layer: 'play' | 'template' = 'play'
): CharacterSheet {
  if (!worlds.exists(worldId)) throw new WorldError(`There is no world "${worldId}".`)
  const npc = npcs.get(idOrRef, worldId, layer)
  const oldActorId = npcActorId(worldId, npc.id)
  const rules = worlds.meta(worldId).rules
  const activeSave = layer === 'play' ? saveInPlay(worldId, false) : null
  const baseSheet = getSheet(oldActorId)
  const merged =
    activeSave?.almanacId && layer === 'play'
      ? sheetWithHold(baseSheet, campaignHold(oldActorId, activeSave.almanacId))
      : baseSheet

  const created = saveSheet({
    id: null,
    title: npc.title,
    fields: [...npc.fields],
    values: { ...npc.values },
    dnd: npc.dnd ? structuredClone(npc.dnd) : null,
    game: npc.game ? { ...structuredClone(npc.game), uid: '' } : null,
    gameRules: npc.gameRules || rules,
    faction: npc.faction,
    story: { ...structuredClone(merged.story), where: '' },
    mind: merged.mind ? structuredClone(merged.mind) : null,
    relationships: structuredClone(merged.relationships ?? [])
  })
  if (npc.image) setSheetImage(created.id, npc.image)
  copyDeckBetweenActors(oldActorId, created.id)
  return getSheet(created.id)
}

export function promoteNpcToSheet(worldId: string, idOrRef: string): CharacterSheet {
  if (!worlds.exists(worldId)) throw new WorldError(`There is no world "${worldId}".`)
  const npc = npcs.get(idOrRef, worldId, 'play')
  const oldActorId = npcActorId(worldId, npc.id)
  const oldLink = actorLink(oldActorId)
  const rules = worlds.meta(worldId).rules
  const activeSave = saveInPlay(worldId, false)

  const created = saveSheet({
    id: null,
    title: npc.title,
    fields: [...npc.fields],
    values: { ...npc.values },
    dnd: npc.dnd ? structuredClone(npc.dnd) : null,
    game: npc.game ? { ...structuredClone(npc.game), uid: '' } : null,
    gameRules: npc.gameRules || rules,
    faction: npc.faction,
    story: structuredClone(npc.story),
    mind: npc.mind ? structuredClone(npc.mind) : null,
    relationships: structuredClone(npc.relationships)
  })
  const newId = created.id
  const newLink = `@sheet:${newId}`
  if (npc.image) setSheetImage(newId, npc.image)
  moveDeckBetweenActors(oldActorId, newId)

  // Migrate Almanac holds and cast references
  for (const almSummary of almanacs.list()) {
    const alm = almanacs.get(almSummary.id)
    if (!alm) continue
    const hasHold = Boolean(alm.holds?.[oldActorId])
    const hasCast = alm.cast.includes(oldLink) || alm.cast.includes(oldActorId)
    if (!hasHold && !hasCast) continue
    const nextHolds = { ...(alm.holds ?? {}) }
    if (nextHolds[oldActorId]) {
      nextHolds[newId] = nextHolds[oldActorId]
      delete nextHolds[oldActorId]
    }
    const nextCast = alm.cast.map((c) => (c === oldLink || c === oldActorId ? newLink : c))
    almanacs.save({ ...alm, holds: nextHolds, cast: [...new Set(nextCast)] }, alm.id)
  }

  // Update world player & faction leaders
  const meta = worlds.meta(worldId)
  if (meta.player === oldActorId) {
    worlds.setPlayer(worldId, newId)
  }
  for (const f of factions.list(worldId, 'template')) {
    if (f.leaderSheet === oldActorId || f.leaderSheet === oldLink) {
      factions.save({ ...f, leaderSheet: newId }, f.id)
    }
  }

  // Migrate World saves (stand, party, characters, battle queue)
  for (const s of saves.all().filter((sv) => sv.world === worldId)) {
    const inStand = Object.values(s.stand).some((m) => oldActorId in m)
    const inParty = Boolean(s.party?.includes(oldActorId))
    const inNpcs = npc.id in s.npcs
    if (!inStand && !inParty && !inNpcs) continue

    const st = s.npcs[npc.id]
    const { [npc.id]: _gone, ...restNpcs } = s.npcs
    const charGame = (st ? st.game : undefined) ?? npc.game ?? null
    const charWhere = (st?.story ? st.story.where : undefined) ?? npc.story.where ?? ''
    const nextStand = Object.fromEntries(
      Object.entries(s.stand).map(([mapId, list]) => [
        mapId,
        Object.fromEntries(Object.entries(list).map(([tok, pos]) => [tok === oldActorId ? newId : tok, pos]))
      ])
    )
    const nextBattle = s.battle
      ? {
          ...s.battle,
          queue: s.battle.queue.map((q) => (q.id === oldActorId ? { ...q, id: newId } : q))
        }
      : null

    saves.write({
      ...s,
      npcs: restNpcs,
      characters: {
        ...s.characters,
        [newId]: {
          game: charGame ? { ...structuredClone(charGame), uid: newId } : null,
          where: charWhere
        }
      },
      ...(s.party ? { party: [...new Set(s.party.map((p) => (p === oldActorId ? newId : p)))] } : {}),
      stand: nextStand,
      ...(s.battle ? { battle: nextBattle } : {})
    })
  }

  if (activeSave) {
    setSheetSave(newId, activeSave.id, { game: npc.game, gameRules: npc.gameRules || rules })
  }

  // Remove World NPC template if present and relink sibling NPC relationships
  const remainingTemplates = npcs
    .list(worldId, 'template')
    .filter((n) => n.id !== npc.id)
    .map((n) => ({
      ...n,
      story: relinkStory(n.story, 'world', oldActorId, newLink),
      relationships: (n.relationships ?? []).map((r) =>
        r.target === oldLink || r.target === oldActorId ? { ...r, target: newLink } : r
      )
    }))
  npcs.writeWorld(worldId, remainingTemplates)

  return getSheet(newId)
}

export function copySheetToNpc(
  worldId: string,
  sheetRef: string,
  opts: {
    archetype?: boolean
    place?: string | null
    map?: string | null
    faction?: string | null
    customTitle?: string | null
  } = {}
): WorldNpc {
  if (!worlds.exists(worldId)) throw new WorldError(`There is no world "${worldId}".`)
  const src = getSheet(sheetRef)
  const activeSave = saveInPlay(worldId, false)
  const merged =
    activeSave?.almanacId ? sheetWithHold(src, campaignHold(src.id, activeSave.almanacId)) : src
  const placeKey = opts.place?.trim() || null
  const where = placeKey ? worldLink(worldId, PLACE_TYPE_KEY, placeKey) : ''
  const desiredTitle = opts.customTitle?.trim() || src.title
  const npcId = npcs.uniqueId(worldId, desiredTitle)

  const created = npcs.saveTemplate(worldId, {
    id: npcId,
    title: desiredTitle,
    image: src.image,
    fields: [...src.fields],
    values: { ...src.values },
    dnd: src.dnd ? structuredClone(src.dnd) : null,
    game: src.game ? { ...structuredClone(src.game), uid: npcId, name: desiredTitle } : null,
    gameRules: src.gameRules || worlds.meta(worldId).rules,
    faction: opts.faction !== undefined ? opts.faction : (src.faction ?? null),
    story: { ...structuredClone(merged.story), where },
    mind: merged.mind ? structuredClone(merged.mind) : null,
    relationships: structuredClone(merged.relationships ?? []),
    archetype: Boolean(opts.archetype)
  })

  const newActorId = npcActorId(worldId, created.id)
  copyDeckBetweenActors(src.id, newActorId)

  if (!created.archetype && (placeKey || opts.map)) {
    const uses = worlds.mapUses(worldId)
    const targetMap =
      opts.map ||
      (placeKey ? uses.find((u) => Boolean(u.spawns?.[placeKey] || u.shapes[placeKey]))?.map : null) ||
      uses[0]?.map ||
      null
    if (targetMap) {
      moveCharacter(newActorId, worldId, targetMap, placeKey ?? '')
    }
  }

  return npcs.get(created.id, worldId, 'play')
}
