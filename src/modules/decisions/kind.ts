import { decisionModeLabel, storedDecisionText } from '@shared/storedDecision'
import { storedActionText } from '@shared/storedAction'
import { ENTRY_WIDGET, type Kind } from '../../engine/library/kinds'
import { storePacking } from '../../engine/library/packing'
import { decisions, storyActions } from './store'

const has = (text: string, q: string) => text.toLowerCase().includes(q)
const tagLine = (tags: string[]) => (tags.length ? ` · ${tags.join(', ')}` : '')

export const decisionKind: Kind = {
  kind: 'story_decision',
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({
    find: (id) => decisions.list().find((d) => d.id === id) ?? null,
    names: () => decisions.list().map((d) => d.name),
    save: ({ id, ...rest }) => decisions.save(rest, typeof id === 'string' ? id : null)
  }),
  label: 'Story decision',
  plural: 'Story decisions',
  icon: 'split',
  description: 'stored decisions: options, or a prompt to write them from; the user picks one or a die does',
  group: 'Worlds',
  parts: [],
  actions: ['decide', 'roll_decision', 'create_decisions'],
  exportable: true,
  export(id) {
    const d = decisions.get(id)
    return { title: d.name, markdown: storedDecisionText(d), json: d }
  },
  available: () => true,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return decisions
      .list()
      .filter((d) => !q || has(d.name, q) || has(d.prompt, q) || d.tags.some((t) => t.includes(q)))
      .slice(0, limit)
      .map((d) => ({ kind: 'story_decision', id: d.id, title: d.name }))
  },
  resolve: (ref) => decisions.find(ref)?.id ?? null,
  line(id) {
    const d = decisions.get(id)
    return `${decisionModeLabel(d)}${tagLine(d.tags)}`
  },
  card: (id) => storedDecisionText(decisions.get(id)),
  full: (id) => storedDecisionText(decisions.get(id)),
  title(id) {
    try {
      return decisions.get(id).name
    } catch {
      return id
    }
  },
  remove: (id) => decisions.remove(id),
  rename: (id, name) => void decisions.save({ ...decisions.get(id), name })
}

export const storyActionKind: Kind = {
  kind: 'story_action',
  presents: { chat: true, widget: ENTRY_WIDGET },
  ...storePacking({
    find: (id) => storyActions.list().find((a) => a.id === id) ?? null,
    names: () => storyActions.list().map((a) => a.name),
    save: ({ id, ...rest }) => storyActions.save(rest, typeof id === 'string' ? id : null)
  }),
  label: 'Story action',
  plural: 'Story actions',
  icon: 'swords',
  description: 'stored actions: what is attempted, the checks for it and what happens on a pass or a fail',
  group: 'Worlds',
  parts: [],
  actions: ['action_check'],
  exportable: true,
  export(id) {
    const a = storyActions.get(id)
    return { title: a.name, markdown: storedActionText(a), json: a }
  },
  available: () => true,
  search(query, limit) {
    const q = query.trim().toLowerCase()
    return storyActions
      .list()
      .filter((a) => !q || has(a.name, q) || has(a.action.attempt, q) || a.tags.some((t) => t.includes(q)))
      .slice(0, limit)
      .map((a) => ({ kind: 'story_action', id: a.id, title: a.name }))
  },
  resolve: (ref) => storyActions.find(ref)?.id ?? null,
  line(id) {
    const a = storyActions.get(id)
    return `${a.action.checks.length} check${a.action.checks.length === 1 ? '' : 's'}${tagLine(a.tags)}`
  },
  card: (id) => storedActionText(storyActions.get(id)),
  full: (id) => storedActionText(storyActions.get(id)),
  title(id) {
    try {
      return storyActions.get(id).name
    } catch {
      return id
    }
  },
  remove: (id) => storyActions.remove(id),
  rename: (id, name) => void storyActions.save({ ...storyActions.get(id), name })
}
