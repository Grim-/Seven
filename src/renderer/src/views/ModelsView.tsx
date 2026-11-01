import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpNarrowWide, Clock, Cloud, Copy, Cpu, Download, FilePlus, FolderOpen, Folders, Layers, PlugZap, Power, RotateCcw, Search, Star, Trash2 } from 'lucide-react'
import type { ChatTemplate, CudaInstallProgress, GpuBackend, GpuInfo, ModelConfig, ModelEntry, ModelFixInfo, ModelKind, ParamDef, ParamSection, RemoteApi, ThinkingLevel } from '@shared/types'
import { MODEL_KINDS, type HubModel } from '@shared/types'
import { DownloadsCard } from '../components/models/DownloadsCard'
import { HubSearch } from '../components/models/HubSearch'
import { HubRepo } from '../components/models/HubRepo'
import { MTP_NOTE, modelTraits } from '../components/models/ModelTraits'
import { modelFacets } from '../components/models/modelFacets'
import { applyFacets, useFacetValues } from '../lib/facets'
import { useViewPlace } from '../lib/viewPlace'
import { applyModelArgs, modelArgsText } from '@shared/modelArgs'
import { thinkingLabel } from '../lib/thinking'
import { BackBar, Button, Eyebrow, FacetBar, InfoTip, Input, KindShell, Modal, NumberField, Panel, SegmentBar, SaveState, Select, SettingRow, SliderNumber, StatusBadge, ShellTabs, Textarea, Toggle, ViewHeader, openMenu, useAutosavedState, type ShellItem, type ShellSort } from '../components/ui'
import { isRunnable, modelBytes, useModels } from '../store/models'
import { engine, main, on } from '../lib/ipc'
import { errorText, formatBytes } from '../lib/format'
import { toast } from '../store/toasts'
import { cn } from '../lib/cn'
import { ModelFolders } from './ModelFolders'
import { failed, copyText } from '../lib/notify'
import { useBusy } from '../lib/useBusy'

type Tab = 'all' | 'favourites' | 'remote' | ModelKind


function dirOf(file: string): string {
  return file.replace(/[\\/][^\\/]*$/, '')
}

const SECTIONS: { id: ParamSection; label: string; open: boolean }[] = [
  { id: 'memory', label: 'Memory and GPU', open: true },
  { id: 'context', label: 'Context', open: true },
  { id: 'speed', label: 'Speed', open: true },
  { id: 'thinking', label: 'Thinking', open: true },
  { id: 'sampling', label: 'Sampling', open: true },
  { id: 'repetition', label: 'Repetition', open: false },
  { id: 'advanced', label: 'Advanced', open: false }
]

const REMOTE_KEYS = new Set(['contextSize', 'temperature', 'topP', 'maxTokens', 'thinking', 'thinkingLow', 'thinkingMedium', 'thinkingHigh'])

function optionLabel(def: ParamDef, o: string): string {
  return def.key === 'thinking' ? thinkingLabel(o as ThinkingLevel) : o
}

function ParamInput({ def, value, onChange }: { def: ParamDef; value: number | boolean | string; onChange: (v: number | boolean | string) => void }) {
  if (def.type === 'bool') return <Toggle checked={value === true} onChange={onChange} label={value ? 'On' : 'Off'} />
  if (def.type === 'select') return <Select value={String(value)} options={(def.options ?? []).map((o) => ({ value: o, label: optionLabel(def, o) }))} onChange={onChange} className="h-7 w-36 text-[12px]" />
  const min = def.min ?? 0
  const max = def.max ?? 100
  const step = def.step ?? 1
  if ((max - min) / step <= 4000) return <SliderNumber value={Number(value)} min={min} max={max} step={step} onChange={onChange} />
  return <NumberField value={value as number} onChange={(v) => v !== undefined && onChange(v)} min={def.min} max={def.max} step={def.step} className="h-7 w-32 text-[12px]" />
}

