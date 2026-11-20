import { useEffect, useId } from 'react'
import { create } from 'zustand'
import { showName } from '@shared/ids'
import type { CharacterSheet, CollectionRecord, ImageContextSnippet, ImagePromptContext } from '@shared/types'

interface RegisteredContext {
  id: string
  context: ImagePromptContext
}

const useContextStack = create<{ entries: RegisteredContext[] }>(() => ({ entries: [] }))

/** Register the active screen's prompt context while mounted so modals opened over it can pull fields into prompts. */
export function useRegisterImageContext(context: ImagePromptContext | null): void {
  const id = useId()
  useEffect(() => {
    if (!context || context.snippets.length === 0) {
      useContextStack.setState((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
      return
    }
    useContextStack.setState((s) => {
      const rest = s.entries.filter((e) => e.id !== id)
      return { entries: [...rest, { id, context }] }
    })
    return () => {
      useContextStack.setState((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
    }
  }, [id, context])
}

/** Subscribe to the topmost active screen context underneath modals or Image view. */
export function useActiveImageContext(): ImagePromptContext | null {
  return useContextStack((s) => s.entries[s.entries.length - 1]?.context ?? null)
}

/** Merge an explicit caller context with an ambient screen context without duplicating snippets. */
export function mergeImageContexts(explicit?: ImagePromptContext | null, ambient?: ImagePromptContext | null): ImagePromptContext | null {
  if (!explicit) return ambient ?? null
  if (!ambient) return explicit
  const seen = new Set(explicit.snippets.map((s) => s.text.toLowerCase()))
  const extra = ambient.snippets.filter((s) => !seen.has(s.text.toLowerCase()))
  return {
    ...explicit,
    suggestedPrompt: explicit.suggestedPrompt ?? ambient.suggestedPrompt,
    snippets: [...explicit.snippets, ...extra]
  }
}

const cleanSnippet = (text: string, max = 220): string => {
  const single = text.replace(/\s+/g, ' ').trim()
  if (single.length <= max) return single
  return `${single.slice(0, max - 1).trimEnd()}…`
}

const VISUAL_FIELD_RE = /appear|look|hair|eye|skin|build|height|weight|cloth|outfit|armor|wear|dress|face|scar|species|race|ancestry|age|gender|desc|style|visual|trait/i

/** Build clickable prompt snippets and a portrait suggestion from a CharacterSheet. */
export function sheetImageContext(sheet: Pick<CharacterSheet, 'title' | 'fields' | 'values' | 'dnd' | 'story'>): ImagePromptContext {
  const name = showName(sheet.title).trim() || 'Character'
  const snippets: ImageContextSnippet[] = [{ id: 'name', label: 'Name', text: name }]

  const visualFields: ImageContextSnippet[] = []
  const otherFields: ImageContextSnippet[] = []
  const seenKeys = new Set<string>()
  const fieldKeys = [...sheet.fields, ...Object.keys(sheet.values)]

  for (const key of fieldKeys) {
    if (!key || seenKeys.has(key)) continue
    seenKeys.add(key)
    const raw = sheet.values[key]
    const trimmed = typeof raw === 'string' ? raw.trim() : ''
    if (!trimmed) continue
    const snippet: ImageContextSnippet = {
      id: `field:${key}`,
      label: key,
      text: `${key}: ${cleanSnippet(trimmed, 240)}`
    }
    if (VISUAL_FIELD_RE.test(key)) visualFields.push(snippet)
    else otherFields.push(snippet)
  }

  snippets.push(...visualFields, ...otherFields)

  if (sheet.dnd) {
    const parts = [
      sheet.dnd.level ? `Level ${sheet.dnd.level}` : null,
      sheet.dnd.race?.trim() || null,
      sheet.dnd.cls?.trim() || null,
      sheet.dnd.background?.trim() ? `(${sheet.dnd.background.trim()})` : null
    ].filter(Boolean)
    if (parts.length) {
      snippets.push({ id: 'dnd', label: 'D&D Build', text: parts.join(' ') })
    }
  }

  if (sheet.story?.backstorySummary?.trim()) {
    snippets.push({ id: 'backstory', label: 'Backstory', text: cleanSnippet(sheet.story.backstorySummary, 240) })
  }
  if (sheet.story?.where?.trim()) {
    snippets.push({ id: 'setting', label: 'Setting', text: `Setting: ${cleanSnippet(sheet.story.where, 140)}` })
  }
  if (sheet.story?.mood?.trim()) {
    snippets.push({ id: 'mood', label: 'Mood', text: `Mood: ${cleanSnippet(sheet.story.mood, 100)}` })
  }

  const visualParts = visualFields.slice(0, 5).map((s) => s.text)
  const dndSummary = snippets.find((s) => s.id === 'dnd')?.text
  const suggestedParts = [`Character portrait of ${name}`, dndSummary, ...visualParts].filter(Boolean)

  return {
    title: `Character: ${name}`,
    subject: name,
    suggestedPrompt: suggestedParts.join(', '),
    snippets
  }
}

/** Build prompt snippets from an Agent profile and optional linked CharacterSheet. */
export function agentImageContext(
  agent: { name: string; description: string; systemPrompt?: string },
  linkedSheet?: CharacterSheet | null
): ImagePromptContext {
  const name = agent.name.trim() || 'Agent'
  const snippets: ImageContextSnippet[] = [{ id: 'agent-name', label: 'Name', text: name }]
  if (agent.description.trim()) {
    snippets.push({ id: 'agent-desc', label: 'Description', text: cleanSnippet(agent.description, 240) })
  }
  if (agent.systemPrompt?.trim()) {
    snippets.push({ id: 'agent-prompt', label: 'Persona', text: cleanSnippet(agent.systemPrompt, 240) })
  }
  const base: ImagePromptContext = {
    title: `Agent: ${name}`,
    subject: name,
    suggestedPrompt: [name, agent.description.trim() ? cleanSnippet(agent.description, 180) : null].filter(Boolean).join(', '),
    snippets
  }
  if (!linkedSheet) return base
  return mergeImageContexts(base, sheetImageContext(linkedSheet)) ?? base
}

/** Build prompt snippets from a Library page title, body, and records. */
export function pageImageContext(
  page: { title: string; body?: string; records?: CollectionRecord[] },
  typeLabel?: string | null
): ImagePromptContext {
  const title = page.title.trim() || 'Untitled page'
  const snippets: ImageContextSnippet[] = [{ id: 'page-title', label: 'Title', text: title }]
  if (typeLabel?.trim()) snippets.push({ id: 'page-type', label: 'Kind', text: typeLabel.trim() })
  if (page.body?.trim()) {
    const plain = page.body.replace(/[#>*`\[\]]+/g, ' ')
    snippets.push({ id: 'page-body', label: 'Page text', text: cleanSnippet(plain, 260) })
  }
  const firstRecord = page.records?.[0]
  if (firstRecord) {
    const pairs = Object.entries(firstRecord.values ?? {})
      .filter(([, v]) => (typeof v === 'string' || typeof v === 'number' || Array.isArray(v)) && String(v).trim())
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${cleanSnippet(Array.isArray(v) ? v.join(', ') : String(v), 80)}`)
    if (pairs.length) snippets.push({ id: 'page-record', label: 'Row details', text: pairs.join(', ') })
  }
  const bodyBit = snippets.find((s) => s.id === 'page-body')?.text
  return {
    title: `Page: ${title}`,
    subject: title,
    suggestedPrompt: bodyBit ? `${title}, ${cleanSnippet(bodyBit, 180)}` : title,
    snippets
  }
}

/** Build prompt snippets for a Map Object / sprite. */
export function mapObjectImageContext(obj: { name: string; description: string; tags?: string[] }): ImagePromptContext {
  const name = obj.name.trim() || 'Map object'
  const snippets: ImageContextSnippet[] = [{ id: 'obj-name', label: 'Name', text: name }]
  if (obj.description.trim()) snippets.push({ id: 'obj-desc', label: 'Description', text: cleanSnippet(obj.description, 220) })
  if (obj.tags?.length) snippets.push({ id: 'obj-tags', label: 'Tags', text: obj.tags.join(', ') })
  return {
    title: `Map object: ${name}`,
    subject: name,
    suggestedPrompt: [`2D top-down game sprite of ${name}`, obj.description.trim() ? cleanSnippet(obj.description, 160) : null].filter(Boolean).join(', '),
    snippets
  }
}

function labeledImageContext(kind: string, fallback: string, title: string, fields: { label: string; text: string }[]): ImagePromptContext {
  const cleanTitle = title.trim() || fallback
  const snippets: ImageContextSnippet[] = [{ id: `${kind.toLowerCase()}-title`, label: kind, text: cleanTitle }]
  for (const f of fields) {
    if (!f.text.trim()) continue
    snippets.push({ id: `${kind.toLowerCase()}:${f.label}`, label: f.label, text: `${f.label}: ${cleanSnippet(f.text, 200)}` })
  }
  return {
    title: `${kind}: ${cleanTitle}`,
    subject: cleanTitle,
    suggestedPrompt: snippets.slice(0, 3).map((s) => s.text).join(', '),
    snippets
  }
}

/** Build prompt snippets for a Card editor. */
export function cardImageContext(title: string, fields: { label: string; text: string }[]): ImagePromptContext {
  return labeledImageContext('Card', 'Card', title, fields)
}

/** Build prompt snippets for a Map editor. */
export function mapImageContext(title: string, fields: { label: string; text: string }[]): ImagePromptContext {
  return labeledImageContext('Map', 'Map', title, fields)
}
