export interface Act {
  name: string
  story_beat: string
  transition_threshold: string
  branches: { content: string }[]
}

export interface StoryTemplate {
  id: string
  title: string
  tags: string[]
  story_notes: string
  callToActionOptions: { content: string }[]
  acts: Act[]
  [key: string]: unknown
}

export interface Poi {
  tags: string[]
  description: string
  [key: string]: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function contents(value: unknown): { content: string }[] {
  return Array.isArray(value) ? value.map((v) => ({ content: text((v as { content?: unknown })?.content ?? v) })) : []
}

function tags(value: unknown): string[] {
  return Array.isArray(value) ? value.map((t) => String(t).toLowerCase()).filter(Boolean) : []
}

export function cleanAct(raw: unknown): Act {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { name: text(d.name), story_beat: text(d.story_beat), transition_threshold: text(d.transition_threshold), branches: contents(d.branches) }
}

export function cleanTemplate(raw: unknown, title: string): StoryTemplate {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    ...d,
    id: text(d.id).trim() || title,
    title: text(d.title).trim() || title,
    tags: tags(d.tags),
    story_notes: text(d.story_notes),
    callToActionOptions: contents(d.callToActionOptions),
    acts: Array.isArray(d.acts) ? d.acts.map(cleanAct) : []
  }
}

export function cleanPoi(raw: unknown): Poi {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { ...d, tags: tags(d.tags), description: text(d.description) }
}

export function blankAct(n: number): Act {
  return { name: `Act ${n}`, story_beat: '', transition_threshold: '', branches: [] }
}
