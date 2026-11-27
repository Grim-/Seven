import { formatAlmanacClock, type SessionSceneBinding } from '@shared/almanac'
import { Stats, recordHealth } from '@shared/game/components'
import { GameEntity } from '@shared/game/core'
import { localPlaceMermaid, placePath, placesIn } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import { actorLink } from '@shared/worldNpcs'
import { formatRelationshipsMarkdown } from '@shared/relationships'
import { worldEventRumours } from '@shared/game/worldEvents'
import { effectCatalog } from '../effects/catalog'
import { findSheet } from '../library/sheets'
import { sheetIn } from '../library/holds'
import { noteFailure } from '../util/report'
import { worlds } from '../worlds/store'
import { saves } from '../worlds/saves'
import { whoIsHere } from '../worlds/presence'
import { worldEvents } from '../worlds/events'

const ACTOR_REF_RE = /@(?:sheet:([a-z0-9_/-]+)|world:([a-z0-9_-]+\/npc\/[a-z0-9_/-]+))/gi

function extractAddressedNpc(prompt: string, playerSheet: string | null, worldId: string | null): string | null {
  let match: RegExpExecArray | null
  ACTOR_REF_RE.lastIndex = 0
  while ((match = ACTOR_REF_RE.exec(prompt)) !== null) {
    const raw = (match[1] ?? match[2] ?? '').trim()
    const resolved = raw ? (findSheet(raw, worldId) ?? raw) : ''
    if (resolved && resolved !== playerSheet) return resolved
  }
  return null
}

function npcKnowledgeBlock(sheetId: string, campaign: string | null): string {
  try {
    const s = sheetIn(sheetId, campaign)
    const lines: string[] = [`- Active NPC (${s.title || s.id} · ${actorLink(s.id)}):`]
    if (s.faction) lines.push(`  - Faction: ${s.faction}`)
    if (s.story.doing?.trim()) lines.push(`  - Doing: ${s.story.doing.trim()}`)
    if (s.story.goal?.trim()) lines.push(`  - Goal: ${s.story.goal.trim()}`)
    if (s.story.mood?.trim()) lines.push(`  - Mood: ${s.story.mood.trim()}`)
    const cat = s.game ? effectCatalog() : null
    if (s.game && cat) {
      const hp = recordHealth(s.game, cat)
      if (hp) lines.push(`  - Health: ${hp.cur}/${hp.max}${hp.cur <= 0 ? ' (DEAD)' : ''}`)
      const entity = GameEntity.fromRecord(s.game, cat)
      const statsComp = entity.comp(Stats)
      if (statsComp) {
        const statSummaries = cat
          .stats()
          .filter((def) => def.domain !== 'resource' && statsComp.value(def.id) !== def.default)
          .slice(0, 8)
          .map((def) => `${def.label} ${Math.round(statsComp.value(def.id) * 100) / 100}/${def.max}`)
        if (statSummaries.length) lines.push(`  - Active stats: ${statSummaries.join('; ')}`)
      }
      entity.stop()
    }
    for (const [k, v] of Object.entries(s.values ?? {})) {
      const val = String(v ?? '').trim()
      if (val && val.length <= 240) lines.push(`  - ${k}: ${val}`)
    }
    if (s.mind?.howItThinks?.trim()) lines.push(`  - Mindset: ${s.mind.howItThinks.trim()}`)
    if (s.mind?.voiceConstraints?.trim()) lines.push(`  - Voice: ${s.mind.voiceConstraints.trim()}`)
    const rels = formatRelationshipsMarkdown(s.relationships ?? [], { pinnedOnly: false })
    if (rels) lines.push(`  - Known relations:\n${rels.split('\n').map((l) => `    ${l}`).join('\n')}`)
    return lines.length > 1 ? lines.join('\n') : ''
  } catch (err) {
    noteFailure(err, 'chat/sceneDelta', `read NPC sheet ${sheetId}`)
    return ''
  }
}

