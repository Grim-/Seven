import type { RemoteApi } from './types'

export type RemoteModelCategory = 'chat' | 'reasoning' | 'image' | 'audio' | 'other'

export interface RemoteModelInfo {
  id: string
  label?: string
  description?: string
  context?: number
  outputLimit?: number
  thinking?: boolean
  category?: RemoteModelCategory
}

export interface RemoteApiMeta {
  id: RemoteApi
  label: string
  protocol: string
  defaultHost: string
  defaultBaseUrl: string
  authHeader: string
  keyPrefix: string
  keyRequired: boolean
  docsHint: string
}

export const REMOTE_APIS: readonly RemoteApiMeta[] = [
  {
    id: 'openai',
    label: 'OpenAI-compatible',
    protocol: 'Chat Completions (/chat/completions)',
    defaultHost: 'api.openai.com',
    defaultBaseUrl: 'https://api.openai.com/v1',
    authHeader: 'Authorization: Bearer <key>',
    keyPrefix: 'sk-...',
    keyRequired: false,
    docsHint: 'Works with OpenAI, OpenRouter, LM Studio, Ollama, vLLM, and llama.cpp servers.'
  },
  {
    id: 'anthropic',
    label: 'Anthropic Messages',
    protocol: 'Messages API (/v1/messages)',
    defaultHost: 'api.anthropic.com',
    defaultBaseUrl: 'https://api.anthropic.com',
    authHeader: 'x-api-key',
    keyPrefix: 'sk-ant-...',
    keyRequired: true,
    docsHint: 'Native Claude Messages API with extended thinking and tool use.'
  },
  {
    id: 'google',
    label: 'Google Gemini',
    protocol: 'Gemini API (v1beta generateContent)',
    defaultHost: 'generativelanguage.googleapis.com',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    authHeader: 'x-goog-api-key header',
    keyPrefix: 'AIza...',
    keyRequired: true,
    docsHint: 'Direct native Gemini REST API with thinking, vision, and tool calling (uses a Google AI Studio API key, no OAuth login needed).'
  }
]

export interface RemotePreset {
  id: string
  label: string
  tag: string
  api: RemoteApi
  baseUrl: string
  defaultName: string
  defaultModel: string
  defaultContext: number
  keyRequired: boolean
  local?: boolean
  keySourceLabel: string
  keySourceUrl?: string
  summary: string
  requirements: readonly string[]
  suggestedModels: readonly { id: string; context: number }[]
}

