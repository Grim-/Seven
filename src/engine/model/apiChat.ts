import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import type { ChatHistoryItem, FunctionCallItem as ChatModelFunctionCall, ModelItem as ChatModelResponse, SegmentItem as ChatModelSegment } from '../chat/items'
import type { RemoteApi, RemoteSpec, ServerTimings, ToolChoiceMode } from '@shared/types'
import { classifyRemoteModel, normalizeGoogleBase, remoteApiMeta, sortRemoteModels, type RemoteModelInfo } from '@shared/remoteModels'
import { noteFailure } from '../util/report'
import fs from 'node:fs'
import path from 'node:path'
import { data } from '../data/hub'
import { classify } from '../data/assets'
import { imageItem, imagesIn } from '../chat/history'

const DEFAULT_MAX_TOKENS = 4096
const CHARS_PER_TOKEN = 3.6

export interface ApiTarget {
  id: string
  spec: RemoteSpec
  key: string | null
  contextSize: number
  local?: boolean
  vision?: boolean
  keepThinking?: boolean
  onTimings?: (timings: ServerTimings) => void
}

export interface ApiSampling {
  temperature?: number
  topP?: number
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  budgets?: { thoughtTokens: number }
}

type Handler = { description?: string; params?: unknown; handler: (params: unknown) => unknown }

export interface PromptOptions extends ApiSampling {
  functions?: Record<string, Handler>
  toolChoice?: ToolChoiceMode
  extra?: Record<string, unknown>
  maxRounds?: number
  images?: string[]
  takeImages?: () => string[]
  signal?: AbortSignal
  onResponseChunk?: (chunk: { type?: 'segment'; segmentType?: 'thought'; text: string }) => void
  onFunctionCallParamsChunk?: (chunk: { callIndex: number; functionName: string; paramsChunk: string; done: boolean }) => void
}

interface Call {
  id: string
  name: string
  args: string
  thoughtSignature?: string
}

interface Round {
  text: string
  thought: string
  calls: Call[]
  input: number
  output: number
  timings?: ServerTimings
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

function friendly(err: unknown, target: ApiTarget): Error {
  const status = (err as { status?: number })?.status
  const where = target.local ? 'llama-server' : (target.spec.baseUrl ?? remoteApiMeta(target.spec.api).defaultHost)
  const raw = err instanceof Error ? err.message : String(err)
  const detail = raw && !raw.startsWith(`HTTP ${status}`) ? ` (${raw})` : ''
  if (status === 401 || status === 403) return new Error(`${where} refused the key for ${target.spec.model}.${detail} Check it in Models.`)
  if (status === 404) return new Error(`${where} has no accessible model called "${target.spec.model}".${detail} Check the model name or click Fetch list in Models.`)
  if (status === 429) return new Error(`${where} is rate limiting: wait a moment and try again. (${raw})`)
  if (status === 400 && /context|too long|maximum.*tokens/i.test(raw)) return new Error(`The conversation is too long for ${target.spec.model}. Summarise the chat or start a new one. (${raw})`)
  if (!status && /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network/i.test(raw)) return new Error(`Can't reach ${where}. Check the address and that it's online.`)
  return new Error(`${where}: ${raw}`)
}

async function readHttpError(res: Response): Promise<Error> {
  const raw = await res.text()
  let message = res.statusText || `HTTP ${res.status}`
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } } | null
      if (parsed?.error?.message) message = parsed.error.message
    } catch (err) {
      noteFailure(err, 'models', 'Could not parse remote provider error JSON')
      message = raw.slice(0, 300)
    }
  } else if (raw.trim()) {
    message = raw.slice(0, 300)
  }
  return Object.assign(new Error(message), { status: res.status })
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

function imageBytes(ref: string): { mime: string; data: string } | null {
  const meta = data.assets.metaFor(ref)
  if (meta) return meta.kind === 'image' ? { mime: meta.mime, data: data.assets.readBytes(meta).toString('base64') } : null
  if (!path.isAbsolute(ref) || !fs.existsSync(ref)) return null
  const { mime, kind } = classify(ref)
  return kind === 'image' ? { mime, data: fs.readFileSync(ref).toString('base64') } : null
}