/**
 * Collates a terse, room-scoped `[SCENE UPDATE]` delta for a Gameplay Chat turn
 * without mutating `FrozenInstructions` (preserving KV / prompt-cache prefill).
 * Returns an empty block when nothing in the player's observable scene changed.
 */
export function buildGameplaySceneDelta(
  scene: SessionSceneBinding,
  worldId: string | null,
  prompt: string,
  prevSig: string | null
): { sig: string; block: string } {
  if (!worldId || !worlds.exists(worldId)) return { sig: prevSig ?? '', block: '' }

  const save = (scene.saveId ? saves.read(scene.saveId) : null) ?? saves.current(worldId)
  const playerSheet = scene.playerSheet ?? worlds.meta(worldId).player ?? null
  const places = worlds.entities(worldId, PLACE_TYPE_KEY, false)
  const presenceMap = whoIsHere(worldId)

  let currentKey = scene.placeKey ?? ''
  if (playerSheet) {
    for (const [pk, visitors] of Object.entries(presenceMap)) {
      if (visitors.some((v) => v.sheet === playerSheet)) {
        currentKey = pk
        break
      }
    }
  }
  if (!currentKey && scene.where) {
    currentKey = placesIn(scene.where, worldId, places)[0] ?? ''
  }

  const visitors = currentKey ? (presenceMap[currentKey] ?? []) : []
  const presentIds = visitors.map((v) => v.sheet).sort().join(',')
  const inBattle = Boolean(save?.battle && save.battle.status === 'active')
  const clockHour = save?.clock?.time !== undefined ? Math.floor(save.clock.time / 3600) : -1
  const npcId = extractAddressedNpc(prompt, playerSheet, worldId)
  const ancestorPlaces = currentKey && places[currentKey] ? placePath(places, currentKey) : []
  const rumours = worldEventRumours(worldEvents.list(worldId), { mapId: scene.mapId ?? null, placeKeys: ancestorPlaces })
  const rumourSig = rumours.map((r) => `${r.eventId}:${r.text.slice(0, 24)}`).join('|')
  const sig = `${currentKey}|${presentIds}|${inBattle ? 1 : 0}|${clockHour}|${npcId ?? ''}|${rumourSig}`

  if (prevSig !== null && sig === prevSig) return { sig, block: '' }

  const lines: string[] = ['[SCENE UPDATE]']
  if (currentKey && places[currentKey]) {
    const place = places[currentKey]
    const breadcrumb = ancestorPlaces
      .map((k) => String(places[k]?.Name || k))
      .join(' › ')
    lines.push(`- Location: ${breadcrumb} (@world:${worldId}/place/${currentKey})`)
    const looks = typeof place.Looks === 'string' ? place.Looks.trim() : ''
    const now = typeof place.Now === 'string' ? place.Now.trim() : ''
    if (looks) lines.push(`- Looks: ${looks}`)
    if (now) lines.push(`- Now: ${now}`)
    const exits = localPlaceMermaid(places, currentKey)
    if (exits) lines.push(`- Immediate exits:\n\`\`\`mermaid\n${exits}\n\`\`\``)
  }
  if (save?.clock?.time !== undefined) {
    lines.push(`- Clock: ${formatAlmanacClock(save.clock.time)}`)
  }
  if (currentKey) {
    const presentText = visitors.length ? visitors.map((v) => `${v.name} (${actorLink(v.sheet)})`).join(', ') : 'nobody else'
    lines.push(`- Present here: ${presentText}`)
  }
  if (inBattle && save?.battle) {
    lines.push(`- Combat: Active (Round ${save.battle.round})`)
  }
  if (rumours.length) {
    lines.push('- Word going around (rumours & news):')
    for (const r of rumours) {
      lines.push(`  - ${r.headline ? `${r.headline}: ` : ''}${r.text}`)
    }
  }
  if (npcId) {
    const npcBlock = npcKnowledgeBlock(npcId, scene.almanacId || null)
    if (npcBlock) lines.push(npcBlock)
  }

  return {
    sig,
    block: lines.length > 1 ? `\n\n${lines.join('\n')}` : ''
  }
}
