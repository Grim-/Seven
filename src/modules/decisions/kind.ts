import { decisionModeLabel, storedDecisionText } from '@shared/storedDecision'
import { ENTRY_WIDGET, type Kind } from '../../engine/library/kinds'
import { decisions } from './store'

const has = (text: string, q: string) => text.toLowerCase().includes(q)

export const decisionKind: Kind = {
  kind: 'decision',
  presents: { chat: true, widget: ENTRY_WIDGET },
  label: 'Decision',
  plural: 'Decisions',
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
      .map((d) => ({ kind: 'decision', id: d.id, title: d.name }))
  },
  resolve: (ref) => decisions.find(ref)?.id ?? null,
  line(id) {
    const d = decisions.get(id)
    return `${decisionModeLabel(d)}${d.tags.length ? ` · ${d.tags.join(', ')}` : ''}`
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