export const REMOTE_PRESETS: readonly RemotePreset[] = [
  {
    id: 'google',
    label: 'Google Gemini',
    tag: 'Native API',
    api: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultName: 'Google Gemini',
    defaultModel: 'gemini-3.8-flash',
    defaultContext: 1048576,
    keyRequired: true,
    keySourceLabel: 'Google AI Studio API Keys (aistudio.google.com/apikey)',
    keySourceUrl: 'https://aistudio.google.com/apikey',
    summary: 'Connects directly to Google’s native Gemini v1beta API (not via the beta OpenAI bridge) using an API key sent in request headers.',
    requirements: [
      'A Gemini API key (starts with AIza...) from Google AI Studio — never your Google password.',
      'A current Gemini model ID (click Fetch list after pasting your key to browse all models enabled on your project; Google restricts 2.5 models on newer keys).',
      'Internet access to generativelanguage.googleapis.com over HTTPS.'
    ],
    suggestedModels: [
      { id: 'gemini-3.8-flash', context: 1048576 },
      { id: 'gemini-3.6-flash', context: 1048576 },
      { id: 'gemini-3.5-flash-lite', context: 1048576 },
      { id: 'gemini-3.1-pro-preview', context: 1048576 },
      { id: 'gemini-3-flash-preview', context: 1048576 }
    ]
  },
  {
    id: 'openai',
    label: 'OpenAI',
    tag: 'Cloud API',
    api: 'openai',
    baseUrl: '',
    defaultName: 'OpenAI GPT',
    defaultModel: 'gpt-4.1-mini',
    defaultContext: 128000,
    keyRequired: true,
    keySourceLabel: 'OpenAI API Platform (platform.openai.com/api-keys)',
    keySourceUrl: 'https://platform.openai.com/api-keys',
    summary: 'Official OpenAI Chat Completions API with streaming tools and vision.',
    requirements: [
      'An OpenAI API key (sk-...) with billing enabled.',
      'An OpenAI model ID (e.g. gpt-4.1-mini, gpt-4.1, o4-mini).',
      'Leave Address blank for api.openai.com.'
    ],
    suggestedModels: [
      { id: 'gpt-4.1-mini', context: 128000 },
      { id: 'gpt-4.1', context: 128000 },
      { id: 'o4-mini', context: 200000 }
    ]
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    tag: 'Native API',
    api: 'anthropic',
    baseUrl: '',
    defaultName: 'Claude',
    defaultModel: 'claude-sonnet-4-5',
    defaultContext: 200000,
    keyRequired: true,
    keySourceLabel: 'Anthropic Console (console.anthropic.com)',
    keySourceUrl: 'https://console.anthropic.com',
    summary: 'Native Anthropic Messages API with extended thinking and tool use.',
    requirements: [
      'An Anthropic API key (sk-ant-...).',
      'A Claude model ID (e.g. claude-sonnet-4-5, claude-opus-4-1).',
      'Leave Address blank for api.anthropic.com.'
    ],
    suggestedModels: [
      { id: 'claude-sonnet-4-5', context: 200000 },
      { id: 'claude-opus-4-1', context: 200000 },
      { id: 'claude-haiku-4-5', context: 200000 }
    ]
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    tag: 'Aggregator',
    api: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultName: 'OpenRouter',
    defaultModel: 'google/gemini-2.5-flash',
    defaultContext: 131072,
    keyRequired: true,
    keySourceLabel: 'OpenRouter Keys (openrouter.ai/keys)',
    keySourceUrl: 'https://openrouter.ai/keys',
    summary: 'Access hundreds of cloud models under one OpenAI-compatible API key.',
    requirements: [
      'An OpenRouter API key (sk-or-...).',
      'Address set to https://openrouter.ai/api/v1.',
      'Model slug like openai/gpt-4.1 or google/gemini-2.5-flash.'
    ],
    suggestedModels: [
      { id: 'google/gemini-2.5-flash', context: 1048576 },
      { id: 'anthropic/claude-sonnet-4', context: 200000 },
      { id: 'openai/gpt-4.1-mini', context: 128000 }
    ]
  },
  {
    id: 'local',
    label: 'Local Server',
    tag: 'LAN / Self-hosted',
    api: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    defaultName: 'Local Ollama',
    defaultModel: 'llama3.2',
    defaultContext: 32768,
    keyRequired: false,
    local: true,
    keySourceLabel: 'No API key required for local servers',
    summary: 'Connect to Ollama, LM Studio, vLLM, or llama.cpp running on your machine or LAN.',
    requirements: [
      'Server running with its OpenAI-compatible /v1 endpoint enabled (e.g. Ollama :11434/v1, LM Studio :1234/v1).',
      'Loaded/pulled model name matching the server’s ID.',
      'API key can be left empty unless your server enforces bearer auth.'
    ],
    suggestedModels: [
      { id: 'llama3.2', context: 32768 },
      { id: 'qwen2.5:14b', context: 32768 }
    ]
  },
  {
    id: 'custom',
    label: 'Custom',
    tag: 'Any endpoint',
    api: 'openai',
    baseUrl: '',
    defaultName: 'Custom Model',
    defaultModel: '',
    defaultContext: 32768,
    keyRequired: false,
    keySourceLabel: 'Depends on your gateway or provider',
    summary: 'Any OpenAI-compatible proxy, enterprise gateway, or custom hosted model.',
    requirements: [
      'Pick the matching protocol (OpenAI-compatible, Anthropic, or Google Gemini).',
      'Enter the full http:// or https:// base URL.',
      'Provide the model ID and key if required by the endpoint.'
    ],
    suggestedModels: []
  }
]

export function remoteApiMeta(api: RemoteApi): RemoteApiMeta {
  return REMOTE_APIS.find((a) => a.id === api) ?? REMOTE_APIS[0]
}

