import { Gemma4ChatWrapper, HarmonyChatWrapper, JinjaTemplateChatWrapper, LlamaText, SpecialTokensText, resolveChatWrapper, specializedChatWrapperTypeNames, type ChatModelFunctions, type ChatWrapper, type ChatWrapperSettings, type GgufFileInfo, type LlamaModel } from 'node-llama-cpp'
import type { ChatTemplate, ModelFixInfo, ThinkingLevel } from '@shared/types'

const QUOTE = '<|"|>'

function resultText(result: unknown): string {
  if (result === undefined) return 'void'
  return typeof result === 'string' ? result : JSON.stringify(result)
}

type Gemma4Options = NonNullable<ConstructorParameters<typeof Gemma4ChatWrapper>[0]>
type Part = string | SpecialTokensText
type Schema = Record<string, unknown>

const q = (): SpecialTokensText => new SpecialTokensText(QUOTE)

function quoted(text: string): Part[] {
  return [q(), text, q()]
}

function joined(groups: Part[][]): Part[] {
  return groups.flatMap((g, i) => (i ? [',', ...g] : g))
}

function argument(value: unknown): Part[] {
  if (typeof value === 'string') return quoted(value)
  if (typeof value === 'boolean') return [value ? 'true' : 'false']
  if (value === null || value === undefined) return ['null']
  if (Array.isArray(value)) return ['[', ...joined(value.map(argument)), ']']
  if (typeof value === 'object') return ['{', ...callFields(value as Record<string, unknown>), '}']
  return [String(value)]
}

function callFields(value: Record<string, unknown>): Part[] {
  return joined(Object.keys(value).map((k) => [`${k}:`, ...argument(value[k])]))
}

function plain(schema: Schema): { type: string; nullable: boolean; schema: Schema } {
  let nullable = false
  let current = schema
  const options = (Array.isArray(schema.oneOf) ? schema.oneOf : Array.isArray(schema.anyOf) ? schema.anyOf : null) as Schema[] | null
  if (options) {
    const real = options.filter((o) => o.type !== 'null')
    nullable = real.length < options.length
    current = { ...(real[0] ?? {}), ...(schema.description ? { description: schema.description } : {}) }
  }
  let type = current.type
  if (Array.isArray(type)) {
    if (type.includes('null')) nullable = true
    type = type.find((t) => t !== 'null')
  }
  if (!type && Array.isArray(current.enum)) type = 'string'
  if (!type && current.properties) type = 'object'
  return { type: String(type ?? 'string').toUpperCase(), nullable, schema: current }
}

function required(list: unknown): Part[] | null {
  return Array.isArray(list) && list.length ? ['required:[', ...joined(list.map((r) => quoted(String(r)))), ']'] : null
}

function properties(props: Record<string, Schema>): Part[] {
  return joined(
    Object.keys(props)
      .sort()
      .map((key) => property(key, props[key] ?? {}))
  )
}

function property(key: string, raw: Schema): Part[] {
  const { type, nullable, schema } = plain(raw)
  const parts: Part[][] = []
  if (typeof schema.description === 'string' && schema.description) parts.push(['description:', ...quoted(schema.description)])
  if (type === 'STRING' && Array.isArray(schema.enum)) parts.push(['enum:', ...argument(schema.enum)])
  if (type === 'ARRAY' && schema.items && typeof schema.items === 'object') parts.push(['items:{', ...items(schema.items as Schema), '}'])
  if (nullable) parts.push(['nullable:true'])
  if (type === 'OBJECT' && schema.properties && typeof schema.properties === 'object') {
    parts.push(['properties:{', ...properties(schema.properties as Record<string, Schema>), '}'])
    const req = required(schema.required)
    if (req) parts.push(req)
  }
  parts.push(['type:', ...quoted(type)])
  return [`${key}:{`, ...joined(parts), '}']
}

