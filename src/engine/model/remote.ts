import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import type { ChatHistoryItem, ChatModelFunctionCall, ChatModelResponse, ChatModelSegment } from 'node-llama-cpp'
import type { RemoteSpec } from '@shared/types'

const MAX_ROUNDS = 30
const DEFAULT_MAX_TOKENS = 4096
const CHARS_PER_TOKEN = 3.6

export interface RemoteTarget {
  id: string
  spec: RemoteSpec
  key: string | null
  contextSize: number
}

export interface RemoteSampling {
  temperature?: number
  topP?: number
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  budgets?: { thoughtTokens: number }
}

type Handler = { description?: string; params?: unknown; handler: (params: unknown) => unknown }

export interface RemotePromptOptions extends RemoteSampling {
  functions?: Record<string, Handler>
  signal?: AbortSignal
  onResponseChunk?: (chunk: { type?: 'segment'; segmentType?: 'thought'; text: string }) => void
  onFunctionCallParamsChunk?: (chunk: { callIndex: number; functionName: string; paramsChunk: string; done: boolean }) => void
}

interface Call {
  id: string
  name: string
  args: string
}

interface Round {
  text: string
  thought: string
  calls: Call[]
  input: number
  output: number
}

function estimate(value: unknown): number {
  return Math.ceil(JSON.stringify(value ?? '').length / CHARS_PER_TOKEN)
}

function resultText(result: unknown): string {
  return typeof result === 'string' ? result : JSON.stringify(result ?? null)
}

function schemaOf(params: unknown): Record<string, unknown> {
  return params && typeof params === 'object' ? (params as Record<string, unknown>) : { type: 'object', properties: {} }
}

function friendly(err: unknown, target: RemoteTarget): Error {
  const status = (err as { status?: number })?.status
  const where = target.spec.baseUrl ?? (target.spec.api === 'anthropic' ? 'Anthropic' : 'OpenAI')
  const raw = err instanceof Error ? err.message : String(err)
  if (status === 401 || status === 403) return new Error(`${where} refused the key for ${target.spec.model}. Check it in Models.`)
  if (status === 404) return new Error(`${where} has no model called "${target.spec.model}". Check the model name in Models.`)
  if (status === 429) return new Error(`${where} is rate limiting: wait a moment and try again. (${raw})`)
  if (status === 400 && /context|too long|maximum.*tokens/i.test(raw)) return new Error(`The conversation is too long for ${target.spec.model}. Summarise the chat or start a new one. (${raw})`)
  if (!status && /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(raw)) return new Error(`Can't reach ${where}. Check the address and that it's online.`)
  return new Error(`${where}: ${raw}`)
}

class ThinkSplitter {
  private inside = false
  private pending = ''

  push(text: string, emit: (kind: 'text' | 'thought', text: string) => void): void {
    this.pending += text
    for (;;) {
      const tag = this.inside ? '</think>' : '<think>'
      const at = this.pending.indexOf(tag)
      if (at >= 0) {
        if (at > 0) emit(this.inside ? 'thought' : 'text', this.pending.slice(0, at))
        this.pending = this.pending.slice(at + tag.length)
        this.inside = !this.inside
        continue
      }
      const keep = this.partial(tag)
      const out = this.pending.slice(0, this.pending.length - keep)
      if (out) emit(this.inside ? 'thought' : 'text', out)
      this.pending = this.pending.slice(this.pending.length - keep)
      return
    }
  }

  private partial(tag: string): number {
    for (let n = Math.min(tag.length - 1, this.pending.length); n > 0; n--) if (tag.startsWith(this.pending.slice(-n))) return n
    return 0
  }

  flush(emit: (kind: 'text' | 'thought', text: string) => void): void {
    if (this.pending) emit(this.inside ? 'thought' : 'text', this.pending)
    this.pending = ''
  }
}

