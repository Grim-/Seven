import type { ExportBlock, ExportPart } from '@shared/exporting'
import { dndText } from '@shared/dnd'
import { storyHasContent, storyText } from '@shared/story'
import { entryId, entryMarkdown, type CompendiumKind } from '@shared/compendium'
import { getSheet } from '../library/sheets'
import { compendium } from '../../modules/dnd/compendium'
import { withoutTitle } from '@shared/text'
import { answerSection, linksSection, plural, type EntryCtx } from './entry'
import type { KindHandTo } from '../library/kinds'

function sheetPart(ctx: EntryCtx): ExportPart {
  const s = getSheet(ctx.id)
  const blocks: ExportBlock[] = []
  if (s.dnd) blocks.push({ h: 'D&D' }, { md: dndText(s.dnd) })
  for (const field of s.fields) {
    const text = (s.values[field] ?? '').trim()
    if (text) blocks.push({ h: field }, { md: text })
  }
  if (!blocks.length) blocks.push({ p: 'The sheet is empty.' })
  return { heading: `Character: ${s.title}`, blocks, json: { title: s.title, fields: Object.fromEntries(s.fields.map((f) => [f, s.values[f] ?? ''])), dnd: s.dnd } }
}

function storyPart(ctx: EntryCtx): ExportPart {
  const s = getSheet(ctx.id)
  const has = storyHasContent(s.story)
  return { heading: 'Story', blocks: [has ? { md: storyText(s.story) } : { p: 'No story yet.' }], json: s.story }
}

function rules(ctx: EntryCtx): { kind: CompendiumKind; name: string; markdown: string }[] {
  const d = getSheet(ctx.id).dnd
  if (!d) return []
  const wanted: [CompendiumKind, string][] = [
    ['race', d.race],
    ['class', d.cls],
    ...d.features.map((f): [CompendiumKind, string] => ['feature', f.name]),
    ...d.spells.map((x): [CompendiumKind, string] => ['spell', x.name]),
    ...d.equipment.map((x): [CompendiumKind, string] => ['equipment', x.name]),
    ...d.conditions.map((x): [CompendiumKind, string] => ['condition', x])
  ]
  const out: { kind: CompendiumKind; name: string; markdown: string }[] = []
  for (const [kind, name] of wanted) {
    if (!name.trim()) continue
    const hit = compendium.all(kind).find((e) => e.id === entryId(name))
    if (hit) out.push({ kind, name: hit.name, markdown: entryMarkdown(kind, hit) })
  }
  return out
}

function rulesPart(ctx: EntryCtx): ExportPart {
  const list = rules(ctx)
  return {
    heading: 'Rules for what it uses',
    blocks: list.length ? list.flatMap((r) => [{ h: `${r.kind}: ${r.name}` }, { md: withoutTitle(r.markdown, r.name) }]) : [{ p: 'None of its race, class, features, spells, equipment or conditions are in the compendium.' }],
    json: list
  }
}

export const SHEET_HAND_TO: KindHandTo = {
  sections: () => [
    { id: 'sheet', label: 'Character sheet', hint: 'D&D stats and every field', on: true, size: (c) => plural(sheetPart(c).blocks.length, 'block'), build: sheetPart },
    { id: 'story', label: 'Story', hint: 'where they are now, open threads and every session', on: true, size: (c) => plural(getSheet(c.id).story.sessions.length, 'session'), build: storyPart },
    linksSection,
    { id: 'rules', label: 'Rules for what it uses', hint: 'compendium text for its race, class, features, spells, equipment and conditions', on: false, size: (c) => plural(rules(c).length, 'entry'), build: rulesPart },
    answerSection
  ],
  presets: () => [
    { id: 'level', label: 'Level up', brief: 'Help me level this character up: what changes, what to pick and why.', sections: ['sheet', 'rules', 'answer'] },
    { id: 'session', label: 'Plan the next session', brief: 'Where does the story stand, what threads are open, and what could happen next?', sections: ['sheet', 'story', 'links'] },
    { id: 'backstory', label: 'Write backstory', brief: "Write this character's backstory so it fits who they are and what has happened so far.", sections: ['sheet', 'story', 'links', 'answer'] },
    { id: 'build', label: 'Review the build', brief: "Look at this character's build and tell me what works, what doesn't, and what to change.", sections: ['sheet', 'rules'] }
  ],
  answer: () => 'If you change the character, list each change under the sheet field or D&D stat it belongs to, with the new value in full, so I can copy it in. Keep names of spells, features and items as the compendium spells them.'
}
