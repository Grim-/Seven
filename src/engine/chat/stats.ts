import type { ContextUsage, TurnStats } from '@shared/types'
import type { ApiChat } from '../model/apiChat'

export class TurnMeter {
  private start = Date.now()
  private inputBefore: number
  private outputBefore: number
  private firstAt: number | null = null
  private firstInput = 0
  private firstIndex = 0

  private span: { kind: string; at: number; input: number; output: number } | null = null
  private totals = { evalMs: 0, evalTokens: 0, genMs: 0, genTokens: 0, toolMs: 0, waitMs: 0 }

  constructor(private chat: ApiChat) {
    this.inputBefore = chat.usage.input
    this.outputBefore = chat.usage.output
  }

  private close(now: number): void {
    const s = this.span
    if (!s) return
    const meter = this.chat.usage
    const ms = now - s.at
    if (s.kind === 'reading') {
      this.totals.evalMs += ms
      this.totals.evalTokens += meter.input - s.input
    } else if (s.kind === 'thinking' || s.kind === 'writing' || s.kind === 'calling') {
      this.totals.genMs += ms
      this.totals.genTokens += meter.output - s.output
    } else if (s.kind === 'tool') this.totals.toolMs += ms
    else if (s.kind === 'waiting') this.totals.waitMs += ms
    this.span = null
  }

  phase(kind: string): void {
    const now = Date.now()
    this.close(now)
    const meter = this.chat.usage
    this.span = { kind, at: now, input: meter.input, output: meter.output }
  }

  mark(): void {
    if (this.firstAt !== null) return
    this.firstAt = Date.now()
    this.firstInput = this.chat.usage.input - this.inputBefore
    this.firstIndex = this.chat.used
  }

  finish(): TurnStats {
    const chat = this.chat
    const end = Date.now()
    this.close(end)
    const t = this.totals
    const inputTokens = chat.usage.input - this.inputBefore
    const outputTokens = chat.usage.output - this.outputBefore
    const promptTokens = this.firstAt !== null ? this.firstIndex : chat.used
    const evaluatedTokens = this.firstAt !== null ? this.firstInput : inputTokens
    const genMs = this.firstAt !== null ? end - this.firstAt : 0
    return {
      promptTokens,
      reusedTokens: Math.max(0, promptTokens - evaluatedTokens),
      evaluatedTokens,
      ttftMs: this.firstAt !== null ? this.firstAt - this.start : null,
      inputTokens,
      outputTokens,
      genMs,
      tokensPerSecond: t.genMs > 200 && t.genTokens > 0 ? Math.round((t.genTokens / (t.genMs / 1000)) * 10) / 10 : genMs > 0 && outputTokens > 0 ? Math.round((outputTokens / (genMs / 1000)) * 10) / 10 : null,
      contextUsed: chat.used,
      contextSize: chat.contextSize,
      evalTokens: t.evalTokens,
      evalMs: t.evalMs,
      genTokens: t.genTokens,
      genPureMs: t.genMs,
      toolMs: t.toolMs,
      waitMs: t.waitMs,
      promptPerSecond: t.evalMs > 200 && t.evalTokens > 0 ? Math.round((t.evalTokens / (t.evalMs / 1000)) * 10) / 10 : null
    }
  }
}

export function usageOf(total: number, fixed: number, before: number, size: number, live = false): ContextUsage {
  return {
    used: total,
    size,
    fixed,
    history: Math.max(0, before - fixed),
    turn: Math.max(0, total - before),
    live,
    at: Date.now()
  }
}
