import { blankDnd, withPersona } from '@shared/dnd'
import { sheetFacets } from '../facets'
import { DndTab } from './DndTab'

sheetFacets.add({
  name: 'D&D 5E',
  module: 'dnd',
  id: 'dnd',
  label: () => 'D&D 5E',
  order: 10,
  system: true,
  has: (_sheet, draft) => draft.dnd !== null,
  attach: (draft) => ({ ...draft, dnd: blankDnd(), fields: withPersona(draft.fields) }),
  opensFirst: (draft) => draft.dnd !== null && !draft.fields.some((f) => draft.values[f]?.trim()),
  Tab: ({ draft, change, open }) => <DndTab dnd={draft.dnd} onChange={(dnd) => change({ ...draft, dnd, fields: dnd && !draft.dnd ? withPersona(draft.fields) : draft.fields })} story={draft.story} onStory={(story) => change({ ...draft, story })} onOpenStory={() => open('sheet')} />
})
