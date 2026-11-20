import { noteFailure } from '../util/report'
import { toolGuide } from '../tools/signature'
import { characterMindFor, sheetMarkdown } from '../library/sheets'
import os from 'node:os'
import { agentSheets, type AgentProfile, type PromptSection } from '@shared/types'
import type { ToolDef } from '../tools/types'
import { detectShell } from '../tools/shell'
import { modules } from '../modules/registry'
import { linkedFolders } from '../folders/store'
import { placesGuide } from '../present/guide'
import { kindsOwnedBy, libraryGuide } from '../library/kinds'
import { worldGuide } from '../worlds/ops'
import { userSection } from '../user/identity'
import { styles } from '../mind/styles'
import { agentDeckSummary } from '../cards/decks'
import { stripRef } from '@shared/ids'
import { linkFor } from '@shared/text'
import { formatRelationshipsMarkdown } from '@shared/relationships'
import { formatAlmanacClock, formatAlmanacTime, sortAlmanacEntries, type SessionSceneBinding } from '@shared/almanac'
import { getFactionStance } from '@shared/game/factions'
import { worldEventMetaMarkdown } from '@shared/game/worldEvents'
import { localPlaceMermaid, placePath, placesIn } from '@shared/maps'
import { PLACE_TYPE_KEY } from '@shared/world'
import { almanacs } from '../almanac/store'
import { factions } from '../factions/store'
import { getSheet } from '../library/sheets'
import { worlds } from '../worlds/store'
import { worldEvents } from '../worlds/events'
import { whoIsHere } from '../worlds/presence'

const ROLEPLAY = [
  '## Reply format',
  'Seven styles your replies for roleplay. Write:',
  '- dialogue on its own line as Name: "what they say" (inline *actions* are fine inside it),',
  '- actions on their own line wrapped in *asterisks*,',
  '- narration as plain paragraphs.'
].join('\n')

function reasoningDirective(agent: AgentProfile, tools: ToolDef[]): string {
  const hasReasonTool = tools.some((t) => t.name === 'reason')
  const sheets = agentSheets(agent)
  const hasCharacter = sheets.length > 0 || agent.roleplay === true
  const charMind = sheets.length ? characterMindFor(sheets) : null
  const chosenStyleRef = agent.reasoningStyle || charMind?.reasoningStyle || null
  const explicitStyle = chosenStyleRef ? styles.find(chosenStyleRef) : null
  const forced = agent.toolChoice === 'force_reason' || charMind?.forceReason === true
  const style = explicitStyle ?? (forced || (hasReasonTool && hasCharacter) ? (styles.list()[0] ?? null) : null)
  if (!forced && !style && !charMind && !(hasReasonTool && hasCharacter)) return ''

  const lines: string[] = ['## Pre-output reasoning & voice filter']
  if (forced && hasReasonTool) {
    lines.push('- Before outputting any visible dialogue, action, or reply, you MUST deliberate using the `reason` tool on what is about to happen, be said, or be done.')
  } else if (hasReasonTool && (style || charMind)) {
    lines.push('- Before outputting visible dialogue or key actions, use the `reason` tool (or your internal thinking) to work through what is about to happen, be said, or be done.')
  } else {
    lines.push('- Inside your thinking before writing any visible text, reason through what is about to happen, be said, or be done first.')
  }

  if (style) {
    lines.push(`- Modus operandi (${style.name}): ${style.instruction}`)
    if (style.voices.length) {
      lines.push('- Voices to weigh:')
      for (const v of style.voices) lines.push(`  - ${v.label}: ${v.line}`)
    }
    if (style.constraints?.trim()) {
      lines.push(`- Style constraints (enforced on every output): ${style.constraints.trim()}`)
    }
  }

  if (charMind?.howItThinks?.trim()) {
    lines.push(`- Character modus operandi: ${charMind.howItThinks.trim()}`)
  }
  if (charMind?.voiceConstraints?.trim()) {
    lines.push(`- Character output constraints (enforced on every reply): ${charMind.voiceConstraints.trim()}`)
  }

  if (hasCharacter) {
    lines.push('- Voice & character filter: forcefully filter every line of dialogue, word choice, and action through your character’s way of thinking and speaking (Speech, Motivations & goals, Core beliefs) before writing output. Strip generic or out-of-character phrasing.')
  }
  return lines.join('\n')
}