function items(raw: Schema): Part[] {
  const { type, schema } = plain(raw)
  const parts: Part[][] = []
  if (typeof schema.description === 'string' && schema.description) parts.push(['description:', ...quoted(schema.description)])
  if (type === 'STRING' && Array.isArray(schema.enum)) parts.push(['enum:', ...argument(schema.enum)])
  if (type === 'OBJECT' && schema.properties && typeof schema.properties === 'object') {
    parts.push(['properties:{', ...properties(schema.properties as Record<string, Schema>), '}'])
    const req = required(schema.required)
    if (req) parts.push(req)
  }
  parts.push(['type:', ...quoted(type)])
  return joined(parts)
}

function declaration(name: string, description: string | undefined, params: Schema | undefined): Part[] {
  const parts: Part[] = ['declaration:', name, '{description:', ...quoted(description ?? '')]
  if (params) {
    const inner: Part[][] = []
    if (params.properties && typeof params.properties === 'object' && Object.keys(params.properties).length) inner.push(['properties:{', ...properties(params.properties as Record<string, Schema>), '}'])
    const req = required(params.required)
    if (req) inner.push(req)
    inner.push(['type:', ...quoted(String(params.type ?? 'object').toUpperCase())])
    parts.push(',parameters:{', ...joined(inner), '}')
  }
  parts.push('}')
  return parts
}

const OPEN_MODEL = '<|turn>model\n'
const CLOSED_THOUGHT = '<|channel>thought\n<channel|>'

export interface SevenGemma4Options extends Gemma4Options {
  toolResults?: boolean
  toolCalls?: boolean
  closedThought?: boolean
}

export class SevenGemma4ChatWrapper extends Gemma4ChatWrapper {
  readonly fixToolResults: boolean
  readonly fixToolCalls: boolean
  readonly fixClosedThought: boolean

  constructor(options: SevenGemma4Options = {}) {
    const { toolResults = true, toolCalls = true, closedThought = true, ...rest } = options
    super(rest)
    this.fixToolResults = toolResults
    this.fixToolCalls = toolCalls
    this.fixClosedThought = closedThought
    if (!toolResults && !toolCalls) return
    const settings: ChatWrapperSettings = {
      ...this.settings,
      functions: {
        ...this.settings.functions,
        ...(toolCalls
          ? {
              call: {
                ...this.settings.functions.call,
                prefixAlternateMatches: [LlamaText(new SpecialTokensText('<|channel>call:'))],
                paramsPrefix: LlamaText(''),
                suffix: LlamaText(new SpecialTokensText('<tool_call|>'))
              }
            }
          : {}),
        ...(toolResults
          ? {
              result: {
                prefix: LlamaText(new SpecialTokensText('<|tool_response>response:'), '{{functionName}}', '{value:', new SpecialTokensText(QUOTE)),
                suffix: LlamaText(new SpecialTokensText(`${QUOTE}}<tool_response|>`))
              }
            }
          : {})
      }
    }
    Object.defineProperty(this, 'settings', { value: settings, enumerable: true, configurable: true, writable: false })
  }