function openaiMessages(items: ChatHistoryItem[], known: Set<string>): OpenAI.Chat.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = []
  let n = 0
  for (const item of items) {
    if (item.type === 'system') {
      if (item.text) out.push({ role: 'system', content: typeof item.text === 'string' ? item.text : String(item.text) })
      continue
    }
    if (item.type === 'user') {
      out.push({ role: 'user', content: item.text })
      continue
    }
    let text = ''
    let calls: { id: string; call: ChatModelFunctionCall }[] = []
    const flush = () => {
      if (!text && !calls.length) return
      out.push({ role: 'assistant', content: text || null, ...(calls.length ? { tool_calls: calls.map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.call.name, arguments: JSON.stringify(c.call.params ?? {}) } })) } : {}) })
      for (const c of calls) out.push({ role: 'tool', tool_call_id: c.id, content: resultText(c.call.result) })
      text = ''
      calls = []
    }
    for (const r of item.response) {
      if (typeof r === 'string') {
        if (calls.length) flush()
        text += r
      } else if (r.type === 'functionCall') {
        if (known.has(r.name)) calls.push({ id: `call_${n++}`, call: r })
        else {
          flush()
          out.push({ role: 'user', content: `[${r.name}] ${resultText(r.result)}` })
        }
      }
    }
    flush()
  }
  return out
}

type AnthropicBlock = Anthropic.Messages.ContentBlockParam

function anthropicMessages(items: ChatHistoryItem[], known: Set<string>): { system: string; messages: Anthropic.Messages.MessageParam[] } {
  const system: string[] = []
  const raw: { role: 'user' | 'assistant'; content: AnthropicBlock[] }[] = []
  let n = 0
  const push = (role: 'user' | 'assistant', block: AnthropicBlock) => {
    const last = raw[raw.length - 1]
    if (last && last.role === role) last.content.push(block)
    else raw.push({ role, content: [block] })
  }
  for (const item of items) {
    if (item.type === 'system') {
      if (item.text) system.push(typeof item.text === 'string' ? item.text : String(item.text))
      continue
    }
    if (item.type === 'user') {
      if (item.text) push('user', { type: 'text', text: item.text })
      continue
    }
    let results: AnthropicBlock[] = []
    const flush = () => {
      for (const b of results) push('user', b)
      results = []
    }
    for (const r of item.response) {
      if (typeof r === 'string') {
        if (results.length) flush()
        if (r) push('assistant', { type: 'text', text: r })
      } else if (r.type === 'functionCall') {
        if (known.has(r.name)) {
          const id = `call_${n++}`
          push('assistant', { type: 'tool_use', id, name: r.name, input: (r.params ?? {}) as Record<string, unknown> })
          results.push({ type: 'tool_result', tool_use_id: id, content: resultText(r.result) })
        } else {
          flush()
          push('user', { type: 'text', text: `[${r.name}] ${resultText(r.result)}` })
        }
      }
    }
    flush()
  }
  if (raw[0]?.role === 'assistant') raw.unshift({ role: 'user', content: [{ type: 'text', text: '(continue)' }] })
  return { system: system.join('\n\n'), messages: raw }
}

async function openaiRound(target: RemoteTarget, items: ChatHistoryItem[], o: RemotePromptOptions): Promise<Round> {
  const client = new OpenAI({ apiKey: target.key || 'none', ...(target.spec.baseUrl ? { baseURL: target.spec.baseUrl } : {}) })
  const fns = o.functions ?? {}
  const tools = Object.entries(fns).map(([name, f]) => ({ type: 'function' as const, function: { name, description: f.description ?? '', parameters: schemaOf(f.params) } }))
  const round: Round = { text: '', thought: '', calls: [], input: 0, output: 0 }
  const splitter = new ThinkSplitter()
  const emit = (kind: 'text' | 'thought', text: string) => {
    if (!text) return
    if (kind === 'thought') {
      round.thought += text
      o.onResponseChunk?.({ type: 'segment', segmentType: 'thought', text })
    } else {
      round.text += text
      o.onResponseChunk?.({ text })
    }
  }
  const stream = await client.chat.completions.create(
    {
      model: target.spec.model,
      messages: openaiMessages(items, new Set(Object.keys(fns))),
      stream: true,
      stream_options: { include_usage: true },
      ...(tools.length ? { tools } : {}),
      ...(o.temperature !== undefined ? { temperature: o.temperature } : {}),
      ...(o.topP !== undefined ? { top_p: o.topP } : {}),
      ...(o.maxTokens ? { max_tokens: o.maxTokens } : {}),
      ...(o.effort ? { reasoning_effort: o.effort } : {})
    },
    { signal: o.signal }
  )
  for await (const chunk of stream) {
    if (chunk.usage) {
      round.input = chunk.usage.prompt_tokens ?? round.input
      round.output = chunk.usage.completion_tokens ?? round.output
    }
    const delta = chunk.choices[0]?.delta as (OpenAI.Chat.ChatCompletionChunk.Choice.Delta & { reasoning_content?: string | null; reasoning?: string | null }) | undefined
    if (!delta) continue
    const reasoning = delta.reasoning_content ?? delta.reasoning
    if (reasoning) emit('thought', reasoning)
    if (delta.content) splitter.push(delta.content, emit)
    for (const tc of delta.tool_calls ?? []) {
      const call = (round.calls[tc.index] ??= { id: tc.id ?? `call_${tc.index}`, name: '', args: '' })
      if (tc.id) call.id = tc.id
      if (tc.function?.name) call.name += tc.function.name
      if (tc.function?.arguments) call.args += tc.function.arguments
      o.onFunctionCallParamsChunk?.({ callIndex: tc.index, functionName: call.name, paramsChunk: tc.function?.arguments ?? '', done: false })
    }
  }
  splitter.flush(emit)
  round.calls = round.calls.filter(Boolean)
  return round
}

