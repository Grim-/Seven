import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ChevronDown, Cloud, Copy, Eye, EyeOff, KeyRound, Lock, PlugZap, RefreshCw, Search, ShieldCheck, Sparkles, Star, Trash2, UserPlus } from 'lucide-react'
import type { ModelEntry, RemoteApi } from '@shared/types'
import {
  REMOTE_APIS,
  REMOTE_PRESETS,
  isLocalAddress,
  normalizeRemoteModelList,
  presetForSpec,
  remoteApiMeta,
  remoteHostLabel,
  type RemoteModelCategory,
  type RemoteModelInfo,
  type RemotePreset
} from '@shared/remoteModels'
import { Button, Eyebrow, Input, Modal, NumberField, Panel, Popover, SaveState, Select, SettingCard, SettingRow, StatusBadge, useAutosavedState } from '../ui'
import { AgentAvatar } from '../agents/look'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/format'
import { engine } from '../../lib/ipc'
import { copyText, failed } from '../../lib/notify'
import { useBusy } from '../../lib/useBusy'
import { useAgents } from '../../store/agents'
import { useApp } from '../../store/app'
import { useModels } from '../../store/models'
import { noteFailure } from '../../store/problems'
import { toast } from '../../store/toasts'
import { useVault } from '../../store/vault'
import { RemoteParams } from './settings/RemoteParams'

export interface RemoteDraft {
  name: string
  api: RemoteApi
  baseUrl: string
  model: string
  key: string
  contextSize: number
}

const CONTEXT_QUICK = [
  { label: '32K', value: 32768 },
  { label: '128K', value: 128000 },
  { label: '200K', value: 200000 },
  { label: '1M', value: 1048576 }
] as const

const API_OPTIONS = REMOTE_APIS.map((a) => ({ value: a.id, label: a.label }))

export function writeRemote(id: string | null, d: RemoteDraft, keepKey: boolean): Promise<ModelEntry> {
  return engine('models.remote.save', {
    id,
    name: d.name,
    api: d.api,
    baseUrl: d.baseUrl.trim() || null,
    model: d.model,
    key: keepKey && !d.key ? null : d.key,
    contextSize: d.contextSize
  })
}

function PresetGrid({ activeId, onPick }: { activeId: string; onPick: (preset: RemotePreset) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {REMOTE_PRESETS.map((p) => {
        const on = p.id === activeId
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className={cn(
              'flex flex-col items-start gap-1 border px-3 py-2 text-left transition-colors',
              on ? 'border-accent bg-accent/15' : 'border-line/50 bg-black/35 hover:border-line hover:bg-black/55'
            )}
          >
            <div className="flex w-full items-center justify-between gap-1.5">
              <span className={cn('font-mono text-[11.5px] font-bold', on ? 'text-accent' : 'text-white')}>{p.label}</span>
              <span className="border border-line/50 px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider text-dim">{p.tag}</span>
            </div>
            <span className="line-clamp-2 text-[11px] leading-snug text-dim">{p.summary}</span>
          </button>
        )
      })}
    </div>
  )
}