  override generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, options: { documentParams?: boolean }): LlamaText {
    if (!this.fixToolCalls) return super.generateAvailableFunctionsSystemText(availableFunctions, options)
    const documentParams = options.documentParams ?? true
    return LlamaText(
      Object.entries(availableFunctions).flatMap(([name, def]) => [
        new SpecialTokensText('<|tool>'),
        ...declaration(name, def.description, documentParams ? ((def.params as Schema | undefined) ?? undefined) : undefined),
        new SpecialTokensText('<tool|>')
      ])
    )
  }

  override generateFunctionCall(name: string, params: unknown): LlamaText {
    if (!this.fixToolCalls) return super.generateFunctionCall(name, params)
    const args = params && typeof params === 'object' && !Array.isArray(params) ? callFields(params as Record<string, unknown>) : []
    return LlamaText([new SpecialTokensText('<|tool_call>call:'), name, '{', ...args, '}', new SpecialTokensText('<tool_call|>')])
  }

  override generateFunctionCallsAndResults(functionCalls: Parameters<Gemma4ChatWrapper['generateFunctionCallsAndResults']>[0], useRawCall?: boolean): LlamaText {
    return super.generateFunctionCallsAndResults(functionCalls, this.fixToolCalls ? false : useRawCall)
  }

  override generateFunctionCallResult(functionName: string, params: unknown, result: unknown): LlamaText {
    if (!this.fixToolResults) return super.generateFunctionCallResult(functionName, params, result)
    return LlamaText([
      new SpecialTokensText('<|tool_response>response:'),
      functionName,
      '{value:',
      new SpecialTokensText(QUOTE),
      resultText(result).replaceAll(QUOTE, '"'),
      new SpecialTokensText(`${QUOTE}}<tool_response|>`)
    ])
  }

  _getModelResponse(modelResponse: unknown, useRawValues: boolean, isLastItem: boolean, keepOnlyLastThought: boolean): LlamaText {
    const base = (Gemma4ChatWrapper.prototype as unknown as { _getModelResponse: (...args: unknown[]) => LlamaText })._getModelResponse.call(this, modelResponse, useRawValues, isLastItem, keepOnlyLastThought)
    if (!isLastItem || this.reasoning || !this.fixClosedThought) return base
    const [first, ...rest] = base.values
    if (!(first instanceof SpecialTokensText) || !first.value.startsWith(OPEN_MODEL)) return base
    return LlamaText([new SpecialTokensText(OPEN_MODEL + CLOSED_THOUGHT + first.value.slice(OPEN_MODEL.length)), ...rest])
  }
}

interface ModelFix {
  id: string
  label: string
  models: string
  description: string
  appliesTo: (wrapper: ChatWrapper) => boolean
}

const GEMMA4_TOOL_RESULTS = 'gemma4-tool-results'
const GEMMA4_TOOL_CALLS = 'gemma4-tool-calls'
const GEMMA4_CLOSED_THOUGHT = 'gemma4-closed-thought'

const MODEL_FIXES: ModelFix[] = [
  {
    id: GEMMA4_TOOL_RESULTS,
    label: 'Gemma 4 tool results',
    models: 'Gemma 4',
    description: 'node-llama-cpp sends tool results as <tool_response>response:name{...}</tool_response>, which is not the Gemma 4 format. On, Seven sends them the way Google documents: <|tool_response>response:name{value:<|"|>...<|"|>}<tool_response|>.',
    appliesTo: (wrapper) => wrapper instanceof Gemma4ChatWrapper
  },
  {
    id: GEMMA4_TOOL_CALLS,
    label: 'Gemma 4 tool calls',
    models: 'Gemma 4',
    description: 'node-llama-cpp shows Gemma its tools and earlier tool calls as JSON, e.g. call:read{{"entry": "..."}}, which is not the format Gemma 4 was trained on. On, Seven writes tool declarations and earlier calls the way Google\'s template does, e.g. call:read{entry:<|"|>...<|"|>}, and new calls drop the extra brace. A call Gemma opens with <|channel> instead of <|tool_call> still runs as a call instead of showing as text. The arguments of a new call are still JSON, because that is the only form node-llama-cpp can read.',
    appliesTo: (wrapper) => wrapper instanceof Gemma4ChatWrapper
  },
  {
    id: GEMMA4_CLOSED_THOUGHT,
    label: 'Gemma 4 empty thought',
    models: 'Gemma 4, with Thinking off',
    description: 'With Thinking off, Gemma 4 can still open a thought channel itself and then write a tool call or its reply inside it, so it shows as text. On, Seven starts each reply with an empty, closed thought (<|channel>thought, then <channel|>), the way the fixed Gemma 4 template does, so the model goes straight to its answer.',
    appliesTo: (wrapper) => wrapper instanceof Gemma4ChatWrapper
  }
]

export function isModelFix(id: string): boolean {
  return MODEL_FIXES.some((f) => f.id === id)
}

function fixOn(fixes: Record<string, boolean>, id: string): boolean {
  return fixes[id] !== false
}

export function modelFixes(fixes: Record<string, boolean>, wrapper: ChatWrapper | null): ModelFixInfo[] {
  return MODEL_FIXES.filter((f) => wrapper !== null && f.appliesTo(wrapper)).map((f) => ({ id: f.id, label: f.label, models: f.models, description: f.description, on: fixOn(fixes, f.id) }))
}