export function normalizeGoogleBase(baseUrl: string | null | undefined): string {
  const raw = (baseUrl?.trim() || remoteApiMeta('google').defaultBaseUrl)
    .replace(/\/+$/, '')
    .replace(/\/openai$/i, '')
    .replace(/\/models$/i, '')
  if (/^https:\/\/generativelanguage\.googleapis\.com$/i.test(raw)) return `${raw}/v1beta`
  return raw
}

export function isLocalAddress(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return false
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(baseUrl.trim())
}

export function remoteHostLabel(api: RemoteApi, baseUrl: string | null | undefined): string {
  const clean = baseUrl?.trim()
  if (!clean) return remoteApiMeta(api).defaultHost
  const stripped = clean.replace(/^https?:\/\//i, '').split('/')[0]
  return stripped || clean
}

export function presetForSpec(api: RemoteApi, baseUrl: string | null | undefined): RemotePreset {
  const clean = baseUrl?.trim().toLowerCase() ?? ''
  if (api === 'google') return REMOTE_PRESETS[0]
  if (api === 'anthropic' && (!clean || clean.includes('anthropic.com'))) return REMOTE_PRESETS[2]
  if (clean.includes('openrouter.ai')) return REMOTE_PRESETS[3]
  if (isLocalAddress(clean)) return REMOTE_PRESETS[4]
  if (api === 'openai' && (!clean || clean.includes('api.openai.com'))) return REMOTE_PRESETS[1]
  return REMOTE_PRESETS[5]
}

export function classifyRemoteModel(id: string, thinking?: boolean): RemoteModelCategory {
  const lower = id.toLowerCase()
  if (/(tts|native-audio|live|transcribe|audio)/.test(lower)) return 'audio'
  if (/(image|imagen|banana|veo|omni)/.test(lower)) return 'image'
  if (thinking || /(^|-)o[1-9]|thinking|deep-research|\br1\b/.test(lower)) return 'reasoning'
  if (/embed|aqa|bisect|robotics/.test(lower)) return 'other'
  return 'chat'
}

const CATEGORY_RANK: Record<RemoteModelCategory, number> = {
  chat: 0,
  reasoning: 1,
  image: 2,
  audio: 3,
  other: 4
}

function modelVersionScore(id: string): number {
  const m = id.match(/(?:gemini|claude|gpt|o)-?(\d+)(?:\.(\d+))?/i)
  if (!m) return 0
  return Number(m[1]) * 100 + Number(m[2] ?? 0)
}

export function sortRemoteModels(list: RemoteModelInfo[]): RemoteModelInfo[] {
  const seen = new Map<string, RemoteModelInfo>()
  for (const item of list) if (item.id && !seen.has(item.id)) seen.set(item.id, item)
  return [...seen.values()].sort((a, b) => {
    const catDiff = CATEGORY_RANK[a.category ?? 'chat'] - CATEGORY_RANK[b.category ?? 'chat']
    if (catDiff !== 0) return catDiff
    const verDiff = modelVersionScore(b.id) - modelVersionScore(a.id)
    if (verDiff !== 0) return verDiff
    const previewDiff = Number(/preview|exp/i.test(a.id)) - Number(/preview|exp/i.test(b.id))
    if (previewDiff !== 0) return previewDiff
    return a.id.localeCompare(b.id)
  })
}

export function normalizeRemoteModelList(raw: unknown): RemoteModelInfo[] {
  if (!Array.isArray(raw)) return []
  const out: RemoteModelInfo[] = []
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const id = entry.replace(/^models\//, '').trim()
      if (id) out.push({ id, category: classifyRemoteModel(id) })
      continue
    }
    if (entry && typeof entry === 'object') {
      const rec = entry as Partial<RemoteModelInfo>
      const id = typeof rec.id === 'string' ? rec.id.replace(/^models\//, '').trim() : ''
      if (!id) continue
      out.push({
        ...rec,
        id,
        category: rec.category ?? classifyRemoteModel(id, rec.thinking)
      })
    }
  }
  return sortRemoteModels(out)
}