function memorySection(memoryText: string): string {
  return memoryText.trim() ? `## Pinned memories\nYour own, private to you. Find the rest with recall; things every agent should know live in pages.\n\n${memoryText.trim()}` : ''
}

function agentRelationshipsSection(agent: AgentProfile): string {
  const rels = agent.relationships ?? []
  if (!rels.length) return ''
  const text = formatRelationshipsMarkdown(rels, { pinnedOnly: true, recallTool: 'recall' })
  return text ? `## Your relationships\n${text}` : ''
}

function filled(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key: string) => vars[key] ?? m)
}

function characterOf(agent: AgentProfile, scene?: SessionSceneBinding | null): string {
  const sceneSheets = (scene?.characters ?? [])
    .map((c) => stripRef(c).replace(/^sheet:/i, '').trim())
    .filter(Boolean)
  const sheets = [...new Set([...agentSheets(agent), ...sceneSheets])]
  if (!sheets.length) return ''
  try {
    if (sheets.length === 1) {
      return `## Your character\n${sheetMarkdown(sheets[0], true).replace(/^# /, '### ').replace(/\n## /g, '\n#### ')}`
    }
    return `## Your characters\nYou play or narrate the following characters in this conversation:\n\n${sheets
      .map((s) => {
        try {
          return sheetMarkdown(s, true).replace(/^# /, '### ').replace(/\n## /g, '\n#### ')
        } catch {
          return ''
        }
      })
      .filter(Boolean)
      .join('\n\n---\n\n')}`
  } catch (err) {
    noteFailure(err, 'chat', 'Could not add the character to the prompt')
    return ''
  }
}

export function promptVars(agent: AgentProfile | null): Record<string, string> {
  const shell = detectShell()
  return {
    workspace: agent ? (agent.workspace ?? '(none)') : "(the agent's workspace)",
    os: `${os.type()} (${process.platform})`,
    shell: shell?.name ?? 'none',
    shellSyntax: shell ? (shell.family === 'bash' ? 'bash' : 'PowerShell') : 'none'
  }
}

export function guideTitle(moduleName: string): string {
  return `Seven: ${moduleName}`
}

export function guideModules(): { id: string; name: string }[] {
  return modules
    .list()
    .filter((m) => m.state === 'on' && m.tools.length > 0)
    .map((m) => ({ id: m.id, name: m.name }))
}

