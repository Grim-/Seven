import { matchSnippet, plainText } from '@shared/text'
import { COMPENDIUM, entryMarkdown, entrySummary, type CompendiumEntry, type CompendiumKindInfo } from '@shared/compendium'
import { ENTRY_WIDGET, type Kind } from '../../engine/library/kinds'
import { freeName } from '../../engine/library/packing'
import { compendium } from './compendium'

function kindOf(info: CompendiumKindInfo): Kind {
  const k = info.kind
  return {
    kind: k,
    presents: { chat: true, widget: ENTRY_WIDGET },
    label: info.label,
    plural: info.plural,
    icon: info.icon,
    description: info.description,
    group: 'D&D',
    source: 'D&D',
    parts: [],
    actions: [],
    exportable: true,
    export: (id) => {
      const e = compendium.get(k, id)
      return { title: e.name, markdown: entryMarkdown(k, e), json: e }
    },
    pack: (id) => {
      const e = compendium.get(k, id)
      return compendium.isSrd(k, e.id) && e.source !== 'Yours' ? undefined : e
    },
    unpack: (value, how) => {
      const raw = (value && typeof value === 'object' ? value : {}) as CompendiumEntry
      const taken = new Set(compendium.all(k).map((e) => e.name.toLowerCase()))
      const name = how.replace ? raw.name : freeName(raw.name || `Imported ${info.label}`, (n) => taken.has(n.toLowerCase()))
      return compendium.save(k, { ...raw, name }, how.replace ?? null).id
    },
    available: () => true,
    search(query, limit) {
      const q = query.trim().toLowerCase()
      const all = compendium.all(k)
      const named = q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all
      const inText = q ? all.filter((e) => !e.name.toLowerCase().includes(q) && e.text.toLowerCase().includes(q)) : []
      return [...named.map((e) => ({ kind: k, id: e.id, title: e.name })), ...inText.map((e) => ({ kind: k, id: e.id, title: e.name, excerpt: matchSnippet(plainText(e.text), q) }))].slice(0, limit)
    },
    resolve: (ref) => compendium.find(k, ref)?.id ?? null,
    line: (id) => entrySummary(k, compendium.get(k, id)),
    card: (id) => entryMarkdown(k, compendium.get(k, id)),
    full: (id) => entryMarkdown(k, compendium.get(k, id)),
    title: (id) => compendium.get(k, id).name,
    remove: (id) => void compendium.remove(k, id)
  }
}

export function compendiumKinds(): Kind[] {
  return COMPENDIUM.map(kindOf)
}
