import type { Size } from '../shapes'
import type { PropCollision } from '../maps'
import { toId } from '../ids'

export type MapObjectGraphicSource =
  | { type: 'seven'; assetId: string }
  | { type: 'file'; assetId: string; filePath?: string }
  | { type: 'tile'; assetId: string; col: number; row: number; tileW: number; tileH: number; gid?: number }

export interface StoredMapObject {
  id: string
  name: string
  image: string
  size: Size
  graphicSource?: MapObjectGraphicSource
  collision: PropCollision
  actions: string
  decisions: string
  entry?: string | null
  description: string
  tags: string[]
  updatedAt: number
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export function cleanStoredMapObject(raw: unknown): StoredMapObject | null {
  const v = obj(raw)
  const name = str(v.name).trim()
  if (!name) return null
  const id = (str(v.id) && toId(str(v.id))) || toId(name)
  const image = str(v.image)
  const sizeObj = obj(v.size)
  const size: Size = {
    w: Number(sizeObj.w) || 32,
    h: Number(sizeObj.h) || 32
  }
  const collision: PropCollision = v.collision === 'solid' ? 'solid' : 'passable'
  const tags = Array.isArray(v.tags)
    ? v.tags.filter((t): t is string => typeof t === 'string' && Boolean(t.trim())).map((t) => toId(t))
    : []

  return {
    id,
    name,
    image,
    size,
    graphicSource: v.graphicSource as MapObjectGraphicSource | undefined,
    collision,
    actions: str(v.actions),
    decisions: str(v.decisions),
    entry: str(v.entry) || null,
    description: str(v.description),
    tags,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now()
  }
}

export function blankStoredMapObject(): StoredMapObject {
  return {
    id: '',
    name: '',
    image: '',
    size: { w: 32, h: 32 },
    graphicSource: undefined,
    collision: 'solid',
    actions: '',
    decisions: '',
    entry: null,
    description: '',
    tags: [],
    updatedAt: Date.now()
  }
}

export function storedMapObjectText(o: StoredMapObject): string {
  const lines: string[] = [`# Object: ${o.name}`, `Collision: ${o.collision}`]
  if (o.description) lines.push(o.description)
  if (o.entry) lines.push(`Linked Entry: ${o.entry}`)
  if (o.actions) lines.push(`Actions:\n${o.actions}`)
  if (o.decisions) lines.push(`Decisions:\n${o.decisions}`)
  if (o.tags.length) lines.push(`Tags: ${o.tags.map((tg) => `#${tg}`).join(' ')}`)
  return lines.join('\n\n')
}
