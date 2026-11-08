import { RULE_SET_KIND, defRef, defTypes, splitDefRef, type DefType, type GameDef } from '@shared/game/defs'
import { ENTRY_WIDGET, type Kind } from '../../engine/library/kinds'
import { gameDefs } from './store'
import { removeRuleSet } from './worldRules'
import { saves } from '../../engine/worlds/saves'
import { removeSave } from '../../engine/worlds/party'
import { worlds } from '../../engine/worlds/store'
import { getSheet } from '../../engine/library/sheets'

function defText(type: DefType, ruleSet: string, def: GameDef): string {
  const rows = Object.entries(type.params).map(([key, spec]) => `- ${key}: ${JSON.stringify(def.values[key])} (${spec.description})`)
  return [`# ${def.name}`, `${type.label} in the rule set ${gameDefs.ruleSet(ruleSet).name}, id \`${def.id}\`: ${type.line(def)}`, def.notes, rows.join('\n')].filter(Boolean).join('\n\n')
}

function located(type: DefType, ref: string): { ruleSet: string; def: GameDef } {
  const { ruleSet, id } = splitDefRef(ref)
  if (ruleSet) return { ruleSet, def: gameDefs.get(ruleSet, type.type, id) }
  const found = gameDefs.find(type.type, ref)
  if (!found) throw new Error(`No ${type.label.toLowerCase()} "${ref}". Use find with kind ${type.type} to list them.`)
  return found
}

function kindOf(type: DefType): Kind {
  const k = type.type
  const text = (ref: string) => {
    const { ruleSet, def } = located(type, ref)
    return defText(type, ruleSet, def)
  }
  return {
    kind: k,
    presents: { chat: true, widget: ENTRY_WIDGET },
    label: type.label,
    plural: type.plural,
    icon: type.icon,
    description: `${type.description}. Each belongs to a rule set; ids are <rule set>/<id>`,
    group: 'Game',
    source: 'Game',
    parts: [],
    actions: [],
    exportable: true,
    export: (ref) => {
      const { ruleSet, def } = located(type, ref)
      return { title: def.name, markdown: defText(type, ruleSet, def), json: { ruleSet, ...def } }
    },
    available: () => true,
    search(query, limit) {
      const q = query.trim().toLowerCase()
      const sets = gameDefs.ruleSets()
      return sets
        .flatMap((set) =>
          gameDefs
            .list(set.id, k)
            .filter((d) => !q || d.name.toLowerCase().includes(q) || d.id.includes(q) || d.notes.toLowerCase().includes(q))
            .map((d) => ({ kind: k, id: defRef(set.id, d.id), title: sets.length > 1 ? `${d.name} (${set.name})` : d.name }))
        )
        .slice(0, limit)
    },
    resolve: (ref) => {
      const found = gameDefs.find(k, ref)
      return found ? defRef(found.ruleSet, found.def.id) : null
    },
    line: (ref) => type.line(located(type, ref).def),
    card: text,
    full: text,
    title: (ref) => located(type, ref).def.name,
    remove: (ref) => {
      const { ruleSet, def } = located(type, ref)
      gameDefs.remove(ruleSet, k, def.id)
    },
    rename: (ref, name) => {
      const { ruleSet, def } = located(type, ref)
      gameDefs.save(ruleSet, k, { ...def, name }, def.id)
    }
  }
}

function ruleSetText(id: string): string {
  const set = gameDefs.ruleSet(id)
  const counts = defTypes().map((t) => `- ${t.plural}: ${gameDefs.list(id, t.type).length}`)
  return [`# ${set.name}`, `Rule set, id \`${set.id}\`. Worlds pick a rule set; everything played in them uses only its definitions and templates.`, set.notes, counts.join('\n')].filter(Boolean).join('\n\n')
}

const ruleSetKind: Kind = {
  kind: RULE_SET_KIND,
  presents: { chat: true, widget: ENTRY_WIDGET },
  label: 'Rule set',
  plural: 'Rule sets',
  icon: 'book-open',
  description: 'a whole set of game rules a world plays by: its stats, damage types, formulas, clocks, checks and templates',
  group: 'Game',
  source: 'Game',
  parts: [],
  actions: [],
  exportable: true,
  export: (id) => ({ title: gameDefs.ruleSet(id).name, markdown: ruleSetText(id), json: gameDefs.ruleSet(id) }),
  available: () => true,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return gameDefs
      .ruleSets()
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.id.includes(q) || s.notes.toLowerCase().includes(q))
      .slice(0, limit)
      .map((s) => ({ kind: RULE_SET_KIND, id: s.id, title: s.name }))
  },
  resolve: (ref) => {
    const key = ref.replace(/^@?[a-z_]+:/i, '').trim().toLowerCase()
    return gameDefs.ruleSets().find((s) => s.id === key || s.name.toLowerCase() === key)?.id ?? null
  },
  line: (id) => defTypes().map((t) => `${gameDefs.list(id, t.type).length} ${t.plural.toLowerCase()}`).join(', '),
  card: ruleSetText,
  full: ruleSetText,
  title: (id) => gameDefs.ruleSet(id).name,
  remove: (id) => void removeRuleSet(id),
  rename: (id, name) => void gameDefs.saveRuleSet(id, name, gameDefs.ruleSet(id).notes, null)
}

export const SAVE_KIND = 'game_save'

function saveText(id: string): string {
  const save = saves.get(id)
  const world = worlds.exists(save.world) ? worlds.meta(save.world).name : save.world
  const who = Object.keys(save.characters).map((sheet) => {
    try {
      return getSheet(sheet).title
    } catch {
      return sheet
    }
  })
  return [`# ${save.name}`, `Save, id \`${save.id}\`: a playthrough of the world ${world}. Everything that happens in play is kept in it.`, `Characters: ${who.length ? who.join(', ') : 'none'}`, `Flags: ${Object.keys(save.flags).join(', ') || 'none'}`].join('\n\n')
}

const saveKind: Kind = {
  kind: SAVE_KIND,
  presents: { chat: true, widget: ENTRY_WIDGET },
  label: 'Save',
  plural: 'Saves',
  icon: 'save',
  description: 'a playthrough of a world, with its own characters; a character is in one save at a time',
  group: 'Game',
  source: 'Game',
  parts: [],
  actions: [],
  exportable: false,
  available: () => true,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return saves
      .list()
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.world.includes(q))
      .slice(0, limit)
      .map((s) => ({ kind: SAVE_KIND, id: s.id, title: s.name }))
  },
  resolve: (ref) => {
    const key = ref.replace(/^@?[a-z_]+:/i, '').trim().toLowerCase()
    return saves.list().find((s) => s.id === key || s.name.toLowerCase() === key)?.id ?? null
  },
  line: (id) => {
    const save = saves.get(id)
    return `${worlds.exists(save.world) ? worlds.meta(save.world).name : save.world}, ${Object.keys(save.characters).length} characters`
  },
  card: saveText,
  full: saveText,
  title: (id) => saves.get(id).name,
  remove: (id) => void removeSave(id),
  rename: (id, name) => void saves.rename(id, name)
}

export function gameKinds(): Kind[] {
  return [ruleSetKind, saveKind, ...defTypes().map(kindOf)]
}
