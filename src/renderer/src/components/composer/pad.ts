import { useEffect, useRef, useState } from 'react'
import { referencePattern } from '@shared/text'
import { parseActions } from '@shared/actions'
import { parseDecisions } from '@shared/decisions'
import { moved } from '../ui'

export interface PadBlock {
  key: string
  text: string
}

export type BlockShape = { as: 'link'; link: string; kind: string; ref: string; part: string | null } | { as: 'action' } | { as: 'decision' } | { as: 'text' }

let counter = 0
const newKey = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`

export function toBlocks(text: string): PadBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ key: newKey(), text: t }))
}

export function toText(blocks: PadBlock[]): string {
  return blocks
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n\n')
}

export function shapeOf(text: string): BlockShape {
  const t = text.trim()
  const m = [...t.matchAll(referencePattern())]
  if (m.length === 1 && m[0][0].trim() === t) return { as: 'link', link: t, kind: m[0][2], ref: m[0][3], part: m[0][4] ?? null }
  if (parseActions(t).length === 1) return { as: 'action' }
  if (parseDecisions(t).length === 1) return { as: 'decision' }
  return { as: 'text' }
}

export interface Pad {
  blocks: PadBlock[]
  text: string
  add: (texts: string[], after?: string | null) => void
  replace: (key: string, text: string) => void
  remove: (key: string) => void
  move: (from: number, to: number) => void
  load: (text: string) => void
}

export function usePad(start: string, onText?: (text: string) => void): Pad {
  const [blocks, setBlocks] = useState<PadBlock[]>(() => toBlocks(start))
  const text = toText(blocks)
  const told = useRef(text)
  useEffect(() => {
    if (told.current === text) return
    told.current = text
    onText?.(text)
  }, [text])
  return {
    blocks,
    text,
    add: (texts, after = null) =>
      setBlocks((list) => {
        const made = texts.map((t) => ({ key: newKey(), text: t }))
        const at = after === null ? list.length : list.findIndex((b) => b.key === after) + 1
        return [...list.slice(0, at), ...made, ...list.slice(at)]
      }),
    replace: (key, next) => setBlocks((list) => list.map((b) => (b.key === key ? { ...b, text: next } : b))),
    remove: (key) => setBlocks((list) => list.filter((b) => b.key !== key)),
    move: (from, to) => setBlocks((list) => moved(list, from, to)),
    load: (next) => setBlocks(toBlocks(next))
  }
}
