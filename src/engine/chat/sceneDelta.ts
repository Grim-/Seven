import { formatAlmanacClock, type SessionSceneBinding } from '@shared/almanac'
import { localPlaceMermaid, placePath, placesIn } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import { formatRelationshipsMarkdown } from '@shared/relationships'
import { worldEventRumours } from '@shared/game/worldEvents'
import { getSheet } from '../library/sheets'
import { worlds } from '../worlds/store'
import { saves } from '../worlds/saves'
import { whoIsHere } from '../worlds/presence'
import { worldEvents } from '../worlds/events'

const SHEET_REF_RE = /@sheet:([a-z0-9_/-]+)/gi

function extractAddressedNpc(prompt: string, playerSheet: string | null): string | null {
  let match: RegExpExecArray | null
  SHEET_REF_RE.lastIndex = 0
  while ((match = SHEET_REF_RE.exec(prompt)) !== null) {
    const id = match[1]?.trim()
    if (id && id !== playerSheet) return id
  }
  return null
}

function npcKnowledgeBlock(sheetId: string): string {
  try {
    const s = getSheet(sheetId)
    const lines: string[] = [`- Active NPC (${s.title || s.id} · @sheet:${s.id}):`]
    if (s.faction) lines.push(`  - Faction: ${s.faction}`)
    for (const [k, v] of Object.entries(s.values ?? {})) {
      const val = String(v ?? '').trim()
      if (val && val.length <= 240) lines.push(`  - ${k}: ${val}`)
    }
    if (s.mind?.howItThinks?.trim()) lines.push(`  - Mindset: ${s.mind.howItThinks.trim()}`)
    if (s.mind?.voiceConstraints?.trim()) lines.push(`  - Voice: ${s.mind.voiceConstraints.trim()}`)
    const rels = formatRelationshipsMarkdown(s.relationships ?? [], { pinnedOnly: false })
    if (rels) lines.push(`  - Known relations:\n${rels.split('\n').map((l) => `    ${l}`).join('\n')}`)
    return lines.length > 1 ? lines.join('\n') : ''
  } catch {
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
  prompt: string,
  prevSig: string | null
): { sig: string; block: string } {
  const worldId = scene.worldId
  if (!worldId || !worlds.exists(worldId)) return { sig: prevSig ?? '', block: '' }

  const save = (scene.saveId ? saves.read(scene.saveId) : null) ?? saves.current(worldId)
  const playerSheet = scene.playerSheet ?? worlds.meta(worldId).player ?? null
  const places = worlds.entities(worldId, PLACE_TYPE_KEY, false)
  const presenceMap = whoIsHere(worldId)

  // Resolve current live place of player (falls back to scene.placeKey / scene.where)
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
  const npcId = extractAddressedNpc(prompt, playerSheet)
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
    lines.push(`- Location: ${breadcrumb} (@place:${currentKey})`)
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
    const presentText = visitors.length ? visitors.map((v) => `${v.name} (@sheet:${v.sheet})`).join(', ') : 'nobody else'
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
    const npcBlock = npcKnowledgeBlock(npcId)
    if (npcBlock) lines.push(npcBlock)
  }

  return {
    sig,
    block: lines.length > 1 ? `\n\n${lines.join('\n')}` : ''
  }
}