function ArgsBox({ config, params, onChange }: { config: ModelConfig; params: ParamDef[]; onChange: (c: ModelConfig) => void }) {
  const current = modelArgsText(config, params)
  const [text, setText] = useState(current)
  const [editing, setEditing] = useState(false)
  const [unknown, setUnknown] = useState<string[]>([])
  useEffect(() => {
    if (!editing) setText(current)
  }, [current, editing])
  const apply = () => {
    setEditing(false)
    const result = applyModelArgs(config, text, params)
    setUnknown(result.unknown)
    onChange(result.config)
  }
  return (
    <SettingRow wide label="llama.cpp options" hint="The settings below as llama.cpp command-line flags, e.g. -ngl 99 -c 16384 -fa on --temp 0.6. Paste a line from a model card and press Enter: the flags Seven can use fill in the settings below, flags it can't are listed underneath. Removing a flag puts that setting back to its default.">
      <div className="flex w-full flex-col gap-1">
        <Input
          value={text}
          onFocus={() => setEditing(true)}
          onChange={(e) => setText(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          placeholder="-ngl 99 -c 16384 -fa on --temp 0.6"
          spellCheck={false}
          className="h-8 font-mono text-[12px]"
        />
        {unknown.length > 0 && <span className="font-mono text-[11px] text-alert">Not supported here: {unknown.join('  ')}</span>}
      </div>
    </SettingRow>
  )
}

function ParamsSection({ modelId, remote = false }: { modelId: string; remote?: boolean }) {
  const { params, getConfig, setConfig, resetConfig, host, load } = useModels()
  const [reloadRequired, setReloadRequired] = useState(false)
  const autosave = useAutosavedState<ModelConfig | null>(
    null,
    async (c) => {
      const result = await setConfig(modelId, c!)
      if (result.reloadRequired) setReloadRequired(true)
    },
    { when: (c) => c !== null }
  )
  const config = autosave.value
  const setConfigState = autosave.reset

  useEffect(() => {
    let cancelled = false
    setReloadRequired(false)
    getConfig(modelId)
      .then((c) => !cancelled && setConfigState(c))
      .catch(failed('Could not read settings'))
    return () => {
      cancelled = true
    }
  }, [modelId, getConfig])

  if (!config) return null

  const reset = async () => {
    await autosave.flush()
    const result = await resetConfig(modelId)
    setConfigState(result.config)
    setReloadRequired(result.reloadRequired)
  }

  const reload = async () => {
    try {
      await useModels.getState().unload()
      await load(modelId)
      setReloadRequired(false)
    } catch (err) {
      toast.error('Reload failed', errorText(err))
    }
  }

  const shown = params.filter((p) => !remote || REMOTE_KEYS.has(p.key))
  const hint = (def: ParamDef) => (remote && def.key === 'contextSize' ? "The model's context window in tokens, from the provider. Seven uses it to measure the chat and decide when to summarise." : def.hint)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-line/50 pb-1.5">
        <Eyebrow className="flex-1">Settings</Eyebrow>
        <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void reset()}>
          Reset all
        </Button>
        <SaveState status={autosave.status} error={autosave.error} />
      </div>
      {reloadRequired && host.modelId === modelId && (
        <div className="flex items-center gap-3 border border-line border-l-2 border-l-accent bg-accent/5 px-3 py-2 text-[12.5px] text-white">
          <span className="flex-1">Load settings changed. Reload the model to apply them.</span>
          <Button size="sm" variant="badge" onClick={() => void reload()}>
            Reload
          </Button>
        </div>
      )}
      {!remote && <ArgsBox config={config} params={params} onChange={(c) => autosave.set(c)} />}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(27rem,1fr))] items-start gap-3">
        {SECTIONS.map((section) => {
          const defs = shown.filter((p) => p.section === section.id)
          if (!defs.length) return null
          return (
            <Panel key={section.id} title={section.label} collapsible defaultOpen={section.open} bodyClassName="flex flex-col px-3 py-1">
              {defs.map((def) => (
                <SettingRow key={def.key} label={def.label} hint={hint(def)}>
                  <ParamInput def={def} value={config[def.key] ?? def.default} onChange={(v) => autosave.set((c) => ({ ...c!, [def.key]: v }))} />
                </SettingRow>
              ))}
            </Panel>
          )
        })}
      </div>
    </div>
  )
}

function Fact({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-0.5', wide && 'col-span-full')}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-teal/70">{label}</span>
      <span className="break-all text-[13px] text-white">{children}</span>
    </div>
  )
}

function useActions() {
  const { host, load, unload, remove, setFavourite } = useModels()
  const toggle = async (m: ModelEntry) => {
    try {
      if (host.modelId === m.id && host.status === 'ready') await unload()
      else await load(m.id)
    } catch (err) {
      toast.error('Model load failed', errorText(err))
    }
  }
  const useForSearch = (m: ModelEntry) =>
    void engine('mind.prefs.set', { embeddingModelId: m.id })
      .then(() => toast.success('Memory search model set', m.name))
      .catch(failed('Could not set it'))
  const showFolder = (m: ModelEntry) => void main('folder.open', { path: dirOf(m.path) }).catch(failed('Could not open folder'))
  const copyPath = (m: ModelEntry) => void copyText(m.path)
  const drop = (m: ModelEntry) => void remove(m.id).catch(failed('Remove failed'))
  const star = (m: ModelEntry) => void setFavourite(m.id, !m.favourite)
  return { toggle, useForSearch, showFolder, copyPath, drop, star }
}

