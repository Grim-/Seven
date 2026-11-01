import type { ChatHistoryItem, ChatModelFunctions, ChatWrapper, LlamaChatSession, LlamaModel } from 'node-llama-cpp'
import type { ContextUsage, TurnStats } from '@shared/types'

export function countRendered(wrapper: ChatWrapper, model: LlamaModel, history: ChatHistoryItem[], functions: ChatModelFunctions | undefined): number {
  const { contextText } = wrapper.generateContextState({ chatHistory: history, availableFunctions: functions })
  return contextText.tokenize(model.tokenizer).length
}

export function renderTokens(chat: LlamaChatSession, history: ChatHistoryItem[], functions: ChatModelFunctions | undefined): number {
  return countRendered(chat.chatWrapper, chat.model, history, functions)
}

const fixedCache = new Map<string, number>()

export function fixedTokens(chat: LlamaChatSession, systemPrompt: string, functions: ChatModelFunctions | undefined): number {
  const key = `${chat.model.filename ?? ''}\u0000${systemPrompt}\u0000${Object.keys(functions ?? {}).join(',')}`
  const cached = fixedCache.get(key)
  if (cached !== undefined) return cached
  const value = renderTokens(chat, systemPrompt ? [{ type: 'system', text: systemPrompt }] : [], functions)
  if (fixedCache.size > 50) fixedCache.clear()
  fixedCache.set(key, value)
  return value
}

function predictions(chat: LlamaChatSession): { used: number; checked: number } | null {
  if (!chat.sequence.tokenPredictor) return null
  const p = chat.sequence.tokenPredictions
  return { used: p.used, checked: p.validated + p.refuted }
}

export class TurnMeter {
  private start = Date.now()
  private inputBefore: number
  private outputBefore: number
  private predictedBefore: { used: number; checked: number } | null
  private firstAt: number | null = null
  private firstInput = 0
  private firstIndex = 0

  private span: { kind: string; at: number; input: number; output: number } | null = null
  private totals = { evalMs: 0, evalTokens: 0, genMs: 0, genTokens: 0, toolMs: 0, waitMs: 0 }

  constructor(private chat: LlamaChatSession) {
    const meter = chat.sequence.tokenMeter
    this.inputBefore = meter.usedInputTokens
    this.outputBefore = meter.usedOutputTokens
    this.predictedBefore = predictions(chat)
  }

  private close(now: number): void {
    const s = this.span
    if (!s) return
    const meter = this.chat.sequence.tokenMeter
    const ms = now - s.at
    if (s.kind === 'reading') {
      this.totals.evalMs += ms
      this.totals.evalTokens += meter.usedInputTokens - s.input
    } else if (s.kind === 'thinking' || s.kind === 'writing' || s.kind === 'calling') {
      this.totals.genMs += ms
      this.totals.genTokens += meter.usedOutputTokens - s.output
    } else if (s.kind === 'tool') this.totals.toolMs += ms
    else if (s.kind === 'waiting') this.totals.waitMs += ms
    this.span = null
  }

  phase(kind: string): void {
    const now = Date.now()
    this.close(now)
    const meter = this.chat.sequence.tokenMeter
    this.span = { kind, at: now, input: meter.usedInputTokens, output: meter.usedOutputTokens }
  }

  mark(): void {
    if (this.firstAt !== null) return
    this.firstAt = Date.now()
    this.firstInput = this.chat.sequence.tokenMeter.usedInputTokens - this.inputBefore
    this.firstIndex = this.chat.sequence.nextTokenIndex
  }

  finish(): TurnStats {
    const seq = this.chat.sequence
    const end = Date.now()
    this.close(end)
    const t = this.totals
    const inputTokens = seq.tokenMeter.usedInputTokens - this.inputBefore
    const outputTokens = seq.tokenMeter.usedOutputTokens - this.outputBefore
    const promptTokens = this.firstAt !== null ? this.firstIndex : seq.nextTokenIndex
    const evaluatedTokens = this.firstAt !== null ? this.firstInput : inputTokens
    const genMs = this.firstAt !== null ? end - this.firstAt : 0
    const predictedNow = predictions(this.chat)
    const predicted = predictedNow && this.predictedBefore ? { used: predictedNow.used - this.predictedBefore.used, checked: predictedNow.checked - this.predictedBefore.checked } : null
    return {
      ...(predicted ? { predictions: predicted } : {}),
      promptTokens,
      reusedTokens: Math.max(0, promptTokens - evaluatedTokens),
      evaluatedTokens,
      ttftMs: this.firstAt !== null ? this.firstAt - this.start : null,
      inputTokens,
      outputTokens,
      genMs,
      tokensPerSecond: t.genMs > 200 && t.genTokens > 0 ? Math.round((t.genTokens / (t.genMs / 1000)) * 10) / 10 : genMs > 0 && outputTokens > 0 ? Math.round((outputTokens / (genMs / 1000)) * 10) / 10 : null,
      contextUsed: seq.nextTokenIndex,
      contextSize: seq.context.contextSize,
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
