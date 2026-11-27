import { toId } from './ids'

export type KnowledgeScope = 'global' | 'local'

export const KNOWLEDGE_SCOPES: KnowledgeScope[] = ['global', 'local']

export interface WorldKnowledge {
  id: string
  name: string
  text: string
  tags: string[]
  pinned?: boolean
  cue?: boolean
  image: string | null
  scope: KnowledgeScope
  updatedAt: number
}

export const knowledgeRef = (world: string, id: string): string => `${world}/${id}`

export const KNOWLEDGE_SEGMENT = 'knowledge'

export const knowledgePart = (world: string, id: string): string => `${world}/${KNOWLEDGE_SEGMENT}/${id}`

export function splitKnowledgeRef(ref: string): { world: string; id: string } | null {
  const clean = ref.trim().replace(/^@?knowledge:/i, '').replace(/^"|"$/g, '')
  const at = clean.indexOf('/')
  if (at <= 0 || at === clean.length - 1) return null
  return { world: clean.slice(0, at), id: clean.slice(at + 1) }
}

export function blankKnowledge(): WorldKnowledge {
  return { id: '', name: '', text: '', tags: [], image: null, scope: 'global', updatedAt: Date.now() }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function cleanKnowledge(raw: unknown): WorldKnowledge | null {
  const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const name = str(v.name).trim()
  if (!name) return null
  const tags = Array.isArray(v.tags) ? [...new Set(v.tags.filter((t): t is string => typeof t === 'string' && Boolean(t.trim())).map((t) => t.trim().toLowerCase()))] : []
  return {
    id: toId(str(v.id) || name),
    name,
    text: str(v.text),
    tags,
    ...(v.pinned === true ? { pinned: true } : {}),
    ...(typeof v.cue === 'boolean' ? { cue: v.cue } : {}),
    image: str(v.image) || null,
    scope: KNOWLEDGE_SCOPES.includes(v.scope as KnowledgeScope) ? (v.scope as KnowledgeScope) : 'global',
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now()
  }
}

export function knowledgeText(k: WorldKnowledge, world: string): string {
  return [`# ${k.name} (@world:${world}/knowledge/${k.id})`, k.text.trim(), k.tags.length ? `Tags: #${k.tags.join(' #')}` : '']
    .filter(Boolean)
    .join('\n\n')
}