function kindPartsText(moduleId: string): string {
  const ownsLibrary = modules.toolsOf(moduleId).some((t) => t.name === 'read_kind')
  const lines = [...kindsOwnedBy(moduleId), ...(ownsLibrary ? kindsOwnedBy(null) : [])]
    .filter((k) => k.parts.length > 1)
    .map((k) => `- @${k.kind}: ${k.parts.map((p) => `#${p}`).join(', ')}`)
  return lines.length ? `## Parts\n${lines.join('\n')}` : ''
}

export function guideText(moduleId: string, agent: AgentProfile | null): string | null {
  const info = modules.list().find((m) => m.id === moduleId && m.state === 'on')
  if (!info || !info.tools.length) return null
  const parts = [
    `# ${guideTitle(info.name)}`,
    `${info.description}\nGenerated from the ${info.name} tool module each time it is read, so it is always current; it can't be edited.`,
    `## Tools\n${modules.toolsOf(moduleId).map(toolGuide).join('\n')}`
  ]
  const kindParts = kindPartsText(moduleId)
  if (kindParts) parts.push(kindParts)
  const prompt = filled(modules.promptFor(moduleId), promptVars(agent)).trim()
  if (prompt) parts.push(prompt)
  const help = modules.helpFor(moduleId).trim()
  if (help) parts.push(`## More\n${help}`)
  return parts.join('\n\n')
}

export function moduleGuidePreview(moduleId: string): { markdown: string; live: boolean } {
  const live = guideText(moduleId, null)
  if (live) return { markdown: live, live: true }
  const info = modules.list().find((m) => m.id === moduleId)
  if (!info) return { markdown: '', live: false }
  const parts = [`# ${guideTitle(info.name)}`]
  if (info.description.trim()) parts.push(info.description.trim())
  if (info.state === 'on') {
    const prompt = filled(info.prompt, promptVars(null)).trim()
    if (prompt) parts.push(prompt)
    if (info.help.trim()) parts.push(`## More\n${info.help.trim()}`)
    return { markdown: parts.join('\n\n'), live: true }
  }
  parts.push(`> This module is currently **${info.state}**. Switch it on to inspect live tool signatures and auto-generated tool API entries.`)
  const prompt = filled(info.prompt, promptVars(null)).trim()
  if (prompt) parts.push(prompt)
  if (info.help.trim()) parts.push(`## More\n${info.help.trim()}`)
  return { markdown: parts.join('\n\n'), live: false }
}

function guideLinkFor(module: string): string | null {
  const name = guideModules().find((m) => m.id === module)?.name
  return name ? linkFor('page', guideTitle(name)) : null
}

function guidesSection(tools: ToolDef[]): string {
  const on = new Map(guideModules().map((m) => [m.id, m.name]))
  const lines: string[] = []
  for (const group of [...new Set(tools.map((t) => t.group))]) {
    const name = on.get(group)
    if (!name) continue
    lines.push(`- ${name}: ${linkFor('page', guideTitle(name))}`)
  }
  if (!lines.length) return ''
  return ['## Tool guides', 'How each of your tools works is on its guide page. Read the guide before you use its tools for the first time in a chat, and again whenever one of its calls fails.', ...lines].join('\n')
}

export type InstructionSection = Omit<PromptSection, 'tokens' | 'kind'>

function pushSection(out: InstructionSection[], id: string, sourceId: string, label: string, detail: string, text: string): void {
  const clean = text.trim()
  if (!clean) return
  out.push({ id, sourceId, label, detail, text: clean })
}

function metaEventSceneSection(scene: SessionSceneBinding): { detail: string; text: string } | null {
  if (!scene.worldId || !scene.eventId) return null
  const ev = worldEvents.find(scene.eventId, scene.worldId)
  if (!ev) return null
  const allFactions = factions.list()
  const factionName = (id: string) => allFactions.find((f) => f.id === id)?.name ?? id
  const participantDetails = ev.participants.flatMap((p) => {
    const fName = p.factionId ? factionName(p.factionId) : ''
    const roleTag = p.role ? ` (${p.role})` : ''
    if (p.kind === 'faction') {
      const f = allFactions.find((x) => x.id === (p.refId || p.factionId))
      const label = f?.name ?? p.name ?? p.refId ?? 'Faction'
      const charIds = p.characters ?? []
      if (!charIds.length) {
        const rosterHint = f?.roster?.length ? ` · typical roster: ${f.roster.join(', ')}` : ''
        return [
          `${label}${roleTag} — power ${p.power}${rosterHint} (no named leader listed; improvise a fitting representative for this faction)`
        ]
      }
      return charIds.map((sheetId) => {
        try {
          const s = getSheet(sheetId)
          const voice = s.mind?.voiceConstraints?.trim() || s.values?.Speech?.trim() || ''
          return `${s.title || s.id} (@sheet:${s.id}) representing ${label}${roleTag}${voice ? ` · Voice: ${voice}` : ''}`
        } catch {
          return `${sheetId} representing ${label}${roleTag}`
        }
      })
    }
    if (p.kind === 'sheet' && p.refId) {
      try {
        const s = getSheet(p.refId)
        const voice = s.mind?.voiceConstraints?.trim() || s.values?.Speech?.trim() || ''
        return [
          `${s.title || s.id} (@sheet:${s.id})${fName ? ` of ${fName}` : ''}${roleTag}${voice ? ` · Voice: ${voice}` : ''}`
        ]
      } catch {
        return [`${p.name || p.refId}${fName ? ` of ${fName}` : ''}${roleTag}`]
      }
    }
    if (p.kind === 'creature' || p.kind === 'monster') {
      const label = p.name || p.refId || p.kind
      return [`${label} (${p.kind === 'monster' ? 'D&D monster' : 'creature/NPC'} block)${fName ? ` of ${fName}` : ''}${roleTag} — power ${p.power}`]
    }
    // Unlisted / distant / improvised figure (does not require a sheet or physical token)
    return [`${p.name || p.refId || 'Unnamed Figure'}${fName ? ` of ${fName}` : ''}${roleTag} — power ${p.power}`]
  })
  const involvedFactions = [...new Set(ev.participants.map((p) => p.factionId || (p.kind === 'faction' ? p.refId : '')).filter(Boolean) as string[])]
  const factionTensions: string[] = []
  for (let i = 0; i < involvedFactions.length; i++) {
    for (let j = i + 1; j < involvedFactions.length; j++) {
      const a = involvedFactions[i]
      const b = involvedFactions[j]
      const stance = getFactionStance(allFactions, a, b)
      factionTensions.push(`${factionName(a)} ↔ ${factionName(b)}: ${stance}`)
    }
  }
  const md = worldEventMetaMarkdown(ev, { participantDetails, factionTensions })
  const stage = [
    md,
    '',
    '## Meta-Narrative Stage Direction',
    '- Voice ONLY the participating figureheads in character based on their sheets and faction tensions.',
    '- Write dialogue as `Name: "..."` with brief *stage actions* in asterisks.',
    '- Do NOT assume the player character is present or narrate player actions.'
  ].join('\n')
  return { detail: `Meta-Narrative Scene · ${ev.title}`, text: stage }
}

function almanacSceneSection(scene: SessionSceneBinding | null | undefined): { detail: string; text: string } | null {
  if (!scene) return null
  if (scene.mode === 'meta') return metaEventSceneSection(scene)
  if (!scene.almanacId && !scene.worldId) return null
  const alm = scene.almanacId ? almanacs.find(scene.almanacId) : null
  const worldId = scene.worldId ?? alm?.worldId ?? null
  if (!alm && !worldId) return null
  const clockSec = scene.worldTime ?? alm?.currentTime ?? 0
  const isSessionOne = alm ? alm.entries.length === 0 : false
  const where = scene.where || (scene.placeKey ? `@place:${scene.placeKey}` : '') || alm?.opening?.startingWhere || ''
  const chars = scene.characters.length ? scene.characters : (alm?.cast ?? [])
  let roomBreadcrumb = ''
  let roomLooks = ''
  let roomNow = ''
  let roomMermaid: string | null = null
  let roomPresence: string[] | null = null
  if (worldId && where && worlds.exists(worldId)) {
    const places = worlds.entities(worldId, PLACE_TYPE_KEY, false)
    const keys = placesIn(where, worldId, places)
    if (keys.length) {
      const currentKey = keys[0]
      roomBreadcrumb = placePath(places, currentKey)
        .map((k) => String(places[k]?.Name || k))
        .join(' › ')
      const curPlace = places[currentKey]
      roomLooks = typeof curPlace?.Looks === 'string' ? curPlace.Looks.trim() : ''
      roomNow = typeof curPlace?.Now === 'string' ? curPlace.Now.trim() : ''
      roomMermaid = localPlaceMermaid(places, currentKey)
      const visitors = whoIsHere(worldId)[currentKey] ?? []
      roomPresence = visitors.map((v) => `${v.name} (@sheet:${v.sheet})`)
    }
  }

  const lines = [
    alm ? '## Almanac scene' : '## Gameplay scene',
    ...(worldId ? [`- Active World: @world:${worldId}`] : []),
    ...(scene.playerSheet ? [`- Player character: @sheet:${scene.playerSheet}`] : []),
    ...(alm
      ? [
          `- Active Almanac: @almanac:${alm.id} (${alm.title})`,
          `- Contemporal stage: ${
            isSessionOne
              ? 'SESSION 1 — STORYLINE OPENING (no prior scenes have happened yet; treat this as the opening scene of the campaign)'
              : `Ongoing storyline (${alm.entries.length} prior scene(s) recorded; current clock ${formatAlmanacClock(clockSec)})`
          }`,
          `- Current world clock: ${formatAlmanacClock(clockSec)}`
        ]
      : scene.worldTime != null
        ? [`- Current world clock: ${formatAlmanacClock(clockSec)}`]
        : []),
    ...(alm?.opening?.setting ? [`- Setting: ${alm.opening.setting}`] : []),
    ...(alm?.opening?.timePeriod ? [`- Time period: ${alm.opening.timePeriod}`] : []),
    ...(where ? [`- Current scene location: ${roomBreadcrumb ? `${roomBreadcrumb} (${where})` : where}`] : []),
    ...(roomLooks ? [`- What this place looks like: ${roomLooks}`] : []),
    ...(roomNow ? [`- Happening here right now: ${roomNow}`] : []),
    ...(roomPresence !== null
      ? [
          `- Present in this exact room right now: ${roomPresence.length ? roomPresence.join(', ') : 'nobody else'}`,
          '- Room-scoped perception: You only perceive characters, objects, and immediate exits of your current place. Do NOT assume or reveal who is in other rooms or how rooms beyond your immediate exits connect until the player moves there or inspects them (`read @place:<key>`).'
        ]
      : chars.length
        ? [`- Scene cast present: ${chars.join(', ')}`]
        : []),
    ...(roomMermaid ? [`- Immediate exits from here (1-hop topology only):\n\`\`\`mermaid\n${roomMermaid}\n\`\`\``] : []),
    ...(alm?.opening?.premise ? [`- Storyline premise: ${alm.opening.premise}`] : []),
    ...(alm?.opening?.incitingIncident && (isSessionOne || alm.entries.length <= 2)
      ? [`- Session 1 opening situation: ${alm.opening.incitingIncident}`]
      : []),
    ...(alm?.opening?.tone ? [`- Tone & stakes: ${alm.opening.tone}`] : [])
  ]
  const activeThreads = (alm?.threads ?? []).filter((t) => (t.status ?? (t.done ? 'resolved' : 'active')) !== 'resolved').slice(0, 6)
  if (activeThreads.length) {
    lines.push('- Active story threads:')
    for (const t of activeThreads) {
      lines.push(`  - [${t.status ?? 'active'}] ${t.text}${t.where ? ` (${t.where})` : ''}`)
    }
  }
  const recent = alm ? sortAlmanacEntries(alm.entries, 'newest').slice(0, 5).reverse() : []
  if (recent.length) {
    lines.push('- Recent chronicle outcomes (read @almanac:' + alm!.id + ' or #entry:<id> for full transcripts):')
    for (const e of recent) {
      lines.push(`  - [${formatAlmanacTime(e.when)} #${e.when.seq}] ${e.title}${e.where ? ` (${e.where})` : ''}: ${e.outcome || e.summary}`)
    }
  }
  return {
    detail: alm
      ? `Bound to Almanac "${alm.title}" (${formatAlmanacClock(clockSec)}${where ? ` · ${where}` : ''})`
      : `Gameplay Chat bound to "${worldId}"${where ? ` · ${where}` : ''}`,
    text: lines.join('\n')
  }
}

const DM_TOOL_RULES: { tool: string; rule: string }[] = [
  { tool: 'advance_time', rule: 'Talking takes no time. Call advance_time only when in-world time passes: travel, searching, waiting.' },
  { tool: 'short_rest', rule: 'Call short_rest or long_rest when the party rests.' },
  { tool: 'action_check', rule: 'When an outcome is uncertain, roll it with action_check and narrate the result.' },
  { tool: 'create_decisions', rule: 'Offer the player real choices with create_decisions.' },
  { tool: 'almanac_log', rule: 'Record milestones and the outcome of each scene with almanac_log.' }
]

function dmModeSection(tools: ToolDef[]): string {
  return [
    '## DM Mode',
    '- You are the Game Master and narrator. The user plays their character; you voice everyone and everything else.',
    '- Describe only what the player\'s character can perceive: the current place, who is here, and its exits. Never reveal other places, hidden people or secrets until the player finds them.',
    '- Take tone, rules and the opening from the bound world and Almanac. In Session 1, open with the opening situation.',
    ...DM_TOOL_RULES.filter((r) => tools.some((t) => t.name === r.tool)).map((r) => `- ${r.rule}`)
  ].join('\n')
}

/** Build ordered instruction sections with origin metadata so UI inspectors can colour and explain each source. */
export function buildInstructionSections(
  agent: AgentProfile,
  tools: ToolDef[],
  memoryText = '',
  scene?: SessionSceneBinding | null,
  dm = false
): InstructionSection[] {
  const out: InstructionSection[] = []
  const charText = characterOf(agent, scene)
  if (charText) {
    const count = agentSheets(agent).length
    pushSection(out, 'agent-character', 'agent', 'Character sheet', `${count} character sheet${count === 1 ? '' : 's'} worn by this agent`, charText)
  }
  pushSection(out, 'agent-prompt', 'agent', 'Agent system prompt', `Custom system prompt configured on "${agent.name || 'Agent'}"`, agent.systemPrompt)
  const sceneBlock = almanacSceneSection(scene)
  if (sceneBlock) {
    pushSection(out, 'almanac-scene', 'world', 'Almanac scene', sceneBlock.detail, sceneBlock.text)
  }
  if (dm) pushSection(out, 'dm-mode', 'world', 'DM Mode', 'Game Master rules added because this chat runs in DM Mode', dmModeSection(tools))

  if (!tools.length) {
    pushSection(out, 'agent-rels', 'agent', 'Pinned relationships', 'Pinned character relationships on this agent', agentRelationshipsSection(agent))
    pushSection(out, 'user', 'user', 'About you', 'Your user profile name and bio from Settings', userSection())
    pushSection(out, 'agent-roleplay', 'agent', 'Reply format', 'Roleplay formatting rules (agent roleplay mode is on)', agent.roleplay ? ROLEPLAY : '')
    pushSection(out, 'mind-reasoning', 'mind', 'Reasoning & voice filter', 'Reasoning style and voice constraints on agent or character', reasoningDirective(agent, tools))
    pushSection(out, 'mind-memory', 'mind', 'Pinned memories', 'Memories pinned into default context from Mind', memorySection(memoryText))
    return out
  }

  pushSection(out, 'user', 'user', 'About you', 'Your user profile name and bio from Settings', userSection())

  const env = [`- Operating system: ${os.type()} (${process.platform})`]
  const folders = linkedFolders.forAgent(agent.id)
  if (tools.some((t) => t.needsWorkspace)) {
    if (agent.workspace) {
      env.push(`- Workspace folder: ${agent.workspace}`)
      env.push('- File tool paths are relative to the workspace folder.')
    }
    if (folders.length) {
      env.push(`- Linked folders${agent.workspace ? '' : ' (you have no workspace, so file tools only work here)'}: start a file tool path with @name to use one, e.g. @${folders[0].name}/some/file.md`)
      for (const f of folders) env.push(`  - @${f.name}: ${f.path} (${f.access === 'write' ? 'read and write' : 'read only'}${f.exclude.length ? `; off limits: ${f.exclude.join(', ')}` : ''})`)
      env.push('- Commands (run_command) still run in the workspace; use the file tools for linked folders.')
    }
  }
  env.push("- Each of the user's messages starts with the current date and time.")
  pushSection(
    out,
    'environment',
    'environment',
    'Environment & workspace',
    'Runtime OS, workspace folder, linked folders, and message timestamp rules',
    `## Environment\n${env.join('\n')}`
  )
  pushSection(
    out,
    'tool-rules',
    'tools',
    'Tool rules',
    'Base tool-use rules included whenever tools are enabled',
    [
      '## Tools',
      "- If a task needs a tool you don't have, tell the user instead of pretending.",
      '- Never ask the user for permission to use a tool. Seven asks them itself when an action needs approval.',
      '- Do not repeat a call you already made; use its result.'
    ].join('\n')
  )
  pushSection(out, 'agent-roleplay', 'agent', 'Reply format', 'Roleplay formatting rules (agent roleplay mode is on)', agent.roleplay ? ROLEPLAY : '')
  pushSection(out, 'mind-reasoning', 'mind', 'Reasoning & voice filter', 'Reasoning style and voice constraints on agent or character', reasoningDirective(agent, tools))
  pushSection(out, 'library-guide', 'library', 'Library & kinds', 'Registered data kinds and @kind:id linking instructions (from core/library)', libraryGuide(tools.map((t) => t.name), agent.id, guideLinkFor))
  pushSection(out, 'present-guide', 'present', 'Places & UI panels', 'Chat display and dashboard/panel placement instructions', placesGuide(tools))
  if (tools.some((t) => t.name === 'world_recall')) {
    pushSection(out, 'world-guide', 'world', 'World guide', 'Bound world context and entity lookup rules (from World module)', worldGuide(agent.world, tools.some((t) => t.name === 'world_create')))
  }
  if (tools.some((t) => t.name === 'play_card')) {
    pushSection(out, 'cards-deck', 'cards', 'Agent deck', 'Summary of cards currently in this agent deck (from Cards module)', agentDeckSummary(agent))
  }
  pushSection(out, 'agent-rels', 'agent', 'Pinned relationships', 'Pinned character relationships on this agent', agentRelationshipsSection(agent))
  pushSection(out, 'tool-guides', 'tools', 'Tool guide links', 'Links to Seven:<Module> pages for enabled tool modules', guidesSection(tools))
  pushSection(out, 'mind-memory', 'mind', 'Pinned memories', 'Memories pinned into default context from Mind', memorySection(memoryText))
  return out
}

export function buildInstructions(
  agent: AgentProfile,
  tools: ToolDef[],
  memoryText = '',
  scene?: SessionSceneBinding | null,
  dm = false
): string {
  return buildInstructionSections(agent, tools, memoryText, scene, dm)
    .map((s) => s.text)
    .join('\n\n')
}

const FROZEN_HEADINGS: { prefix: string; sourceId: string; label: string; detail: string }[] = [
  { prefix: '## Your character', sourceId: 'agent', label: 'Character sheet', detail: 'Character sheet(s) linked when this chat started' },
  { prefix: '## Almanac scene', sourceId: 'world', label: 'Almanac scene', detail: 'Active Almanac scene binding (world clock, location, cast, threads, recent outcomes)' },
  { prefix: '## DM Mode', sourceId: 'world', label: 'DM Mode', detail: 'Game Master rules (this chat runs in DM Mode)' },
  { prefix: '## The user', sourceId: 'user', label: 'About you', detail: 'User profile section frozen when this chat started' },
  { prefix: '## Environment', sourceId: 'environment', label: 'Environment & workspace', detail: 'OS, workspace, and folder info frozen when this chat started' },
  { prefix: '## Tools', sourceId: 'tools', label: 'Tool rules', detail: 'Base tool-use rules frozen when this chat started' },
  { prefix: '## Reply format', sourceId: 'agent', label: 'Reply format', detail: 'Roleplay formatting rules' },
  { prefix: '## Pre-output reasoning & voice filter', sourceId: 'mind', label: 'Reasoning & voice filter', detail: 'Reasoning style and character voice directives' },
  { prefix: '## Library and links', sourceId: 'library', label: 'Library & kinds', detail: 'Registered library kinds and link instructions' },
  { prefix: '## Showing things', sourceId: 'present', label: 'Places & UI panels', detail: 'Presentation & UI panel instructions' },
  { prefix: '## World', sourceId: 'world', label: 'World guide', detail: 'World context and entity rules (from World module)' },
  { prefix: 'Your cards:', sourceId: 'cards', label: 'Agent deck', detail: 'Deck summary injected by Cards module' },
  { prefix: '## Your relationships', sourceId: 'agent', label: 'Pinned relationships', detail: 'Pinned relationship entries' },
  { prefix: '## Tool guides', sourceId: 'tools', label: 'Tool guide links', detail: 'Links to enabled module documentation pages' },
  { prefix: '## Pinned memories', sourceId: 'mind', label: 'Pinned memories', detail: 'Pinned memories injected at chat start' }
]

/** Split a frozen system prompt back into labelled sections by top-level headings without modifying stored sessions. */
export function parseFrozenInstructionSections(systemPrompt: string): InstructionSection[] {
  const raw = systemPrompt.trim()
  if (!raw) return []
  const chunks = raw.split(/\n{2,}(?=## |Your cards:)/)
  return chunks.map((chunk, i) => {
    const clean = chunk.trim()
    const matched = FROZEN_HEADINGS.find((h) => clean.startsWith(h.prefix))
    if (matched) {
      return { id: `frozen-${i}-${matched.sourceId}`, sourceId: matched.sourceId, label: matched.label, detail: matched.detail, text: clean }
    }
    return {
      id: `frozen-${i}-agent`,
      sourceId: 'agent',
      label: 'Agent instructions',
      detail: 'Agent prompt / frozen opening instructions',
      text: clean
    }
  })
}

export function stateLine(now = new Date()): string {
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return `[${date}, ${time}${zone ? ` ${zone}` : ''}]`
}

export function withState(prompt: string, now = new Date()): string {
  return `${stateLine(now)}\n${prompt}`
}