function imagePart(ref: string): OpenAI.Chat.ChatCompletionContentPartImage | null {
  const img = imageBytes(ref)
  return img ? { type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.data}` } } : null
}

function openaiMessages(items: ChatHistoryItem[], known: Set<string>, vision: boolean, thinking: boolean): OpenAI.Chat.ChatCompletionMessageParam[] {
  const out: OpenAI.Chat.ChatCompletionMessageParam[] = []
  let n = 0
  for (const item of items) {
    if (item.type === 'system') {
      if (item.text) out.push({ role: 'system', content: typeof item.text === 'string' ? item.text : String(item.text) })
      continue
    }
    if (item.type === 'user') {
      const images = vision ? imagesIn(item).map(imagePart).filter((p): p is OpenAI.Chat.ChatCompletionContentPartImage => p !== null) : []
      if (images.length) out.push({ role: 'user', content: [...(item.text ? [{ type: 'text' as const, text: item.text }] : []), ...images] })
      else if (item.text) out.push({ role: 'user', content: item.text })
      continue
    }
    let text = ''
    let thought = ''
    let calls: { id: string; call: ChatModelFunctionCall }[] = []
    const flush = () => {
      if (!text && !calls.length) return
      out.push({
        role: 'assistant',
        content: text || null,
        ...(thinking && thought ? { reasoning_content: thought } : {}),
        ...(calls.length
          ? {
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: 'function' as const,
                function: { name: c.call.name, arguments: JSON.stringify(c.call.params ?? {}) },
                ...(c.call.thoughtSignature ? { extra_content: { google: { thought_signature: c.call.thoughtSignature } } } : {})
              }))
            }
          : {})
      } as OpenAI.Chat.ChatCompletionMessageParam)
      for (const c of calls) out.push({ role: 'tool', tool_call_id: c.id, content: resultText(c.call.result) })
      text = ''
      thought = ''
      calls = []
    }
    for (const r of item.response) {
      if (typeof r === 'string') {
        if (calls.length) flush()
        text += r
      } else if (r.type === 'segment') {
        if (calls.length) flush()
        if (r.segmentType === 'thought') thought += r.text
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

function resolveOpenAiToolChoice(choice: ToolChoiceMode | undefined, fns: Record<string, Handler>): OpenAI.Chat.ChatCompletionToolChoiceOption | undefined {
  if (!choice || choice === 'auto') return undefined
  if (choice === 'none') return 'none'
  if (choice === 'required') return 'required'
  if (choice === 'force_reason') {
    if (fns['reason']) return { type: 'function', function: { name: 'reason' } }
    return 'required'
  }
  return undefined
}

function resolveAnthropicToolChoice(choice: ToolChoiceMode | undefined, fns: Record<string, Handler>): Anthropic.Messages.ToolChoice | undefined {
  if (!choice || choice === 'auto') return undefined
  if (choice === 'required') return { type: 'any' }
  if (choice === 'none') return undefined
  if (choice === 'force_reason') {
    if (fns['reason']) return { type: 'tool', name: 'reason' }
    return { type: 'any' }
  }
  return undefined
}

async function openaiRound(target: ApiTarget, items: ChatHistoryItem[], o: PromptOptions): Promise<Round> {
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
  const toolChoice = resolveOpenAiToolChoice(o.toolChoice, fns)
  const stream = await client.chat.completions.create(
    {
      model: target.spec.model,
      messages: openaiMessages(items, new Set(Object.keys(fns)), target.vision === true, target.keepThinking === true),
      stream: true,
      stream_options: { include_usage: true },
      ...(tools.length ? { tools } : {}),
      ...(tools.length && toolChoice ? { tool_choice: toolChoice } : {}),
      ...(o.temperature !== undefined ? { temperature: o.temperature } : {}),
      ...(o.topP !== undefined ? { top_p: o.topP } : {}),
      ...(o.maxTokens ? { max_tokens: o.maxTokens } : {}),
      ...(o.effort && !target.local ? { reasoning_effort: o.effort } : {}),
      ...(o.extra ?? {})
    },
    { signal: o.signal }
  )
  for await (const chunk of stream) {
    const t = (chunk as { timings?: Record<string, unknown> }).timings
    if (t) round.timings = { promptTps: num(t.prompt_per_second), genTps: num(t.predicted_per_second), drafted: num(t.draft_n), accepted: num(t.draft_n_accepted) }
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
      const sig = (tc as { extra_content?: { google?: { thought_signature?: unknown } } }).extra_content?.google?.thought_signature
      if (typeof sig === 'string' && sig) call.thoughtSignature = sig
      o.onFunctionCallParamsChunk?.({ callIndex: tc.index, functionName: call.name, paramsChunk: tc.function?.arguments ?? '', done: false })
    }
  }
  splitter.flush(emit)
  round.calls = round.calls.filter(Boolean)
  return round
}

async function anthropicRound(target: ApiTarget, items: ChatHistoryItem[], o: PromptOptions): Promise<Round> {
  const client = new Anthropic({ apiKey: target.key || 'none', ...(target.spec.baseUrl ? { baseURL: target.spec.baseUrl } : {}) })
  const fns = o.functions ?? {}
  const tools = Object.entries(fns).map(([name, f]) => ({ name, description: f.description ?? '', input_schema: schemaOf(f.params) as Anthropic.Messages.Tool.InputSchema }))
  const { system, messages } = anthropicMessages(items, new Set(Object.keys(fns)))
  const round: Round = { text: '', thought: '', calls: [], input: 0, output: 0 }
  const byBlock = new Map<number, number>()
  const thinking = o.effort && o.budgets?.thoughtTokens ? Math.max(1024, o.budgets.thoughtTokens) : 0
  const toolChoice = resolveAnthropicToolChoice(o.toolChoice, fns)
  const stream = await client.messages.create(
    {
      model: target.spec.model,
      max_tokens: thinking ? Math.max(o.maxTokens || DEFAULT_MAX_TOKENS, thinking + 1024) : o.maxTokens || DEFAULT_MAX_TOKENS,
      messages,
      stream: true,
      ...(system ? { system } : {}),
      ...(tools.length ? { tools } : {}),
      ...(tools.length && toolChoice ? { tool_choice: toolChoice } : {}),
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

const GOOGLE_BUDGET = new Map<'low' | 'medium' | 'high', number>([
  ['low', 1024],
  ['medium', 8192],
  ['high', 24576]
])

const GOOGLE_LEVEL = new Map<'low' | 'medium' | 'high', string>([
  ['low', 'LOW'],
  ['medium', 'MEDIUM'],
  ['high', 'HIGH']
])

interface GoogleContent {
  role: 'user' | 'model'
  parts: Record<string, unknown>[]
}

function googleMessages(items: ChatHistoryItem[], known: Set<string>, vision: boolean): { system: string; contents: GoogleContent[] } {
  const system: string[] = []
  const contents: GoogleContent[] = []
  const push = (role: 'user' | 'model', part: Record<string, unknown>) => {
    const last = contents[contents.length - 1]
    if (last && last.role === role) last.parts.push(part)
    else contents.push({ role, parts: [part] })
  }
  for (const item of items) {
    if (item.type === 'system') {
      if (item.text) system.push(typeof item.text === 'string' ? item.text : String(item.text))
      continue
    }
    if (item.type === 'user') {
      if (item.text) push('user', { text: item.text })
      if (vision) {
        for (const ref of imagesIn(item)) {
          const img = imageBytes(ref)
          if (img) push('user', { inlineData: { mimeType: img.mime, data: img.data } })
        }
      }
      continue
    }
    let toolResponses: Record<string, unknown>[] = []
    const flushResponses = () => {
      for (const p of toolResponses) push('user', p)
      toolResponses = []
    }
    for (const r of item.response) {
      if (typeof r === 'string') {
        if (toolResponses.length) flushResponses()
        if (r) push('model', { text: r })
      } else if (r.type === 'functionCall') {
        if (known.has(r.name)) {
          const args = r.params && typeof r.params === 'object' && !Array.isArray(r.params) ? r.params : {}
          push('model', {
            functionCall: { name: r.name, args },
            ...(r.thoughtSignature ? { thoughtSignature: r.thoughtSignature } : {})
          })
          toolResponses.push({ functionResponse: { name: r.name, response: { output: resultText(r.result) } } })
        } else {
          flushResponses()
          push('user', { text: `[${r.name}] ${resultText(r.result)}` })
        }
      }
    }
    flushResponses()
  }
  if (!contents.length || contents[0].role === 'model') contents.unshift({ role: 'user', parts: [{ text: '(continue)' }] })
  return { system: system.join('\n\n'), contents }
}

function googleThinkingConfig(model: string, effort: PromptOptions['effort']): Record<string, unknown> | undefined {
  if (!effort) return undefined
  if (/^gemini-2\.5/i.test(model)) return { thinkingBudget: GOOGLE_BUDGET.get(effort) ?? 1024, includeThoughts: true }
  if (/^gemini-[3-9]/i.test(model)) return { thinkingLevel: GOOGLE_LEVEL.get(effort) ?? 'LOW', includeThoughts: true }
  return undefined
}

function googleToolConfig(choice: ToolChoiceMode | undefined, fns: Record<string, Handler>): Record<string, unknown> | undefined {
  if (!choice || choice === 'auto') return undefined
  if (choice === 'none') return { functionCallingConfig: { mode: 'NONE' } }
  if (choice === 'force_reason' && fns['reason']) return { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['reason'] } }
  return { functionCallingConfig: { mode: 'ANY' } }
}

async function googleRound(target: ApiTarget, items: ChatHistoryItem[], o: PromptOptions): Promise<Round> {
  const key = target.key?.trim()
  if (!key) throw Object.assign(new Error('Google Gemini requires an API key from Google AI Studio.'), { status: 401 })
  const base = normalizeGoogleBase(target.spec.baseUrl)
  const model = target.spec.model.replace(/^models\//i, '')
  const url = `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`
  const fns = o.functions ?? {}
  const { system, contents } = googleMessages(items, new Set(Object.keys(fns)), target.vision === true)
  const declarations = Object.entries(fns).map(([name, f]) => ({
    name,
    description: f.description ?? '',
    parametersJsonSchema: schemaOf(f.params)
  }))
  const thinkingConfig = googleThinkingConfig(model, o.effort)
  const toolConfig = declarations.length ? googleToolConfig(o.toolChoice, fns) : undefined
  const generationConfig: Record<string, unknown> = {
    ...(o.temperature !== undefined ? { temperature: o.temperature } : {}),
    ...(o.topP !== undefined ? { topP: o.topP } : {}),
    ...(o.maxTokens ? { maxOutputTokens: o.maxTokens } : {}),
    ...(thinkingConfig ? { thinkingConfig } : {})
  }
  const body: Record<string, unknown> = {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...(declarations.length ? { tools: [{ functionDeclarations: declarations }] } : {}),
    ...(toolConfig ? { toolConfig } : {}),
    ...(Object.keys(generationConfig).length ? { generationConfig } : {})
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
    signal: o.signal
  })
  if (!res.ok) throw await readHttpError(res)

  const round: Round = { text: '', thought: '', calls: [], input: 0, output: 0 }
  const reader = res.body?.getReader()
  if (!reader) return round
  const decoder = new TextDecoder()
  let buffer = ''

  const handlePayload = (payload: string) => {
    const trimmed = payload.trim()
    if (!trimmed || trimmed === '[DONE]') return
    const dataChunk = JSON.parse(trimmed) as {
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string
            thought?: boolean
            thoughtSignature?: string
            functionCall?: { id?: string; name?: string; args?: Record<string, unknown> }
          }>
        }
      }>
    }
    if (dataChunk.usageMetadata) {
      if (typeof dataChunk.usageMetadata.promptTokenCount === 'number') round.input = dataChunk.usageMetadata.promptTokenCount
      const cand = dataChunk.usageMetadata.candidatesTokenCount ?? 0
      const th = dataChunk.usageMetadata.thoughtsTokenCount ?? 0
      if (cand || th) round.output = cand + th
    }
    for (const part of dataChunk.candidates?.[0]?.content?.parts ?? []) {
      if (part.thought && typeof part.text === 'string' && part.text) {
        round.thought += part.text
        o.onResponseChunk?.({ type: 'segment', segmentType: 'thought', text: part.text })
      } else if (typeof part.text === 'string' && part.text) {
        round.text += part.text
        o.onResponseChunk?.({ text: part.text })
      }
      if (part.functionCall?.name) {
        round.calls.push({
          id: part.functionCall.id || `call_${round.calls.length}`,
          name: part.functionCall.name,
          args: JSON.stringify(part.functionCall.args ?? {}),
          ...(typeof part.thoughtSignature === 'string' && part.thoughtSignature ? { thoughtSignature: part.thoughtSignature } : {})
        })
      }
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (line.startsWith('data:')) handlePayload(line.slice(5))
    }
  }
  if (buffer.startsWith('data:')) handlePayload(buffer.slice(5))
  return round
}

const ROUND_HANDLERS = new Map<RemoteApi, (target: ApiTarget, items: ChatHistoryItem[], o: PromptOptions) => Promise<Round>>([
  ['openai', openaiRound],
  ['anthropic', anthropicRound],
  ['google', googleRound]
])

async function listGoogleModels(baseUrl: string | null, key: string | null): Promise<RemoteModelInfo[]> {
  const cleanKey = key?.trim()
  if (!cleanKey) throw Object.assign(new Error('Enter a Google Gemini API key before fetching models.'), { status: 401 })
  const base = normalizeGoogleBase(baseUrl)
  type RawGoogleModel = {
    name?: string
    displayName?: string
    description?: string
    inputTokenLimit?: number
    outputTokenLimit?: number
    thinking?: boolean
    supportedGenerationMethods?: string[]
  }
  const collected: RemoteModelInfo[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 10; page++) {
    const qs = new URLSearchParams({ pageSize: '1000' })
    if (pageToken) qs.set('pageToken', pageToken)
    const res = await fetch(`${base}/models?${qs.toString()}`, { headers: { 'x-goog-api-key': cleanKey } })
    if (!res.ok) throw await readHttpError(res)
    const body = (await res.json()) as { models?: RawGoogleModel[]; nextPageToken?: string }
    for (const m of body.models ?? []) {
      if (m.supportedGenerationMethods && !m.supportedGenerationMethods.includes('generateContent')) continue
      const id = (m.name ?? '').replace(/^models\//, '').trim()
      if (!id) continue
      collected.push({
        id,
        ...(m.displayName ? { label: m.displayName } : {}),
        ...(m.description ? { description: m.description } : {}),
        ...(typeof m.inputTokenLimit === 'number' && m.inputTokenLimit > 0 ? { context: m.inputTokenLimit } : {}),
        ...(typeof m.outputTokenLimit === 'number' && m.outputTokenLimit > 0 ? { outputLimit: m.outputTokenLimit } : {}),
        ...(typeof m.thinking === 'boolean' ? { thinking: m.thinking } : {}),
        category: classifyRemoteModel(id, m.thinking)
      })
    }
    pageToken = body.nextPageToken
    if (!pageToken) break
  }
  return sortRemoteModels(collected)
}

async function listAnthropicModels(baseUrl: string | null, key: string | null): Promise<RemoteModelInfo[]> {
  const cleanKey = key?.trim()
  if (!cleanKey) throw Object.assign(new Error('Enter an Anthropic API key before fetching models.'), { status: 401 })
  const base = (baseUrl || remoteApiMeta('anthropic').defaultBaseUrl).replace(/\/+$/, '')
  const res = await fetch(`${base}/v1/models?limit=1000`, {
    headers: { 'x-api-key': cleanKey, 'anthropic-version': '2023-06-01' }
  })
  if (!res.ok) throw await readHttpError(res)
  const body = (await res.json()) as { data?: Array<{ id?: string; display_name?: string }> }
  return sortRemoteModels(
    (body.data ?? [])
      .filter((m) => Boolean(m.id))
      .map((m) => ({
        id: m.id!,
        ...(m.display_name ? { label: m.display_name } : {}),
        category: classifyRemoteModel(m.id!)
      }))
  )
}

async function listOpenAiModels(baseUrl: string | null, key: string | null): Promise<RemoteModelInfo[]> {
  const client = new OpenAI({ apiKey: key || 'none', ...(baseUrl ? { baseURL: baseUrl } : {}) })
  const list = await client.models.list()
  return sortRemoteModels(
    list.data
      .filter((m) => Boolean(m.id))
      .map((m) => {
        const extra = m as unknown as Record<string, unknown>
        const label = typeof extra.name === 'string' && extra.name !== m.id ? extra.name : undefined
        const description = typeof extra.description === 'string' ? extra.description : undefined
        const ctx = num(extra.context_length) ?? num(extra.max_context_length) ?? undefined
        return {
          id: m.id,
          ...(label ? { label } : {}),
          ...(description ? { description } : {}),
          ...(ctx ? { context: ctx } : {}),
          category: classifyRemoteModel(m.id)
        }
      })
  )
}

const MODEL_LISTERS = new Map<RemoteApi, (baseUrl: string | null, key: string | null) => Promise<RemoteModelInfo[]>>([
  ['google', listGoogleModels],
  ['anthropic', listAnthropicModels],
  ['openai', listOpenAiModels]
])

export async function listRemoteModels(target: { spec: Pick<RemoteSpec, 'api' | 'baseUrl'>; key: string | null }): Promise<RemoteModelInfo[]> {
  const lister = MODEL_LISTERS.get(target.spec.api) ?? listOpenAiModels
  return lister(target.spec.baseUrl, target.key)
}

export class ApiChat {
  disposed = false
  capped = false
  timings: ServerTimings | null = null
  private items: ChatHistoryItem[]
  readonly usage = { input: 0, output: 0 }
  used = 0

  constructor(
    private targetSource: ApiTarget | (() => ApiTarget),
    systemPrompt: string
  ) {
    this.items = systemPrompt ? [{ type: 'system', text: systemPrompt }] : []
  }

  private resolveTarget(): ApiTarget {
    return typeof this.targetSource === 'function' ? this.targetSource() : this.targetSource
  }

  get contextSize(): number {
    return this.resolveTarget().contextSize
  }

  get local(): boolean {
    return this.resolveTarget().local === true
  }

  getChatHistory(): ChatHistoryItem[] {
    return structuredClone(this.items)
  }

  setChatHistory(history: ChatHistoryItem[]): void {
    this.items = structuredClone(history)
  }

  dispose(): void {
    this.disposed = true
  }

  private async round(o: PromptOptions): Promise<Round> {
    const target = this.resolveTarget()
    try {
      const handler = ROUND_HANDLERS.get(target.spec.api) ?? openaiRound
      const r = await handler(target, this.items, o)
      const input = r.input || estimate(this.items)
      const output = r.output || estimate(r.text + r.thought + r.calls.map((c) => c.args).join(''))
      this.usage.input += input
      this.usage.output += output
      this.used = input + output
      if (r.timings) {
        this.timings = r.timings
        target.onTimings?.(r.timings)
      }
      return r
    } catch (err) {
      if (o.signal?.aborted) return { text: '', thought: '', calls: [], input: 0, output: 0 }
      throw friendly(err, target)
    }
  }

  async prompt(text: string, o: PromptOptions = {}): Promise<string> {
    this.items.push({ type: 'user', text, ...(o.images?.length ? { images: o.images } : {}) } as ChatHistoryItem)
    let reply: ChatModelResponse = { type: 'model', response: [] }
    this.items.push(reply)
    const fns = o.functions ?? {}
    let finalText = ''
    this.capped = false
    this.timings = null
    for (let i = 0; !o.signal?.aborted; i++) {
      if (o.maxRounds && i >= o.maxRounds) {
        this.capped = true
        break
      }
      const roundOpts = i === 0 ? o : (o.toolChoice && o.toolChoice !== 'auto' ? { ...o, toolChoice: 'auto' as const } : o)
      const r = await this.round(roundOpts)
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
        reply.response.push({
          type: 'functionCall',
          name: call.name,
          description: fn?.description,
          params,
          result,
          ...(call.thoughtSignature ? { thoughtSignature: call.thoughtSignature } : {})
        } satisfies ChatModelFunctionCall)
        if (o.signal?.aborted) break
      }
      const shown = o.takeImages?.() ?? []
      if (shown.length) {
        this.items.push(imageItem(shown))
        reply = { type: 'model', response: [] }
        this.items.push(reply)
      }
    }
    return finalText
  }
}

export async function apiComplete(target: ApiTarget, system: string, prompt: string, o: ApiSampling & { signal?: AbortSignal }): Promise<{ text: string; thought: string }> {
  const chat = new ApiChat(target, system)
  let thought = ''
  const text = await chat.prompt(prompt, { ...o, onResponseChunk: (c) => (c.type === 'segment' ? (thought += c.text) : undefined) })
  return { text, thought }
}

export async function apiTest(target: ApiTarget): Promise<string> {
  const { text } = await apiComplete(target, 'Reply with one short sentence.', 'Say hello.', { maxTokens: 64 })
  return text.trim() || '(an empty reply, but it answered)'
}

export async function apiProbe(target: ApiTarget): Promise<{ ok: boolean; reply?: string; error?: string; models: RemoteModelInfo[] }> {
  const [testRes, listRes] = await Promise.allSettled([apiTest(target), listRemoteModels(target)])
  const models = listRes.status === 'fulfilled' ? listRes.value : []
  if (listRes.status === 'rejected') noteFailure(listRes.reason, 'models', 'Could not list remote models while probing')
  if (testRes.status === 'fulfilled') return { ok: true, reply: testRes.value, models }
  const err = testRes.reason
  return { ok: false, error: err instanceof Error ? err.message : String(err), models }
}
