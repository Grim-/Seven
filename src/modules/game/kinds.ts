import { defTypes, type DefType, type GameDef } from '@shared/game/defs'
import { ENTRY_WIDGET, type Kind } from '../../engine/library/kinds'
import { gameDefs } from './store'
import { saves } from '../../engine/worlds/saves'
import { removeSave } from '../../engine/worlds/party'
import { worlds } from '../../engine/worlds/store'
import { getSheet } from '../../engine/library/sheets'

function defText(type: DefType, def: GameDef): string {
  const rows = Object.entries(type.params).map(([key, spec]) => `- ${key}: ${JSON.stringify(def.values[key])} (${spec.description})`)
  return [`# ${def.name}`, `${type.label}, id \`${def.id}\`: ${type.line(def)}`, def.notes, rows.join('\n')].filter(Boolean).join('\n\n')
}

function located(type: DefType, ref: string): GameDef {
  const found = gameDefs.find(type.type, ref)
  if (!found) throw new Error(`No ${type.label.toLowerCase()} "${ref}". Use find with kind ${type.type} to list them.`)
  return found
}

function kindOf(type: DefType): Kind {
  const k = type.type
  const text = (ref: string) => defText(type, located(type, ref))
  return {
    kind: k,
    presents: { chat: true, widget: ENTRY_WIDGET },
    label: type.label,
    plural: type.plural,
    icon: type.icon,
    description: type.description,
    group: 'Game',
    source: 'Game',
    parts: [],
    actions: [],
    exportable: true,
    export: (ref) => {
      const def = located(type, ref)
      return { title: def.name, markdown: defText(type, def), json: def }
    },
    available: () => true,
    search(query, limit) {
      const q = query.trim().toLowerCase()
      return gameDefs
        .list(k)
        .filter((d) => !q || d.name.toLowerCase().includes(q) || d.id.includes(q) || d.notes.toLowerCase().includes(q))
        .slice(0, limit)
        .map((d) => ({ kind: k, id: d.id, title: d.name }))
    },
    resolve: (ref) => gameDefs.find(k, ref)?.id ?? null,
    line: (ref) => type.line(located(type, ref)),
    card: text,
    full: text,
    title: (ref) => located(type, ref).name,
    remove: (ref) => void gameDefs.remove(k, located(type, ref).id),
    rename: (ref, name) => {
      const def = located(type, ref)
      gameDefs.save(k, { ...def, name }, def.id)
    }
  }
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
  return [saveKind, ...defTypes().map(kindOf)]
}