const GPU_OPTIONS: { value: GpuBackend; label: string }[] = [
  { value: 'auto', label: 'GPU: Auto' },
  { value: 'cuda', label: 'GPU: CUDA' },
  { value: 'vulkan', label: 'GPU: Vulkan' },
  { value: 'cpu', label: 'GPU: None (CPU)' }
]

const ACTIVE_LABEL: Record<string, string> = { cuda: 'CUDA', vulkan: 'Vulkan', metal: 'Metal', cpu: 'CPU' }

function GpuPicker() {
  const status = useModels((s) => s.host.status)
  const [info, setInfo] = useState<GpuInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [why, setWhy] = useState(false)
  const [getting, setGetting] = useState<CudaInstallProgress | null>(null)
  useEffect(() => on('cuda.install', setGetting), [])
  const getCuda = async () => {
    setGetting({ stage: 'download', received: 0, total: info?.cudaDownload ?? 0 })
    try {
      await engine('models.cuda.install')
      toast.success('CUDA libraries installed', 'The engine is restarting so it can use CUDA. Load your model again.')
      setWhy(false)
      window.setTimeout(() => void engine('models.gpu.get').then(setInfo).catch(() => undefined), 4000)
    } catch (err) {
      toast.error('Could not get the CUDA libraries', errorText(err))
    } finally {
      setGetting(null)
    }
  }
  useEffect(() => {
    void engine('models.gpu.get')
      .then(setInfo)
      .catch(() => undefined)
  }, [status])
  if (!info) return null
  const change = async (v: string) => {
    setBusy(true)
    try {
      setInfo(await engine('models.gpu.set', { choice: v as GpuBackend }))
      await useModels.getState().refresh()
    } catch (err) {
      toast.error('Could not change the GPU backend', errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <span className="flex items-center gap-2" title="Which llama.cpp build runs models. Changing it unloads the current model. Auto tries CUDA, then Vulkan, then CPU.">
      <Select value={info.choice} options={GPU_OPTIONS} disabled={busy || status === 'loading'} onChange={(v) => void change(v)} className="w-44" />
      {info.note || info.cudaDownload ? (
        <button onClick={() => setWhy(true)} className="font-mono text-[11px] text-accent underline decoration-accent/40 underline-offset-2 hover:text-white">
          {info.active ? `Running on ${ACTIVE_LABEL[info.active] ?? info.active}` : 'Not started'}: why not CUDA?
        </button>
      ) : (
        <span className="font-mono text-[11px] text-dim">{info.active ? `Running on ${ACTIVE_LABEL[info.active] ?? info.active}` : 'Not started'}</span>
      )}
      <Modal open={why} title="Why not CUDA" onClose={() => setWhy(false)}>
        <div className="flex flex-col gap-3">
          {info.note && <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] text-white/90">{info.note}</pre>}
          {info.cudaDownload !== null && (
            <div className="flex flex-col gap-2 border-t border-line/40 pt-3">
              <span className="text-[12.5px] text-dim">
                Seven can download the CUDA 13 libraries it needs (cuBLAS and the CUDA runtime) from NVIDIA's packages on PyPI, about {Math.round(info.cudaDownload / 1e6)} MB, and keep them in its own folder. The engine restarts afterwards; then load your model again.
              </span>
              {getting ? (
                <div className="flex flex-col gap-1">
                  <SegmentBar value={getting.total ? getting.received / getting.total : 0} />
                  <span className="font-mono text-[11px] text-dim">
                    {getting.stage === 'extract' ? 'Unpacking…' : getting.stage === 'done' ? 'Done' : `Downloading ${Math.round(getting.received / 1e6)} of ${Math.round(getting.total / 1e6)} MB`}
                  </span>
                </div>
              ) : (
                <Button variant="primary" onClick={() => void getCuda()}>
                  Get CUDA libraries
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>
    </span>
  )
}

function TemplateField({ model, onSaved }: { model: ModelEntry; onSaved: () => void }) {
  const [choice, setChoice] = useState<ChatTemplate | null>(null)
  const [wrappers, setWrappers] = useState<string[]>([])
  useEffect(() => {
    void engine('models.template.get', { id: model.id })
      .then((r) => {
        setChoice(r.choice)
        setWrappers(r.wrappers)
        setText(r.choice.type === 'jinja' ? r.choice.template : '')
      })
      .catch(() => undefined)
  }, [model.id])
  const save = (next: ChatTemplate) =>
    engine('models.template.set', { id: model.id, choice: next })
      .then((r) => {
        setChoice(r.choice)
        onSaved()
      })
      .catch(failed('Could not use that template'))
  const template = useAutosavedState('', (t) => engine('models.template.set', { id: model.id, choice: { type: 'jinja', template: t } }).then(onSaved), { when: (t) => Boolean(t.trim()) })
  const text = template.value
  const setText = template.reset
  if (!choice) return null
  const value = choice.type === 'auto' ? 'auto' : choice.type === 'jinja' ? 'jinja' : choice.name
  const options = [{ value: 'auto', label: 'Automatic (from the file)' }, ...wrappers.map((w) => ({ value: w, label: `Built-in: ${w}` })), { value: 'jinja', label: 'Custom Jinja template' }]
  const pick = (v: string) => {
    if (v === 'jinja') setChoice({ type: 'jinja', template: text })
    else void save(v === 'auto' ? { type: 'auto' } : { type: 'wrapper', name: v })
  }
  return (
    <>
      <SettingRow label="Chat template" hint="How chats are formatted for this model. Pick a built-in when the template baked into the file is broken. Applies from the next message.">
        <Select value={value} options={options} onChange={pick} className="h-7 w-72 text-[12px]" />
      </SettingRow>
      {choice.type === 'jinja' && (
        <div className="flex flex-col gap-2">
          <Textarea
            mono
            rows={10}
            value={text}
            onChange={(e) => template.set(e.target.value)}
            placeholder="Paste a Jinja chat template"
          />
          <SaveState status={template.status} error={template.error} />
        </div>
      )}
    </>
  )
}

function ModelFixes({ model, templateRev }: { model: ModelEntry; templateRev: number }) {
  const [fixes, setFixes] = useState<ModelFixInfo[] | null>(null)
  useEffect(() => {
    void engine('models.fixes.get', { id: model.id })
      .then(setFixes)
      .catch(failed('Could not check which model fixes apply'))
  }, [model.id, templateRev])
  if (!fixes?.length) return null
  const set = (fix: string, on: boolean) =>
    void engine('models.fixes.set', { id: model.id, fix, on })
      .then(setFixes)
      .catch(failed('Could not change the fix'))
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5">
        <Eyebrow>Model fixes</Eyebrow>
        <InfoTip title="Model fixes" text="Changes Seven makes to how chats are formatted, to work around known problems in node-llama-cpp or a model's template. Only the fixes this model needs show here, worked out from its file and chat template, and they're on unless you turn one off. Changes apply from the next message." />
      </span>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-1.5">
        {fixes.map((f) => (
          <div key={f.id} className="flex items-center gap-2 border border-line/40 bg-black/40 px-2.5 py-1.5">
            <Toggle checked={f.on} onChange={(v) => set(f.id, v)} />
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-white" title={f.label}>
              {f.label}
            </span>
            <InfoTip title={f.label} text={`For ${f.models}. ${f.description}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

const API_OPTIONS: { value: RemoteApi; label: string }[] = [
  { value: 'openai', label: 'OpenAI-compatible' },
  { value: 'anthropic', label: 'Anthropic' }
]

interface RemoteDraft {
  name: string
  api: RemoteApi
  baseUrl: string
  model: string
  key: string
  contextSize: number
}

function RemoteFields({ draft, onChange, keySaved }: { draft: RemoteDraft; onChange: (d: RemoteDraft) => void; keySaved: boolean }) {
  const set = (patch: Partial<RemoteDraft>) => onChange({ ...draft, ...patch })
  return (
    <div className="flex flex-col">
      <SettingRow label="Name" hint="What Seven calls it.">
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Work GPT" />
      </SettingRow>
      <SettingRow label="API" hint="OpenAI-compatible covers OpenAI, OpenRouter, LM Studio, Ollama and most others.">
        <Select value={draft.api} options={API_OPTIONS} onChange={(v) => set({ api: v as RemoteApi })} className="h-8 w-72 text-[12.5px]" />
      </SettingRow>
      <SettingRow label="Address" hint={draft.api === 'openai' ? 'Empty for OpenAI itself. Otherwise the base URL, e.g. https://openrouter.ai/api/v1 or http://192.168.1.20:1234/v1.' : "Empty for Anthropic itself, or a compatible endpoint's base URL."}>
        <Input value={draft.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} placeholder={draft.api === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com'} />
      </SettingRow>
      <SettingRow label="Model" hint="The provider's own name for it.">
        <Input value={draft.model} onChange={(e) => set({ model: e.target.value })} placeholder={draft.api === 'openai' ? 'gpt-4.1-mini' : 'claude-sonnet-4-5'} />
      </SettingRow>
      <SettingRow label="Key" hint={keySaved ? 'A key is saved in the vault. Type a new one to replace it.' : 'Kept in the vault, encrypted once the vault is set up. Leave empty for servers that need none.'}>
        <Input type="password" autoComplete="off" value={draft.key} onChange={(e) => set({ key: e.target.value })} placeholder={keySaved ? 'saved' : 'sk-...'} />
      </SettingRow>
      <SettingRow label="Context size" hint="Tokens, from the provider.">
        <NumberField value={draft.contextSize} onChange={(v) => v !== undefined && set({ contextSize: v })} min={2048} max={2000000} step={1024} className="h-8 w-40 text-[12.5px]" />
      </SettingRow>
    </div>
  )
}

function writeRemote(id: string | null, d: RemoteDraft, keepKey: boolean): Promise<ModelEntry> {
  return engine('models.remote.save', { id, name: d.name, api: d.api, baseUrl: d.baseUrl.trim() || null, model: d.model, key: keepKey && !d.key ? null : d.key, contextSize: d.contextSize })
}

async function saveRemote(id: string | null, d: RemoteDraft, keepKey: boolean): Promise<ModelEntry | null> {
  try {
    const saved = await writeRemote(id, d, keepKey)
    toast.success('Remote model saved', saved.name)
    return saved
  } catch (err) {
    toast.error('Could not save it', errorText(err))
    return null
  }
}

function AddRemote({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const [draft, setDraft] = useState<RemoteDraft>({ name: '', api: 'openai', baseUrl: '', model: '', key: '', contextSize: 32768 })
  const add = async () => {
    const m = await saveRemote(null, draft, false)
    if (!m) return
    onAdded(m.id)
    onClose()
  }
  return (
    <Modal
      open
      title="Add a remote model"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Cloud />} disabled={!draft.name.trim() || !draft.model.trim()} onClick={() => void add()}>
            Add
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[12.5px] text-dim">A model that runs somewhere else. Agents that use it send their chats there, so only give it to agents whose data can leave this machine.</p>
        <RemoteFields draft={draft} onChange={setDraft} keySaved={false} />
      </div>
    </Modal>
  )
}

function RemoteDetail({ model }: { model: ModelEntry }) {
  const actions = useActions()
  const spec = model.remote!
  const autosave = useAutosavedState<RemoteDraft>({ name: model.name, api: spec.api, baseUrl: spec.baseUrl ?? '', model: spec.model, key: '', contextSize: 32768 }, (d) => writeRemote(model.id, d, true), { when: (d) => Boolean(d.name.trim() && d.model.trim()) })
  const draft = autosave.value
  const [testing, run] = useBusy()
  useEffect(() => {
    void useModels
      .getState()
      .getConfig(model.id)
      .then((c) => autosave.reset({ ...autosave.value, contextSize: Number(c.contextSize) || 32768 }))
      .catch(() => undefined)
  }, [model.id])
  const test = () =>
    run(async () => {
      await autosave.flush()
      toast.success('It answered', await engine('models.remote.test', { id: model.id }))
    }, 'Test failed')
  return (
    <Panel className="min-w-0 flex-1" bodyClassName="flex flex-col gap-5 overflow-y-auto p-4 [&>*]:shrink-0">
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 break-all font-mono text-[15px] font-bold leading-snug text-white">{model.name}</h2>
        <StatusBadge tone="warn">Remote</StatusBadge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SaveState status={autosave.status} error={autosave.error} />
        <Button variant="secondary" icon={<PlugZap />} disabled={testing} title="Send a tiny message to check it works" onClick={() => void test()}>
          {testing ? 'Testing...' : 'Test'}
        </Button>
        <Button variant="ghost" icon={<Trash2 />} onClick={() => actions.drop(model)}>
          Remove
        </Button>
      </div>
      <p className="text-[12.5px] text-dim">
        Give it to an agent in Agents. That agent's chats, and anything it reads to answer, are sent to {spec.baseUrl ?? (spec.api === 'anthropic' ? 'Anthropic' : 'OpenAI')}.
      </p>
      <RemoteFields
        draft={draft}
        keySaved={spec.hasKey}
        onChange={autosave.set}
      />
      <ParamsSection modelId={model.id} remote />
    </Panel>
  )
}

function ModelDetail({ model }: { model: ModelEntry }) {
  const [templateRev, setTemplateRev] = useState(0)
  const host = useModels((s) => s.host)
  const actions = useActions()
  const [searchModel, setSearchModel] = useState<string | null>(null)
  useEffect(() => {
    void engine('mind.prefs.get')
      .then((p) => setSearchModel(p.embeddingModelId))
      .catch(() => undefined)
  }, [model.id])
  const info = model.info
  const isLoaded = host.modelId === model.id && host.status === 'ready'
  const isLoading = host.modelId === model.id && host.status === 'loading'
  const embedding = info?.kind === 'embedding'
  return (
    <Panel className="min-w-0 flex-1" bodyClassName="flex flex-col gap-5 overflow-y-auto p-4 [&>*]:shrink-0">
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 break-all font-mono text-[15px] font-bold leading-snug text-white">{model.name}</h2>
        <button
          title={model.favourite ? 'Remove from favourites' : 'Favourite: keep at the top of model lists'}
          onClick={() => actions.star(model)}
          className={model.favourite ? 'text-accent' : 'text-faint hover:text-accent'}
        >
          <Star className="h-5 w-5" fill={model.favourite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {embedding ? (
          <Button variant={searchModel === model.id ? 'secondary' : 'primary'} icon={<Search />} disabled={searchModel === model.id} onClick={() => (actions.useForSearch(model), setSearchModel(model.id))}>
            {searchModel === model.id ? 'Used for memory search' : 'Use for memory search'}
          </Button>
        ) : isRunnable(model) ? (
          <Button variant={isLoaded ? 'secondary' : 'primary'} icon={<Power />} disabled={host.status === 'loading'} onClick={() => void actions.toggle(model)}>
            {isLoaded ? 'Unload' : 'Load'}
          </Button>
        ) : (
          info && <span className="text-[12.5px] text-dim">{MODEL_KINDS[info.kind].note}</span>
        )}
        {isLoaded && <StatusBadge tone="ok">Loaded</StatusBadge>}
        {isLoading && (
          <>
            <StatusBadge tone="busy">Loading</StatusBadge>
            <SegmentBar value={host.progress} className="w-40" />
          </>
        )}
        <Button variant="ghost" icon={<FolderOpen />} onClick={() => actions.showFolder(model)}>
          Show folder
        </Button>
        {model.folder === null && (
          <Button variant="ghost" icon={<Trash2 />} onClick={() => actions.drop(model)}>
            Remove
          </Button>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-5 gap-y-3 border border-line/50 bg-black/40 p-3.5">
        <Fact label="Type">
          {info ? (
            <Select
              value={info.kind}
              options={(Object.keys(MODEL_KINDS) as ModelKind[]).filter((k) => MODEL_KINDS[k].listed).map((k) => ({ value: k, label: MODEL_KINDS[k].label }))}
              onChange={(v) =>
                void engine('models.kind', { id: model.id, kind: v as ModelKind })
                  .then((next) => useModels.setState({ list: next }))
                  .catch(failed('Could not change the type'))
              }
              className="h-7 text-[12.5px]"
            />
          ) : info === null ? (
            'Unreadable'
          ) : (
            '…'
          )}
        </Fact>
        <Fact label="Architecture">{info?.architecture ?? '—'}</Fact>
        <Fact label="Parameters">{info?.sizeLabel ?? '—'}</Fact>
        <Fact label="Quant">{model.quant ?? '—'}</Fact>
        <Fact label="File size">{formatBytes(model.sizeBytes)}</Fact>
        <Fact label="Trained context">{info?.contextLength ? info.contextLength.toLocaleString() : '—'}</Fact>
        <Fact label="Layers">{info?.layers ?? '—'}</Fact>
        <Fact label="Embedding size">{info?.embeddingLength ?? '—'}</Fact>
        <Fact label="Chat template">{info ? (info.chatTemplate ? 'Yes' : 'No') : '—'}</Fact>
        {info?.experts && <Fact label="Experts">{`${info.experts.count}${info.experts.used ? `, ${info.experts.used} used per token` : ''}`}</Fact>}
        {info?.mtpLayers && <Fact label="MTP layers" wide>{`${info.mtpLayers}. ${MTP_NOTE}`}</Fact>}
        {info && MODEL_KINDS[info.kind].runnable && (
          <Fact label="Importance matrix">{info.imatrix ? ['Used when quantized', info.imatrix.dataset, info.imatrix.chunks ? `${info.imatrix.chunks} chunks` : null].filter(Boolean).join(' · ') : 'Not used'}</Fact>
        )}
        {info?.author && <Fact label="Author">{info.author}</Fact>}
        {info?.license && <Fact label="License">{info.license}</Fact>}
        <Fact label="Last used">{model.lastUsedAt ? new Date(model.lastUsedAt).toLocaleString() : 'Never'}</Fact>
        {info?.name && info.name !== model.name && <Fact label="Name inside the file" wide>{info.name}</Fact>}
        <Fact label="Path" wide>
          {model.path}
        </Fact>
      </div>
      {!embedding && info?.kind !== 'projector' && (
        <Panel title="Chat format" bodyClassName="flex flex-col px-3 py-1">
          <TemplateField model={model} onSaved={() => setTemplateRev((n) => n + 1)} />
        </Panel>
      )}
      {!embedding && info?.kind !== 'projector' && !model.remote && <ModelFixes model={model} templateRev={templateRev} />}
      {embedding ? (
        <div className="text-[12.5px] text-dim">Embedding models aren't chatted with. Seven loads this one on the CPU when agents search their memory.</div>
      ) : (
        <ParamsSection modelId={model.id} />
      )}
    </Panel>
  )
}

export function ModelsView() {
  const { list, host, add } = useModels()
  const actions = useActions()
  const [tab, setTab] = useViewPlace<Tab>('models.tab', 'all')
  const [selected, setSelected] = useViewPlace<string | null>('models.selected', null)
  const [folders, setFolders] = useState(false)
  const [addingRemote, setAddingRemote] = useState(false)
  const [hub, setHub] = useViewPlace<'search' | { repo: string; model: HubModel | null } | null>('models.hub', null)
  const [facetValues, setFacet] = useFacetValues('models')
  const facets = useMemo(() => modelFacets(list, modelBytes), [list])
  const open = (id: string) => {
    setHub(null)
    setSelected(id)
  }

  useEffect(() => {
    void engine('models.fillInfo').catch(() => undefined)
  }, [list.length])

  const counts = useMemo(() => {
    const c = { all: list.length, favourites: 0, remote: 0, ...Object.fromEntries(Object.keys(MODEL_KINDS).map((k) => [k, 0])) } as Record<Tab, number>
    for (const m of list) {
      if (m.favourite) c.favourites++
      if (m.remote) c.remote++
      if (m.info) c[m.info.kind]++
    }
    return c
  }, [list])

  const byId = useMemo(() => new Map(list.map((m) => [m.id, m])), [list])
  const sorts = useMemo((): ShellSort[] => {
    const by = (cmp: (a: ModelEntry, b: ModelEntry) => number) => (a: ShellItem, b: ShellItem) => {
      const x = byId.get(a.key)
      const y = byId.get(b.key)
      return x && y ? cmp(x, y) : 0
    }
    return [
      { id: 'name', title: 'Sort by name', icon: <ArrowDownAZ className="h-3.5 w-3.5" />, compare: by((a, b) => a.name.localeCompare(b.name)) },
      { id: 'size-desc', title: 'Largest first', icon: <ArrowDownWideNarrow className="h-3.5 w-3.5" />, compare: by((a, b) => modelBytes(b) - modelBytes(a)) },
      { id: 'size-asc', title: 'Smallest first', icon: <ArrowUpNarrowWide className="h-3.5 w-3.5" />, compare: by((a, b) => modelBytes(a) - modelBytes(b)) },
      { id: 'used', title: 'Last used', icon: <Clock className="h-3.5 w-3.5" />, compare: by((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name)) },
      { id: 'quant', title: 'By quant', icon: <Layers className="h-3.5 w-3.5" />, compare: by((a, b) => (a.quant ?? '~').localeCompare(b.quant ?? '~') || a.name.localeCompare(b.name)) }
    ]
  }, [byId])

  const inTab = useMemo(() => list.filter((m) => (tab === 'all' ? true : tab === 'favourites' ? m.favourite : tab === 'remote' ? Boolean(m.remote) : m.info?.kind === tab)), [list, tab])
  const faceted = useMemo(() => applyFacets(inTab, facets, facetValues), [inTab, facets, facetValues])

  const items = useMemo(
    (): ShellItem[] =>
      faceted.shown
        .map((m) => {
          const loaded = host.modelId === m.id && host.status === 'ready'
          const loading = host.modelId === m.id && host.status === 'loading'
          const what = m.remote ? `${m.remote.api === 'anthropic' ? 'Anthropic' : 'OpenAI-compatible'} · ${m.remote.model}` : [m.info ? MODEL_KINDS[m.info.kind].label : null, m.info?.architecture, m.info?.sizeLabel ? `${m.info.sizeLabel} params` : null].filter(Boolean).join(' · ')
          return {
            key: m.id,
            title: m.name,
            subtitle: `${m.favourite ? '★ ' : ''}${what}`,
            excerpt: m.remote ? undefined : m.path,
            icon: m.remote ? <Cloud className="h-4 w-4" /> : <Cpu className="h-4 w-4" />,
            tag: loaded ? 'LOADED' : loading ? `${Math.round(host.progress * 100)}%` : m.remote ? 'REMOTE' : (m.info ? MODEL_KINDS[m.info.kind].label : 'GGUF').toUpperCase(),
            traits: m.remote ? [] : modelTraits(m.info),
            aside: m.remote ? 'remote' : formatBytes(modelBytes(m)),
            updatedAt: m.lastUsedAt
          }
        }),
    [faceted, host.modelId, host.status, host.progress]
  )

  useEffect(() => {
    if (selected && list.length && !list.some((m) => m.id === selected)) setSelected(null)
  }, [list, selected])

  const current = selected ? (byId.get(selected) ?? null) : null

  const menu = (e: React.MouseEvent, m: ModelEntry) => {
    const isLoaded = host.modelId === m.id && host.status === 'ready'
    if (m.remote)
      return openMenu(e, m.name, [
        { label: m.favourite ? 'Remove from favourites' : 'Favourite', icon: <Star />, onSelect: () => actions.star(m) },
        { label: '', separator: true },
        { label: 'Remove', icon: <Trash2 />, danger: true, onSelect: () => actions.drop(m) }
      ])
    openMenu(e, m.name, [
      m.info?.kind === 'embedding'
        ? { label: 'Use for memory search', icon: <Search />, onSelect: () => actions.useForSearch(m) }
        : { label: isLoaded ? 'Unload' : 'Load', icon: <Power />, disabled: host.status === 'loading' || !isRunnable(m), onSelect: () => void actions.toggle(m) },
      { label: m.favourite ? 'Remove from favourites' : 'Favourite', icon: <Star />, onSelect: () => actions.star(m) },
      { label: '', separator: true },
      { label: 'Show folder', icon: <FolderOpen />, onSelect: () => actions.showFolder(m) },
      { label: 'Copy path', icon: <Copy />, onSelect: () => actions.copyPath(m) },
      ...(m.folder === null ? [{ label: '', separator: true }, { label: 'Remove', icon: <Trash2 />, danger: true, onSelect: () => actions.drop(m) }] : [])
    ])
  }

  const addFile = async () => {
    const file = await main('dialog.openModelFile')
    if (!file) return
    try {
      const entry = await add(file)
      open(entry.id)
    } catch (err) {
      toast.error('Could not add model', errorText(err))
    }
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'all', label: `All ${counts.all}` },
    { value: 'favourites', label: `Favourites ${counts.favourites}` },
    ...(counts.remote ? [{ value: 'remote' as Tab, label: `Remote ${counts.remote}` }] : []),
    ...(Object.keys(MODEL_KINDS) as ModelKind[]).filter((k) => MODEL_KINDS[k].always || counts[k]).map((k) => ({ value: k as Tab, label: `${MODEL_KINDS[k].plural} ${counts[k]}` }))
  ]

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader
        title="Models"
        subtitle="GGUF models Seven can run on this machine."
        actions={
          <>
            <GpuPicker />
            <Button variant={folders ? 'secondary' : 'ghost'} icon={<Folders />} onClick={() => setFolders(!folders)}>
              Folders
            </Button>
            <Button variant={hub ? 'secondary' : 'ghost'} icon={<Download />} onClick={() => setHub(hub ? null : 'search')}>
              Download
            </Button>
            <Button variant="ghost" icon={<Cloud />} onClick={() => setAddingRemote(true)}>
              Add remote
            </Button>
            <Button variant="primary" icon={<FilePlus />} onClick={() => void addFile()}>
              Add file
            </Button>
          </>
        }
      />
      {folders && <ModelFolders className="shrink-0" />}
      {addingRemote && <AddRemote onClose={() => setAddingRemote(false)} onAdded={open} />}
      {host.status === 'error' && host.error && <div className="border border-alert/50 border-l-2 border-l-alert bg-alert/5 px-3.5 py-2.5 font-mono text-[12px] text-alert">{host.error}</div>}
      <DownloadsCard />
      {hub ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <BackBar onBack={() => setHub(hub === 'search' ? null : 'search')} kind={hub === 'search' ? 'Hugging Face' : hub.repo} />
          {hub === 'search' ? <HubSearch onOpen={(model) => setHub({ repo: model.id, model })} /> : <HubRepo repo={hub.repo} model={hub.model} />}
        </div>
      ) : current ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <BackBar onBack={() => setSelected(null)} kind="Models" />
          {current.remote ? <RemoteDetail key={current.id} model={current} /> : <ModelDetail key={current.id} model={current} />}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <FacetBar facets={facets} values={facetValues} onChange={setFacet}>
          {`${faceted.shown.length} of ${inTab.length} shown${faceted.pending.length ? ` · reading ${faceted.pending.length} headers` : ''}`}
        </FacetBar>
        <KindShell
          id="models"
          layouts={['list', 'cards', 'deck']}
          header={<ShellTabs value={tab} options={tabs} onChange={setTab} />}
          items={items}
          sorts={sorts}
          asideLabel="Size"
          onOpen={(item) => open(item.key)}
          onDouble={(item) => {
            const m = byId.get(item.key)
            if (m && !m.remote && m.info?.kind !== 'embedding' && isRunnable(m)) void actions.toggle(m)
          }}
          onMenu={(e, item) => {
            const m = byId.get(item.key)
            if (m) menu(e, m)
          }}
          empty={list.length ? 'Nothing here for this tab and these filters.' : 'Add a model folder (Folders), or add a single GGUF file.'}
        />
        </div>
      )}
    </div>
  )
}