function ReadinessCard({
  draft,
  preset,
  keySaved
}: {
  draft: RemoteDraft
  preset: RemotePreset
  keySaved: boolean
}) {
  const vault = useVault((s) => s.status)
  const apiMeta = remoteApiMeta(draft.api)
  const host = remoteHostLabel(draft.api, draft.baseUrl)
  const isLocal = isLocalAddress(draft.baseUrl)
  const hasKey = Boolean(draft.key.trim()) || keySaved
  const keyOk = hasKey || (!preset.keyRequired && !apiMeta.keyRequired)
  const hasModel = Boolean(draft.model.trim())
  const hasName = Boolean(draft.name.trim())

  const checks = [
    { ok: true, text: `Protocol: ${apiMeta.protocol}` },
    { ok: true, text: `Endpoint: ${host}${isLocal ? ' (local / no cloud upload)' : ' (cloud HTTPS)'}` },
    { ok: keyOk, text: hasKey ? `Credentials: Ready (${apiMeta.authHeader})` : preset.keyRequired || apiMeta.keyRequired ? `Credentials needed: ${preset.keySourceLabel}` : 'Credentials: Optional bearer key' },
    { ok: hasModel && hasName, text: hasModel ? `Model target: ${draft.model.trim()}` : 'Enter or pick a model ID below' }
  ]

  return (
    <div className="flex flex-col gap-2.5 border border-line/60 border-l-2 border-l-teal bg-black/45 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-teal" />
          <Eyebrow className="text-teal">What You Need To Connect · {preset.label}</Eyebrow>
        </div>
        <span className={cn('inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider', vault.configured ? 'border-ok/40 bg-ok/10 text-ok' : 'border-accent/40 bg-accent/10 text-accent')}>
          <Lock className="h-2.5 w-2.5" />
          {vault.configured ? (vault.unlocked ? 'Vault key encryption active' : 'Vault configured (locked)') : 'Key kept locally (enable Vault in Settings to encrypt)'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-1.5 font-mono text-[11px]">
            {c.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />}
            <span className={c.ok ? 'text-white/90' : 'text-accent'}>{c.text}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t border-line/35 pt-2 text-[11.5px] text-dim">
        {preset.requirements.map((req, idx) => (
          <div key={idx} className="flex items-start gap-1.5">
            <span className="font-mono text-[10px] text-faint">{idx + 1}.</span>
            <span>{req}</span>
          </div>
        ))}
        {preset.keySourceUrl && (
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10.5px]">
            <span className="text-faint">Get a key:</span>
            <button
              type="button"
              onClick={() => copyText(preset.keySourceUrl!, 'Key URL copied')}
              className="inline-flex items-center gap-1 border border-line/50 bg-black/50 px-2 py-0.5 text-teal hover:border-teal hover:text-white"
            >
              <Copy className="h-2.5 w-2.5" />
              {preset.keySourceUrl}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const CATEGORY_LABELS: Record<RemoteModelCategory, string> = {
  chat: 'Chat',
  reasoning: 'Reasoning',
  image: 'Image / Vision',
  audio: 'Audio / TTS',
  other: 'Other'
}

function formatCtx(tokens: number | undefined): string | null {
  if (!tokens || tokens <= 0) return null
  if (tokens >= 1000000) return `${Number((tokens / 1048576).toFixed(1))}M ctx`
  return `${Math.round(tokens / 1000)}K ctx`
}

function nextBaseUrlForProtocol(currentBase: string, nextApi: RemoteApi): string {
  const trimmed = currentBase.trim()
  const knownDefaults = new Set([
    ...REMOTE_APIS.map((a) => a.defaultBaseUrl),
    'https://generativelanguage.googleapis.com/v1beta/openai',
    'https://generativelanguage.googleapis.com'
  ])
  if (!trimmed || knownDefaults.has(trimmed.replace(/\/+$/, ''))) {
    return nextApi === 'openai' || nextApi === 'anthropic' ? '' : remoteApiMeta(nextApi).defaultBaseUrl
  }
  return currentBase
}

function ModelBrowserPopover({
  models,
  selectedId,
  fromEndpoint,
  onSelect
}: {
  models: RemoteModelInfo[]
  selectedId: string
  fromEndpoint: boolean
  onSelect: (m: RemoteModelInfo) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | RemoteModelCategory>('all')

  const safeModels = useMemo(() => normalizeRemoteModelList(models), [models])

  const counts = useMemo(() => {
    const map = new Map<RemoteModelCategory, number>()
    for (const m of safeModels) {
      const cat = m.category ?? 'chat'
      map.set(cat, (map.get(cat) ?? 0) + 1)
    }
    return map
  }, [safeModels])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return safeModels.filter((m) => {
      if (category !== 'all' && (m.category ?? 'chat') !== category) return false
      if (!q) return true
      return (
        (m.id ?? '').toLowerCase().includes(q) ||
        Boolean(m.label?.toLowerCase().includes(q)) ||
        Boolean(m.description?.toLowerCase().includes(q))
      )
    })
  }, [safeModels, query, category])

  const tabs = (['chat', 'reasoning', 'image', 'audio', 'other'] as RemoteModelCategory[]).filter((c) => (counts.get(c) ?? 0) > 0)

  return (
    <Popover
      side="bottom"
      align="end"
      disabled={safeModels.length === 0}
      className="w-[36rem] max-w-[92vw] border border-line bg-bg/95 shadow-2xl"
      triggerClassName="border border-line/60 bg-black/50 px-2.5 py-1.5 font-mono text-[11.5px] text-white hover:border-accent hover:text-accent disabled:opacity-45"
      title="Browse all available models with context sizes and descriptions"
      trigger={
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span>{fromEndpoint ? `Browse all (${safeModels.length})` : `Suggested (${safeModels.length})`}</span>
          <ChevronDown className="h-3.5 w-3.5 text-dim" />
        </span>
      }
    >
      {(close) => (
        <div className="flex flex-col">
          <div className="flex flex-col gap-2 border-b border-line/50 p-2.5">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-faint" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filter ${safeModels.length} models by ID, name, or description…`}
                className="h-8 pl-8 text-[12px]"
              />
            </div>
            {tabs.length > 1 && (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setCategory('all')}
                  className={cn(
                    'border px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                    category === 'all' ? 'border-accent bg-accent/15 text-accent' : 'border-line/50 text-dim hover:border-line hover:text-white'
                  )}
                >
                  All ({safeModels.length})
                </button>
                {tabs.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      'border px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                      category === c ? 'border-accent bg-accent/15 text-accent' : 'border-line/50 text-dim hover:border-line hover:text-white'
                    )}
                  >
                    {CATEGORY_LABELS[c]} ({counts.get(c) ?? 0})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-line/25">
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-[12px] text-dim">
                No models match &ldquo;{query}&rdquo;.
              </div>
            )}
            {filtered.map((m) => {
              const active = m.id === selectedId
              const ctx = formatCtx(m.context)
              const cat = m.category ?? 'chat'
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect(m)
                    close()
                  }}
                  className={cn(
                    'flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors hover:bg-accent/10',
                    active && 'bg-accent/15'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Check className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-accent' : 'text-transparent')} />
                    <span className="min-w-0 truncate text-[12.5px] font-medium text-white">
                      {m.label && m.label !== m.id ? m.label : m.id}
                    </span>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      {m.thinking && (
                        <span className="border border-teal/40 bg-teal/10 px-1 py-0.5 font-mono text-[9px] uppercase text-teal">
                          Thinking
                        </span>
                      )}
                      {ctx && (
                        <span className="border border-line/50 bg-black/40 px-1 py-0.5 font-mono text-[9.5px] text-dim">
                          {ctx}
                        </span>
                      )}
                      <span className="border border-line/40 px-1 py-0.5 font-mono text-[9px] uppercase text-faint">
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </div>
                  </div>
                  <div className="pl-5 font-mono text-[11px] text-accent/90">{m.id}</div>
                  {m.description && (
                    <div className="line-clamp-2 pl-5 text-[11px] leading-snug text-dim">{m.description}</div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between border-t border-line/40 bg-black/50 px-3 py-1.5 font-mono text-[10px] text-faint">
            <span>Showing {filtered.length} of {safeModels.length} models</span>
            <span>{fromEndpoint ? 'Live from endpoint' : 'Preset suggestions'}</span>
          </div>
        </div>
      )}
    </Popover>
  )
}

function RemoteFormBody({
  draft,
  preset,
  keySaved,
  fetchedModels,
  fetchingModels,
  onChange,
  onFetchModels
}: {
  draft: RemoteDraft
  preset: RemotePreset
  keySaved: boolean
  fetchedModels: RemoteModelInfo[]
  fetchingModels: boolean
  onChange: (next: RemoteDraft) => void
  onFetchModels: () => void
}) {
  const [showKey, setShowKey] = useState(false)
  const set = (patch: Partial<RemoteDraft>) => onChange({ ...draft, ...patch })
  const apiMeta = remoteApiMeta(draft.api)

  const pickerModels: RemoteModelInfo[] = fetchedModels.length
    ? fetchedModels
    : preset.suggestedModels.map((m) => ({ id: m.id, context: m.context, category: 'chat' }))
  const quickPicks = pickerModels.slice(0, 6)

  const pickModel = (m: RemoteModelInfo) => {
    set({
      model: m.id,
      ...(m.context ? { contextSize: m.context } : {})
    })
  }

  return (
    <div className="flex flex-col">
      <SettingRow label="Name" hint="Display name inside Seven (Models & Agents).">
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder={preset.defaultName || 'Remote model'} />
      </SettingRow>

      <SettingRow label="Protocol" hint={apiMeta.docsHint}>
        <Select
          value={draft.api}
          options={API_OPTIONS}
          onChange={(v) => {
            const nextApi = v as RemoteApi
            set({ api: nextApi, baseUrl: nextBaseUrlForProtocol(draft.baseUrl, nextApi) })
          }}
          className="h-8 w-72 text-[12.5px]"
        />
      </SettingRow>

      <SettingRow label="Address" hint={`Leave empty for ${apiMeta.defaultBaseUrl}. Required for proxies, OpenRouter, or self-hosted servers.`}>
        <Input
          value={draft.baseUrl}
          onChange={(e) => set({ baseUrl: e.target.value })}
          placeholder={apiMeta.defaultBaseUrl}
          className="font-mono text-[12.5px]"
        />
      </SettingRow>

      <SettingRow
        label="Model ID"
        hint={
          fetchedModels.length
            ? `${fetchedModels.length} models returned by this endpoint — use Browse all (${fetchedModels.length}) to search & inspect all of them.`
            : 'Exact model identifier sent to the provider API, or click Fetch list to discover all models on your key.'
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={draft.model}
              onChange={(e) => set({ model: e.target.value })}
              placeholder={preset.defaultModel || 'model-id'}
              className="min-w-44 flex-1 font-mono text-[12.5px]"
            />
            {pickerModels.length > 0 && (
              <ModelBrowserPopover
                models={pickerModels}
                selectedId={draft.model}
                fromEndpoint={fetchedModels.length > 0}
                onSelect={pickModel}
              />
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw className={fetchingModels ? 'animate-spin' : undefined} />}
              disabled={fetchingModels || (!draft.key.trim() && !keySaved && apiMeta.keyRequired)}
              title="Query the endpoint for available model IDs"
              onClick={onFetchModels}
            >
              {fetchingModels ? 'Listing…' : 'Fetch list'}
            </Button>
          </div>
          {quickPicks.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {quickPicks.map((m) => {
                const active = draft.model === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pickModel(m)}
                    title={m.label || m.description || m.id}
                    className={cn(
                      'border px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                      active ? 'border-accent bg-accent/15 text-accent' : 'border-line/50 bg-black/35 text-dim hover:border-line hover:text-white'
                    )}
                  >
                    {m.id}
                  </button>
                )
              })}
              {pickerModels.length > quickPicks.length && (
                <span className="px-1 font-mono text-[10px] text-faint">
                  +{pickerModels.length - quickPicks.length} more in Browse all
                </span>
              )}
            </div>
          )}
        </div>
      </SettingRow>

      <SettingRow
        label="API Key"
        hint={keySaved ? `Saved securely (${apiMeta.authHeader}). Leave blank to keep existing key, or type a replacement.` : `Sent only via ${apiMeta.authHeader} — never exposed in URLs or logs.`}
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Input
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              value={draft.key}
              onChange={(e) => set({ key: e.target.value })}
              placeholder={keySaved ? '•••••••• (saved — type to replace)' : apiMeta.keyPrefix}
              className="min-w-0 flex-1 font-mono text-[12.5px]"
            />
            <Button
              size="sm"
              variant="ghost"
              icon={showKey ? <EyeOff /> : <Eye />}
              onClick={() => setShowKey((s) => !s)}
              title={showKey ? 'Hide key' : 'Show key temporarily'}
            />
          </div>
        </div>
      </SettingRow>

      <SettingRow label="Context size" hint="Context limit in tokens used for chat budget & summaries.">
        <div className="flex flex-wrap items-center gap-2">
          <NumberField
            value={draft.contextSize}
            onChange={(v) => v !== undefined && set({ contextSize: v })}
            min={2048}
            max={2000000}
            step={1024}
            className="h-8 w-36 text-[12.5px]"
          />
          <div className="flex flex-wrap gap-1">
            {CONTEXT_QUICK.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => set({ contextSize: c.value })}
                className={cn(
                  'border px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                  draft.contextSize === c.value ? 'border-teal bg-teal/15 text-teal' : 'border-line/50 text-faint hover:border-line hover:text-white'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </SettingRow>
    </div>
  )
}

function useRemoteProbeState(modelId: string | null, draft: RemoteDraft) {
  const [fetchedModels, setFetchedModels] = useState<RemoteModelInfo[]>([])
  const [fetchingModels, setFetchingModels] = useState(false)
  const [probeState, setProbeState] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, runTest] = useBusy()

  const clearProbe = () => {
    setFetchedModels([])
    setProbeState(null)
  }

  const fetchList = () => {
    setFetchingModels(true)
    void engine('models.remote.models', {
      ...(modelId ? { id: modelId } : {}),
      api: draft.api,
      baseUrl: draft.baseUrl.trim() || null,
      key: draft.key.trim() || null
    })
      .then((raw) => {
        const models = normalizeRemoteModelList(raw)
        setFetchedModels(models)
        if (!models.length) toast.info('No models returned', 'The endpoint answered, or listing requires a valid key.')
        else toast.success('Fetched model list', `${models.length} models available — click Browse all (${models.length})`)
      })
      .catch(failed('Could not list models'))
      .finally(() => setFetchingModels(false))
  }

  const runProbe = (options?: { beforeProbe?: () => Promise<void>; notify?: boolean }) =>
    runTest(async () => {
      if (options?.beforeProbe) await options.beforeProbe()
      try {
        const res = (await engine('models.remote.probe', {
          ...(modelId ? { id: modelId } : {}),
          api: draft.api,
          baseUrl: draft.baseUrl.trim() || null,
          model: draft.model.trim(),
          key: draft.key.trim() || null,
          contextSize: draft.contextSize
        })) as { ok?: boolean; reply?: string; error?: string; models?: unknown }
        const models = normalizeRemoteModelList(res.models)
        if (models.length) setFetchedModels(models)
        const ok = typeof res.ok === 'boolean' ? res.ok : Boolean(res.reply)
        if (ok) {
          const text = res.reply ?? 'Connected'
          setProbeState({ ok: true, text })
          if (options?.notify) toast.success('Connected cleanly', text)
        } else {
          const hint = models.length
            ? ` — Your key authenticated and returned ${models.length} models; click Browse all (${models.length}) above to pick an active model.`
            : ''
          const text = `${res.error ?? 'Connection check failed'}${hint}`
          setProbeState({ ok: false, text })
          if (options?.notify) toast.error('Connection failed', res.error ?? 'Connection check failed')
        }
      } catch (err) {
        const text = errorText(err)
        setProbeState({ ok: false, text })
        if (options?.notify) toast.error('Connection failed', text)
      }
    }, 'Test failed')

  return { fetchedModels, fetchingModels, probeState, setProbeState, clearProbe, testing, fetchList, runProbe }
}

export function AddRemoteModal({
  initialPresetId = 'google',
  onClose,
  onAdded
}: {
  initialPresetId?: string
  onClose: () => void
  onAdded: (id: string) => void
}) {
  const startPreset = REMOTE_PRESETS.find((p) => p.id === initialPresetId) ?? REMOTE_PRESETS[0]
  const [presetId, setPresetId] = useState(startPreset.id)
  const [draft, setDraft] = useState<RemoteDraft>({
    name: startPreset.defaultName,
    api: startPreset.api,
    baseUrl: startPreset.baseUrl,
    model: startPreset.defaultModel,
    key: '',
    contextSize: startPreset.defaultContext
  })
  const probe = useRemoteProbeState(null, draft)

  const activePreset = REMOTE_PRESETS.find((p) => p.id === presetId) ?? presetForSpec(draft.api, draft.baseUrl)

  const selectPreset = (next: RemotePreset) => {
    const prevPreset = REMOTE_PRESETS.find((p) => p.id === presetId)
    setPresetId(next.id)
    probe.clearProbe()
    setDraft((prev) => ({
      ...prev,
      api: next.api,
      baseUrl: next.baseUrl,
      name: !prev.name.trim() || prev.name === prevPreset?.defaultName ? next.defaultName : prev.name,
      model: !prev.model.trim() || prev.model === prevPreset?.defaultModel ? next.defaultModel : prev.model,
      contextSize: next.defaultContext
    }))
  }

  const add = async () => {
    try {
      const saved = await writeRemote(null, draft, false)
      toast.success('Remote model added', saved.name)
      onAdded(saved.id)
      onClose()
    } catch (err) {
      toast.error('Could not add remote model', errorText(err))
    }
  }

  const apiMeta = remoteApiMeta(draft.api)
  const missingRequiredKey = (activePreset.keyRequired || apiMeta.keyRequired) && !draft.key.trim()

  return (
    <Modal
      open
      wide
      title="Connect a Remote Model"
      onClose={onClose}
      bodyClassName="flex max-h-[78vh] flex-col gap-4 overflow-y-auto p-4"
      footer={
        <>
          <Button
            variant="secondary"
            icon={<PlugZap />}
            disabled={probe.testing || !draft.model.trim() || missingRequiredKey}
            onClick={() => void probe.runProbe()}
            title="Test API key, endpoint, and model before adding"
          >
            {probe.testing ? 'Testing…' : 'Test connection'}
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={<Cloud />}
            disabled={!draft.name.trim() || !draft.model.trim()}
            onClick={() => void add()}
          >
            Add model
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Eyebrow>1. Choose Provider</Eyebrow>
        <PresetGrid activeId={activePreset.id} onPick={selectPreset} />
      </div>

      <ReadinessCard draft={draft} preset={activePreset} keySaved={false} />

      <div className="flex flex-col gap-1">
        <Eyebrow>2. Connection Details</Eyebrow>
        <RemoteFormBody
          draft={draft}
          preset={activePreset}
          keySaved={false}
          fetchedModels={probe.fetchedModels}
          fetchingModels={probe.fetchingModels}
          onChange={(next) => {
            setDraft(next)
            probe.setProbeState(null)
          }}
          onFetchModels={probe.fetchList}
        />
      </div>

      {probe.probeState && (
        <div
          className={cn(
            'flex items-start gap-2 border px-3 py-2 text-[12px]',
            probe.probeState.ok ? 'border-ok/50 bg-ok/10 text-ok' : 'border-alert/50 bg-alert/10 text-alert'
          )}
        >
          {probe.probeState.ok ? <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10.5px] font-bold uppercase tracking-wider">
              {probe.probeState.ok ? 'Connected cleanly' : 'Connection check failed'}
            </div>
            <div className="mt-0.5 text-white/90">{probe.probeState.text}</div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function RemoteModelDetail({
  model,
  onRemove,
  onToggleFavourite
}: {
  model: ModelEntry
  onRemove: () => void
  onToggleFavourite: () => void
}) {
  const spec = model.remote!
  const autosave = useAutosavedState<RemoteDraft>(
    { name: model.name, api: spec.api, baseUrl: spec.baseUrl ?? '', model: spec.model, key: '', contextSize: 32768 },
    (d) => writeRemote(model.id, d, true),
    { when: (d) => Boolean(d.name.trim() && d.model.trim()) }
  )
  const draft = autosave.value
  const probe = useRemoteProbeState(model.id, draft)

  const agents = useAgents((s) => s.list)
  const saveAgent = useAgents((s) => s.save)
  const assignedAgents = useMemo(() => agents.filter((a) => a.modelId === model.id), [agents, model.id])
  const otherAgents = useMemo(() => agents.filter((a) => a.modelId !== model.id), [agents, model.id])

  useEffect(() => {
    void useModels
      .getState()
      .getConfig(model.id)
      .then((c) => autosave.reset({ ...autosave.value, contextSize: Number(c.contextSize) || 32768 }))
      .catch(noteFailure('models', 'Could not read the model settings'))
  }, [model.id])

  const preset = presetForSpec(draft.api, draft.baseUrl)
  const host = remoteHostLabel(draft.api, draft.baseUrl)
  const isLocal = isLocalAddress(draft.baseUrl)

  const test = () => probe.runProbe({ beforeProbe: () => autosave.flush(), notify: true })

  const openAgent = (agentId: string) => {
    useAgents.setState({ focus: agentId })
    useApp.getState().setView('agents')
  }

  const assignAgent = (agentId: string) => {
    const a = agents.find((x) => x.id === agentId)
    if (!a) return
    void saveAgent({ ...a, modelId: model.id })
      .then(() => toast.success('Assigned remote model', `${a.name} now uses ${model.name}`))
      .catch(failed('Could not assign model to agent'))
  }

  return (
    <Panel className="min-w-0 flex-1" bodyClassName="flex flex-col gap-5 overflow-y-auto p-4 [&>*]:shrink-0">
      <div className="flex flex-wrap items-start gap-3 border-b border-line/40 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-all font-mono text-[16px] font-bold leading-snug text-white">{model.name}</h2>
            <button
              type="button"
              onClick={onToggleFavourite}
              title={model.favourite ? 'Remove from favourites' : 'Pin as favourite'}
              className={model.favourite ? 'text-accent' : 'text-faint hover:text-accent'}
            >
              <Star className="h-4 w-4" fill={model.favourite ? 'currentColor' : 'none'} />
            </button>
            <StatusBadge tone={isLocal ? 'ok' : 'warn'}>{preset.label}</StatusBadge>
            <span className={cn('inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider', spec.hasKey || draft.key.trim() ? 'border-ok/40 bg-ok/10 text-ok' : preset.keyRequired ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line/50 text-faint')}>
              <KeyRound className="h-2.5 w-2.5" />
              {spec.hasKey || draft.key.trim() ? 'Key saved' : preset.keyRequired ? 'Key missing' : 'No key set'}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11.5px] text-dim">
            {remoteApiMeta(draft.api).protocol} · {host} · {draft.model || 'no model id'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SaveState status={autosave.status} error={autosave.error} />
          <Button variant="primary" icon={<PlugZap />} disabled={probe.testing} onClick={() => void test()}>
            {probe.testing ? 'Testing…' : 'Test connection'}
          </Button>
          <Button variant="ghost" icon={<Trash2 />} onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>

      {probe.probeState && (
        <div
          className={cn(
            'flex items-start gap-2 border px-3 py-2 text-[12px]',
            probe.probeState.ok ? 'border-ok/50 bg-ok/10 text-ok' : 'border-alert/50 bg-alert/10 text-alert'
          )}
        >
          {probe.probeState.ok ? <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider">
              {probe.probeState.ok ? 'Live test reply: ' : 'Test failed: '}
            </span>
            <span className="text-white/90">{probe.probeState.text}</span>
          </div>
        </div>
      )}

      <ReadinessCard draft={draft} preset={preset} keySaved={spec.hasKey} />

      <SettingCard title="Connection & Credentials">
        <RemoteFormBody
          draft={draft}
          preset={preset}
          keySaved={spec.hasKey}
          fetchedModels={probe.fetchedModels}
          fetchingModels={probe.fetchingModels}
          onChange={autosave.set}
          onFetchModels={probe.fetchList}
        />
      </SettingCard>

      <SettingCard
        title="Agents Using This Model"
        actions={
          otherAgents.length > 0 ? (
            <Select
              value=""
              options={[{ value: '', label: 'Assign to an agent…' }, ...otherAgents.map((a) => ({ value: a.id, label: a.name }))]}
              onChange={(id) => id && assignAgent(id)}
              className="h-7 w-48 text-[11.5px]"
            />
          ) : null
        }
      >
        {assignedAgents.length ? (
          <div className="flex flex-col gap-1.5 py-1">
            {assignedAgents.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 border border-line/40 bg-black/35 px-3 py-2">
                <button type="button" onClick={() => openAgent(a.id)} className="flex min-w-0 items-center gap-2.5 text-left hover:text-accent">
                  <AgentAvatar agent={a} size={22} />
                  <span className="truncate text-[13px] font-medium text-white">{a.name}</span>
                  {a.description && <span className="hidden truncate text-[11.5px] text-dim sm:inline">{a.description}</span>}
                </button>
                <Button size="sm" variant="ghost" onClick={() => openAgent(a.id)}>
                  Open in Agents
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 py-2 text-[12px] text-dim">
            <span>No agent uses this model yet. Remote models aren’t loaded globally — pick this model on an agent to route its chats through {host}.</span>
            {otherAgents.length > 0 && <UserPlus className="h-4 w-4 shrink-0 text-faint" />}
          </div>
        )}
      </SettingCard>

      <RemoteParams modelId={model.id} />
    </Panel>
  )
}