export function wrapperForFile(fileInfo: GgufFileInfo, filename: string, choice: ChatTemplate): ChatWrapper | null {
  if (choice.type === 'jinja') return new JinjaTemplateChatWrapper({ template: choice.template })
  return resolveChatWrapper({ type: choice.type === 'wrapper' ? (choice.name as WrapperName) : 'auto', fileInfo, filename })
}

export function handlesThinking(wrapper: ChatWrapper): boolean {
  return wrapper instanceof Gemma4ChatWrapper
}

export const WRAPPER_NAMES: string[] = [...specializedChatWrapperTypeNames]

type WrapperName = (typeof specializedChatWrapperTypeNames)[number]

export interface ModelSettings {
  template: ChatTemplate
  fixes: Record<string, boolean>
}

let settingsOf: (model: LlamaModel) => ModelSettings = () => ({ template: { type: 'auto' }, fixes: {} })

export function setModelSource(fn: (model: LlamaModel) => ModelSettings): void {
  settingsOf = fn
}

export function checkTemplate(choice: ChatTemplate): void {
  if (choice.type === 'wrapper' && !WRAPPER_NAMES.includes(choice.name)) throw new Error(`Unknown chat template "${choice.name}". Known: ${WRAPPER_NAMES.join(', ')}`)
  if (choice.type === 'jinja') {
    if (!choice.template.trim()) throw new Error('The Jinja template is empty. Paste a chat template, or set Chat template back to Automatic (from the file).')
    new JinjaTemplateChatWrapper({ template: choice.template })
  }
}

function adjusted(resolved: ChatWrapper, level: ThinkingLevel, fixes: Record<string, boolean>): ChatWrapper {
  if (resolved instanceof HarmonyChatWrapper) return new HarmonyChatWrapper({ modelIdentity: resolved.modelIdentity, cuttingKnowledgeDate: resolved.cuttingKnowledgeDate, todayDate: resolved.todayDate, requiredChannels: resolved.requiredChannels, keepOnlyLastThought: resolved.keepOnlyLastThought, reasoningEffort: level === 'off' || level === 'low' ? 'low' : level === 'medium' ? 'medium' : 'high' })
  if (!(resolved instanceof Gemma4ChatWrapper)) return resolved
  const thinking = level !== 'off'
  const internal = resolved as unknown as { _lineBreakAfterThinkIndicator?: boolean }
  return new SevenGemma4ChatWrapper({
    reasoning: resolved.reasoning && thinking,
    keepOnlyLastThought: resolved.keepOnlyLastThought,
    toolResults: fixOn(fixes, GEMMA4_TOOL_RESULTS),
    toolCalls: fixOn(fixes, GEMMA4_TOOL_CALLS),
    closedThought: fixOn(fixes, GEMMA4_CLOSED_THOUGHT),
    ...(internal._lineBreakAfterThinkIndicator !== undefined ? { _lineBreakAfterThinkIndicator: internal._lineBreakAfterThinkIndicator } : {})
  } as SevenGemma4Options)
}

function build(model: LlamaModel, settings: ModelSettings, thinking: ThinkingLevel): ChatWrapper {
  const choice = settings.template
  if (choice.type === 'jinja') return new JinjaTemplateChatWrapper({ template: choice.template })
  const resolved = choice.type === 'wrapper' ? resolveChatWrapper(model, { type: choice.name as WrapperName }) : resolveChatWrapper(model)
  return adjusted(resolved, thinking, settings.fixes)
}

const cache = new WeakMap<LlamaModel, Map<string, ChatWrapper>>()

export function chatWrapperFor(model: LlamaModel, thinking: ThinkingLevel = 'max'): ChatWrapper {
  const settings = settingsOf(model)
  const key = JSON.stringify({ template: settings.template, fixes: settings.fixes, thinking })
  let built = cache.get(model)
  if (!built) {
    built = new Map()
    cache.set(model, built)
  }
  const found = built.get(key)
  if (found) return found
  const wrapper = build(model, settings, thinking)
  built.set(key, wrapper)
  return wrapper
}
