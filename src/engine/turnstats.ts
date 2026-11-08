import path from 'node:path'
import type { ModelStats, StatRecord, StatsSummary } from '@shared/types'
import { dataRoot } from './util/paths'
import { appendLine, readLines, removePath } from './util/fs'

const FILE = path.join(dataRoot, 'stats.jsonl')
const MIN_EVAL_TOKENS = 64

export function recordTurn(record: StatRecord): void {
  appendLine(FILE, record)
}

export function clearStats(): void {
  removePath(FILE)
}

const rate = (tokens: number, ms: number) => (ms > 200 && tokens > 0 ? Math.round((tokens / (ms / 1000)) * 10) / 10 : null)

export function summarize(host: StatsSummary['host']): StatsSummary {
  const all = readLines<StatRecord>(FILE).filter((r) => r && typeof r.modelId === 'string')
  const groups = new Map<string, StatRecord[]>()
  for (const r of all) {
    const key = `${r.modelId}\u0000${r.contextSize}\u0000${r.gpuLayers ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  const models: ModelStats[] = [...groups.values()].map((list) => {
    const last = list[list.length - 1]
    const gen = list.reduce((a, r) => ({ t: a.t + r.genTokens, ms: a.ms + r.genMs }), { t: 0, ms: 0 })
    const evals = list.filter((r) => r.evalTokens >= MIN_EVAL_TOKENS).reduce((a, r) => ({ t: a.t + r.evalTokens, ms: a.ms + r.evalMs }), { t: 0, ms: 0 })
    const ttfts = list.map((r) => r.ttftMs).filter((v): v is number => typeof v === 'number')
    const busy = list.reduce((a, r) => a + r.toolMs + r.genMs + r.evalMs, 0)
    const tools = list.reduce((a, r) => a + r.toolMs, 0)
    return {
      modelId: last.modelId,
      modelName: last.modelName,
      contextSize: last.contextSize,
      gpuLayers: last.gpuLayers,
      turns: list.length,
      genPerSecond: rate(gen.t, gen.ms),
      promptPerSecond: rate(evals.t, evals.ms),
      ttftMs: ttfts.length ? Math.round(ttfts.reduce((a, v) => a + v, 0) / ttfts.length) : null,
      toolShare: busy > 0 ? Math.round((tools / busy) * 100) / 100 : null,
      lastAt: last.at
    }
  })
  models.sort((a, b) => b.lastAt - a.lastAt)
  return { models, recent: all.slice(-20).reverse(), host }
}
