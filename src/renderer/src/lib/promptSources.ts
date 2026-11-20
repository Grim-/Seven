import type { PromptSection } from '@shared/types'

export interface SourceTone {
  block: string
  blockActive: string
  pill: string
  pillActive: string
  bar: string
  dot: string
  text: string
}

const TONE_PALETTE = {
  accent: {
    block: 'border-l-2 border-l-accent/55 bg-accent/[0.03]',
    blockActive: 'border-l-2 border-l-accent bg-accent/[0.10]',
    pill: 'border-accent/35 bg-accent/[0.06] text-accent-soft hover:border-accent/70 hover:bg-accent/[0.14]',
    pillActive: 'border-accent bg-accent/[0.18] text-accent',
    bar: 'bg-accent/75',
    dot: 'text-accent',
    text: 'text-accent'
  },
  cyan: {
    block: 'border-l-2 border-l-cyan/55 bg-cyan/[0.03]',
    blockActive: 'border-l-2 border-l-cyan bg-cyan/[0.10]',
    pill: 'border-cyan/35 bg-cyan/[0.06] text-cyan hover:border-cyan/70 hover:bg-cyan/[0.14]',
    pillActive: 'border-cyan bg-cyan/[0.18] text-cyan',
    bar: 'bg-cyan/75',
    dot: 'text-cyan',
    text: 'text-cyan'
  },
  purple: {
    block: 'border-l-2 border-l-purple/55 bg-purple/[0.04]',
    blockActive: 'border-l-2 border-l-purple bg-purple/[0.11]',
    pill: 'border-purple/35 bg-purple/[0.06] text-purple hover:border-purple/75 hover:bg-purple/[0.14]',
    pillActive: 'border-purple bg-purple/[0.18] text-purple',
    bar: 'bg-purple/75',
    dot: 'text-purple',
    text: 'text-purple'
  },
  ok: {
    block: 'border-l-2 border-l-ok/55 bg-ok/[0.03]',
    blockActive: 'border-l-2 border-l-ok bg-ok/[0.10]',
    pill: 'border-ok/35 bg-ok/[0.06] text-ok hover:border-ok/70 hover:bg-ok/[0.14]',
    pillActive: 'border-ok bg-ok/[0.18] text-ok',
    bar: 'bg-ok/75',
    dot: 'text-ok',
    text: 'text-ok'
  },
  teal: {
    block: 'border-l-2 border-l-teal/55 bg-teal/[0.03]',
    blockActive: 'border-l-2 border-l-teal bg-teal/[0.10]',
    pill: 'border-teal/35 bg-teal/[0.06] text-teal hover:border-teal/70 hover:bg-teal/[0.14]',
    pillActive: 'border-teal bg-teal/[0.18] text-teal',
    bar: 'bg-teal/75',
    dot: 'text-teal',
    text: 'text-teal'
  },
  alert: {
    block: 'border-l-2 border-l-alert/55 bg-alert/[0.03]',
    blockActive: 'border-l-2 border-l-alert bg-alert/[0.10]',
    pill: 'border-alert/35 bg-alert/[0.06] text-alert hover:border-alert/70 hover:bg-alert/[0.14]',
    pillActive: 'border-alert bg-alert/[0.18] text-alert',
    bar: 'bg-alert/75',
    dot: 'text-alert',
    text: 'text-alert'
  },
  neutral: {
    block: 'border-l-2 border-l-line-strong bg-white/[0.02]',
    blockActive: 'border-l-2 border-l-white/80 bg-white/[0.07]',
    pill: 'border-line/50 bg-white/[0.03] text-dim hover:border-white/50 hover:text-white',
    pillActive: 'border-white/70 bg-white/[0.12] text-white',
    bar: 'bg-white/40',
    dot: 'text-dim',
    text: 'text-white/85'
  }
} as const satisfies Record<string, SourceTone>

const KNOWN_SOURCE_TONES: Record<string, keyof typeof TONE_PALETTE> = {
  agent: 'cyan',
  user: 'ok',
  environment: 'neutral',
  tools: 'neutral',
  library: 'teal',
  present: 'teal',
  core: 'accent',
  cards: 'purple',
  world: 'ok',
  game: 'teal',
  mind: 'purple',
  decisions: 'alert',
  dnd: 'alert',
  image: 'cyan',
  browser: 'cyan',
  backdrop: 'purple',
  dashboards: 'teal'
}

const FALLBACK_KEYS: (keyof typeof TONE_PALETTE)[] = ['cyan', 'purple', 'ok', 'accent', 'teal', 'alert']

/** Return semantic Tailwind tone classes for a prompt or tool source id. */
export function sourceTone(sourceId: string): SourceTone {
  const mapped = KNOWN_SOURCE_TONES[sourceId]
  if (mapped) return TONE_PALETTE[mapped]
  let hash = 0
  for (let i = 0; i < sourceId.length; i++) hash = (hash * 31 + sourceId.charCodeAt(i)) >>> 0
  return TONE_PALETTE[FALLBACK_KEYS[hash % FALLBACK_KEYS.length]]
}

export function formatPromptTokens(n: number): string {
  return n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

export interface AggregatedPromptSource {
  sourceId: string
  label: string
  detail: string
  tokens: number
  count: number
}

const SOURCE_TITLES: Record<string, string> = {
  agent: 'Agent & character',
  user: 'About you',
  environment: 'Environment',
  tools: 'Tool rules & guides',
  library: 'Library & kinds',
  present: 'Places & UI',
  mind: 'Mind & reasoning'
}

/** Combine prompt sections sharing a sourceId and sort largest token contributors first. */
export function aggregatePromptSources(sections: PromptSection[]): AggregatedPromptSource[] {
  const bySource = new Map<string, AggregatedPromptSource>()
  for (const s of sections) {
    const existing = bySource.get(s.sourceId)
    if (!existing) {
      bySource.set(s.sourceId, {
        sourceId: s.sourceId,
        label: SOURCE_TITLES[s.sourceId] ?? s.label.replace(/ module$/, ''),
        detail: s.detail,
        tokens: s.tokens,
        count: 1
      })
    } else {
      existing.tokens += s.tokens
      existing.count += 1
      if (!existing.detail.includes(s.label)) existing.detail = `${existing.detail} + ${s.label}`
    }
  }
  return [...bySource.values()].sort((a, b) => b.tokens - a.tokens)
}