async function anthropicRound(target: RemoteTarget, items: ChatHistoryItem[], o: RemotePromptOptions): Promise<Round> {
  const client = new Anthropic({ apiKey: target.key || 'none', ...(target.spec.baseUrl ? { baseURL: target.spec.baseUrl } : {}) })
  const fns = o.functions ?? {}
  const tools = Object.entries(fns).map(([name, f]) => ({ name, description: f.description ?? '', input_schema: schemaOf(f.params) as Anthropic.Messages.Tool.InputSchema }))
  const { system, messages } = anthropicMessages(items, new Set(Object.keys(fns)))
  const round: Round = { text: '', thought: '', calls: [], input: 0, output: 0 }
  const byBlock = new Map<number, number>()
  const thinking = o.effort && o.budgets?.thoughtTokens ? Math.max(1024, o.budgets.thoughtTokens) : 0
  const stream = await client.messages.create(
    {
      model: target.spec.model,
      max_tokens: thinking ? Math.max(o.maxTokens || DEFAULT_MAX_TOKENS, thinking + 1024) : o.maxTokens || DEFAULT_MAX_TOKENS,
      messages,
      stream: true,
      ...(system ? { system } : {}),
      ...(tools.length ? { tools } : {}),
      ...(thinking ? { thinking: { type: 'enabled' as const, budget_tokens: thinking } } : o.temperature !== undefined ? { temperature: Math.min(1, o.temperature) } : {})
    },
    { signal: o.signal }
  )
  for await (const ev of stream) {
    if (ev.type === 'message_start') round.input = ev.message.usage?.input_tokens ?? 0
    else if (ev.type === 'message_delta') round.output = ev.usage?.output_tokens ?? round.output
    else if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') {
      byBlock.set(ev.index, round.calls.length)
      round.calls.push({ id: ev.content_block.id, name: ev.content_block.name, args: '' })
    } else if (ev.type === 'content_block_delta') {
      const d = ev.delta
      if (d.type === 'text_delta') {
        round.text += d.text
        o.onResponseChunk?.({ text: d.text })
      } else if (d.type === 'thinking_delta') {
        round.thought += d.thinking
        o.onResponseChunk?.({ type: 'segment', segmentType: 'thought', text: d.thinking })
      } else if (d.type === 'input_json_delta') {
        const at = byBlock.get(ev.index)
        if (at === undefined) continue
        const call = round.calls[at]
        call.args += d.partial_json
        o.onFunctionCallParamsChunk?.({ callIndex: at, functionName: call.name, paramsChunk: d.partial_json, done: false })
      }
    }
  }
  return round
}

