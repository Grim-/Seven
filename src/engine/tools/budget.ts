import path from 'node:path'
import { writeText } from '../util/fs'

export interface OutputBudget {
  maxTokens: number
  count: (text: string) => number
  dir: string
  room?: () => number | null
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

export function outputFile(dir: string, id: string): string {
  return path.join(dir, `${id}.txt`)
}

function cut(lines: string[], headCount: number, tailCount: number, id: string, totalTokens: number): string {
  const head = lines.slice(0, headCount)
  const tail = tailCount > 0 ? lines.slice(lines.length - tailCount) : []
  const firstTail = lines.length - tailCount + 1
  const shown = tail.length ? `lines 1-${headCount} and ${firstTail}-${lines.length}` : `lines 1-${headCount}`
  const note = `… [Cut to fit: showing ${shown} of ${lines.length} (about ${totalTokens} tokens in full). read_kind(result, ${id}, false) gives all of it.] …`
  return [...head, note, ...tail].join('\n')
}

export function fitToBudget(id: string, text: string, budget: OutputBudget): { text: string; saved: boolean } {
  const total = budget.count(text)
  if (total <= budget.maxTokens) return { text, saved: false }
  writeText(outputFile(budget.dir, id), text)
  let lines = text.split('\n')
  if (lines.length < 4) {
    const chunk = Math.max(200, Math.floor((text.length / total) * budget.maxTokens * 0.4))
    lines = text.match(new RegExp(`[\\s\\S]{1,${chunk}}`, 'g')) ?? [text]
  }
  const ratio = budget.maxTokens / total
  let head = Math.max(1, Math.floor(lines.length * ratio * 0.65))
  let tail = Math.max(0, Math.floor(lines.length * ratio * 0.25))
  for (let i = 0; i < 12; i++) {
    const candidate = cut(lines, head, tail, id, total)
    if (budget.count(candidate) <= budget.maxTokens || head <= 1) return { text: candidate, saved: true }
    head = Math.max(1, Math.floor(head * 0.75))
    tail = Math.floor(tail * 0.75)
  }
  return { text: cut(lines, 1, 0, id, total), saved: true }
}