export class RemoteChat {
  disposed = false
  private items: ChatHistoryItem[]
  readonly sequence: { context: { contextSize: number }; tokenMeter: { usedInputTokens: number; usedOutputTokens: number }; nextTokenIndex: number; model: null }
  readonly chatWrapper = {
    wrapperName: 'remote',
    generateContextState: ({ chatHistory, availableFunctions }: { chatHistory: ChatHistoryItem[]; availableFunctions?: unknown }) => ({
      contextText: { tokenize: () => ({ length: estimate(chatHistory) + estimate(availableFunctions) }) }
    })
  }
  readonly model: { tokenizer: null; filename: string; gpuLayers: null }

  constructor(
    private target: RemoteTarget,
    systemPrompt: string
  ) {
    this.items = systemPrompt ? [{ type: 'system', text: systemPrompt }] : []
    this.sequence = { context: { contextSize: target.contextSize }, tokenMeter: { usedInputTokens: 0, usedOutputTokens: 0 }, nextTokenIndex: 0, model: null }
    this.model = { tokenizer: null, filename: `remote:${target.id}`, gpuLayers: null }
  }

  getChatHistory(): ChatHistoryItem[] {
    return structuredClone(this.items)
  }

  setChatHistory(history: ChatHistoryItem[]): void {
    this.items = structuredClone(history)
  }

  getLastEvaluationContextWindow(): ChatHistoryItem[] {
    return this.items
  }

  dispose(): void {
    this.disposed = true
  }

  private async round(o: RemotePromptOptions): Promise<Round> {
    try {
      const r = this.target.spec.api === 'anthropic' ? await anthropicRound(this.target, this.items, o) : await openaiRound(this.target, this.items, o)
      const meter = this.sequence.tokenMeter
      const input = r.input || estimate(this.items)
      const output = r.output || estimate(r.text + r.thought + r.calls.map((c) => c.args).join(''))
      meter.usedInputTokens += input
      meter.usedOutputTokens += output
      this.sequence.nextTokenIndex = input + output
      return r
    } catch (err) {
      if (o.signal?.aborted) return { text: '', thought: '', calls: [], input: 0, output: 0 }
      throw friendly(err, this.target)
    }
  }

  async prompt(text: string, o: RemotePromptOptions = {}): Promise<string> {
    this.items.push({ type: 'user', text })
    const reply: ChatModelResponse = { type: 'model', response: [] }
    this.items.push(reply)
    const fns = o.functions ?? {}
    let finalText = ''
    for (let i = 0; i < MAX_ROUNDS && !o.signal?.aborted; i++) {
      const r = await this.round(o)
      if (r.thought) reply.response.push({ type: 'segment', segmentType: 'thought', text: r.thought, ended: true } satisfies ChatModelSegment)
      if (r.text) {
        reply.response.push(r.text)
        finalText += r.text
      }
      if (!r.calls.length) break
      r.calls.forEach((c, index) => o.onFunctionCallParamsChunk?.({ callIndex: index, functionName: c.name, paramsChunk: '', done: true }))
      for (const call of r.calls) {
        let params: unknown = {}
        let result: unknown
        try {
          params = call.args.trim() ? JSON.parse(call.args) : {}
        } catch {
          result = `The arguments for ${call.name} were not valid JSON. Call it again with valid JSON.`
        }
        const fn = fns[call.name]
        if (result === undefined) {
          if (!fn) result = `There is no tool called ${call.name}.`
          else {
            try {
              result = await fn.handler(params)
            } catch (err) {
              result = `Error: ${err instanceof Error ? err.message : String(err)}`
            }
          }
        }
        reply.response.push({ type: 'functionCall', name: call.name, description: fn?.description, params, result } satisfies ChatModelFunctionCall)
        if (o.signal?.aborted) break
      }
    }
    return finalText
  }
}

export async function remoteComplete(target: RemoteTarget, system: string, prompt: string, o: RemoteSampling & { signal?: AbortSignal }): Promise<{ text: string; thought: string }> {
  const chat = new RemoteChat(target, system)
  let thought = ''
  const text = await chat.prompt(prompt, { ...o, onResponseChunk: (c) => (c.type === 'segment' ? (thought += c.text) : undefined) })
  return { text, thought }
}

export async function remoteTest(target: RemoteTarget): Promise<string> {
  const { text } = await remoteComplete(target, 'Reply with one short sentence.', 'Say hello.', { maxTokens: 64 })
  return text.trim() || '(an empty reply, but it answered)'
}
