import { useEffect, useMemo, useState } from 'react'
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpNarrowWide, Clock, Cloud, Copy, Cpu, Download, FilePlus, FolderOpen, Folders, Layers, Power, Search, Server, Shapes, Sparkles, Star, Trash2 } from 'lucide-react'
import type { ModelEntry, ModelKind } from '@shared/types'
import { presetForSpec, remoteHostLabel } from '@shared/remoteModels'
import { modelTraitSet } from '@shared/modelParams'
import { useProjector } from '../components/models/useProjector'
import { MODEL_KINDS, type HubModel } from '@shared/types'
import { DownloadsCard } from '../components/models/DownloadsCard'
import { HubSearch } from '../components/models/HubSearch'
import { HubRepo } from '../components/models/HubRepo'
import { MTP_NOTE, modelTraits } from '../components/models/ModelTraits'
import { entryFamily, modelFilters } from '../components/models/modelFilters'
import { applyFilters, useFilterValues } from '../lib/propertyFilters'
import { useViewPlace } from '../lib/viewPlace'
import { BackBar, BrowsePick, Button, Fact, FactGrid, FilterBar, KindShell, SegmentBar, SettingCard, StatusBadge, ShellTabs, TraitChips, ViewHeader, openMenu, type ShellItem, type ShellSort } from '../components/ui'
import { isRunnable, modelBytes, useModels } from '../store/models'
import { useImageHost } from '../store/image'
import { engine, main } from '../lib/ipc'
import { errorText, formatBytes } from '../lib/format'
import { toast } from '../store/toasts'
import { ModelFolders } from './ModelFolders'
import { ModelSettings } from '../components/models/settings/ModelSettings'
import { ImageModelConfigPanel } from '../components/models/ImageModelConfigPanel'
import { AddRemoteModal, RemoteModelDetail } from '../components/models/RemoteModels'
import { TemplateField } from '../components/models/settings/TemplateField'
import { ProjectorField } from '../components/models/settings/ProjectorField'
import { ArgsBox } from '../components/models/settings/ArgsBox'
import { useModelConfig, type ModelConfigState } from '../components/models/settings/useModelConfig'
import { generateImage } from '../components/pictures/GenerateImageModal'
import { useInstallHelper } from '../components/install/useInstallHelper'
import { openHelperInstaller, openServerView } from '../lib/openServer'
import { failed, copyText } from '../lib/notify'
import { noteFailure } from '../store/problems'

type Tab = 'all' | 'favourites' | 'remote' | ModelKind


function dirOf(file: string): string {
  return file.replace(/[\\/][^\\/]*$/, '')
}


function useActions() {
  const { host, load, unload, remove, setFavourite } = useModels()
  const { host: imageHost, load: loadImage, unload: unloadImage } = useImageHost()
  const toggle = async (m: ModelEntry) => {
    try {
      if (m.info?.kind === 'image') {
        if (imageHost.modelId === m.id && (imageHost.status === 'ready' || imageHost.status === 'generating')) await unloadImage()
        else await loadImage(m.id)
        return
      }
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

function ModelFacts({ model }: { model: ModelEntry }) {
  const info = model.info
  return (
    <SettingCard title="Model">
      <div className="p-3.5">
          <FactGrid>
            <Fact label="Type">
              {info ? (
                <BrowsePick
                  value={info.kind}
                  clearable={Boolean(model.kindChosen)}
                  placeholder="Type"
                  options={(Object.keys(MODEL_KINDS) as ModelKind[])
                    .filter((k) => MODEL_KINDS[k].listed || k === 'vae' || k === 'text_encoder' || k === 'lora' || k === info.kind)
                    .map((k) => ({
                      value: k,
                      label: MODEL_KINDS[k].label,
                      group: MODEL_KINDS[k].runnable ? 'Runnable models' : 'Companion weights',
                      ...(MODEL_KINDS[k].note ? { note: MODEL_KINDS[k].note } : {})
                    }))}
                  onChange={(v) =>
                    void engine('models.kind', { id: model.id, kind: v as ModelKind | null })
                      .then((next) => useModels.setState({ list: next }))
                      .catch(failed('Could not change the type'))
                  }
                  className="w-60"
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
          </FactGrid>
      </div>
    </SettingCard>
  )
}

function ModelOverview({ model, state }: { model: ModelEntry; state: ModelConfigState }) {
  const params = useModels((s) => s.params)
  return (
    <>
      <ModelFacts model={model} />
      <SettingCard title="Chat format">
        <TemplateField model={model} />
      </SettingCard>
      {state.config && (
        <SettingCard title="Command line">
          <ArgsBox config={state.config} params={params} onChange={state.replace} />
        </SettingCard>
      )}
    </>
  )
}

function ReloadBar({ model }: { model: ModelEntry }) {
  const host = useModels((s) => s.host)
  const { unload, load } = useModels()
  if (!host.restartNeeded || host.modelId !== model.id) return null
  const reload = async () => {
    try {
      await unload()
      await load(model.id)
    } catch (err) {
      toast.error('Reload failed', errorText(err))
    }
  }
  return (
    <div className="flex items-center gap-3 border border-line border-l-2 border-l-accent bg-accent/5 px-3 py-2 text-[12.5px] text-white">
      <span className="flex-1">Settings changed since this model was loaded. Reload it to apply them.</span>
      <Button size="sm" variant="badge" onClick={() => void reload()}>
        Reload
      </Button>
    </div>
  )
}

function ModelDetail({ model }: { model: ModelEntry }) {
  const host = useModels((s) => s.host)
  const imageHost = useImageHost((s) => s.host)
  const actions = useActions()
  const [searchModel, setSearchModel] = useState<string | null>(null)
  useEffect(() => {
    void engine('mind.prefs.get')
      .then((p) => setSearchModel(p.embeddingModelId))
      .catch(noteFailure('mind', 'Could not read the memory settings'))
  }, [model.id])
  const info = model.info
  const projector = useProjector(model.id)
  const config = useModelConfig(model.id)
  const isImage = info?.kind === 'image'
  const isLoaded = isImage
    ? imageHost.modelId === model.id && (imageHost.status === 'ready' || imageHost.status === 'generating')
    : host.modelId === model.id && host.status === 'ready'
  const isLoading = isImage ? imageHost.modelId === model.id && imageHost.status === 'loading' : host.modelId === model.id && host.status === 'loading'
  const embedding = info?.kind === 'embedding'
  const chats = info ? MODEL_KINDS[info.kind].chats : true
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-line/50 pb-2.5">
        <h2 className="mr-2 min-w-0 break-all font-mono text-[15px] font-bold leading-snug text-white">{model.name}</h2>
        <button
          title={model.favourite ? 'Remove from favourites' : 'Favourite: keep at the top of model lists'}
          onClick={() => actions.star(model)}
          className={model.favourite ? 'text-accent' : 'text-faint hover:text-accent'}
        >
          <Star className="h-4 w-4" fill={model.favourite ? 'currentColor' : 'none'} />
        </button>
        <TraitChips traits={modelTraits(info, modelBytes(model))} />
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {isLoaded && <StatusBadge tone="ok">{imageHost.status === 'generating' && isImage ? 'Generating' : 'Loaded'}</StatusBadge>}
          {isLoading && (
            <>
              <StatusBadge tone="busy">Loading</StatusBadge>
              <SegmentBar value={null} className="w-32" />
            </>
          )}
          {isImage && (
            <Button size="sm" variant="primary" icon={<Sparkles />} onClick={() => void generateImage({ modelId: model.id })}>
              Generate image…
            </Button>
          )}
          {embedding ? (
            <Button size="sm" variant={searchModel === model.id ? 'secondary' : 'primary'} icon={<Search />} disabled={searchModel === model.id} onClick={() => (actions.useForSearch(model), setSearchModel(model.id))}>
              {searchModel === model.id ? 'Used for memory search' : 'Use for memory search'}
            </Button>
          ) : isRunnable(model) ? (
            <Button size="sm" variant={isLoaded ? 'secondary' : isImage ? 'ghost' : 'primary'} icon={<Power />} disabled={isImage ? imageHost.status === 'loading' || imageHost.status === 'generating' : host.status === 'loading'} onClick={() => void actions.toggle(model)}>
              {isLoaded ? 'Unload' : 'Load'}
            </Button>
          ) : (
            info && <span className="text-[12.5px] text-dim">{MODEL_KINDS[info.kind].note}</span>
          )}
          <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => actions.showFolder(model)}>
            Show folder
          </Button>
          {model.folder === null && (
            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => actions.drop(model)}>
              Remove
            </Button>
          )}
        </span>
      </div>
      {!isImage && <ReloadBar model={model} />}
      {chats ? (
        <ModelSettings modelId={model.id} state={config} traits={modelTraitSet(info, projector.state ? projector.state.choice !== null : null)} overview={<ModelOverview model={model} state={config} />} leads={[{ section: 'vision', node: <ProjectorField projector={projector} /> }]} />
      ) : (
        <div className="flex min-h-0 max-w-4xl flex-col gap-3 overflow-y-auto pr-1">
          <ModelFacts model={model} />
          {isImage && <ImageModelConfigPanel model={model} />}
          {embedding && <div className="text-[12.5px] text-dim">Embedding models aren't chatted with. Seven loads this one on the CPU when agents search their memory.</div>}
        </div>
      )}
    </div>
  )
}

export function ModelsView() {
  const { list, host, add } = useModels()
  const imageHost = useImageHost((s) => s.host)
  const { state: sdInstall } = useInstallHelper('sd-server')
  const sdReady = Boolean(sdInstall?.active || String(sdInstall?.settings?.customExecutable ?? '').trim())
  const actions = useActions()
  const [tab, setTab] = useViewPlace<Tab>('models.tab', 'all')
  const [selected, setSelected] = useViewPlace<string | null>('models.selected', null)
  const [folders, setFolders] = useState(false)
  const [addingRemote, setAddingRemote] = useState(false)
  const [hub, setHub] = useViewPlace<'search' | { repo: string; model: HubModel | null } | null>('models.hub', null)
  const [filterValues, setFilter] = useFilterValues('models')
  const filters = useMemo(() => modelFilters(list, modelBytes), [list])
  const open = (id: string) => {
    setHub(null)
    setSelected(id)
  }

  useEffect(() => {
    void engine('models.fillInfo').catch(noteFailure('models', 'Could not fill in the model details'))
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
      {
        id: 'arch',
        title: 'Sort by family & architecture',
        icon: <Shapes className="h-3.5 w-3.5" />,
        compare: by(
          (a, b) =>
            (entryFamily(a) ?? '~').localeCompare(entryFamily(b) ?? '~') ||
            (a.info?.architecture ?? '~').localeCompare(b.info?.architecture ?? '~') ||
            a.name.localeCompare(b.name)
        )
      },
      { id: 'size-desc', title: 'Largest first', icon: <ArrowDownWideNarrow className="h-3.5 w-3.5" />, compare: by((a, b) => modelBytes(b) - modelBytes(a)) },
      { id: 'size-asc', title: 'Smallest first', icon: <ArrowUpNarrowWide className="h-3.5 w-3.5" />, compare: by((a, b) => modelBytes(a) - modelBytes(b)) },
      { id: 'used', title: 'Last used', icon: <Clock className="h-3.5 w-3.5" />, compare: by((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name)) },
      { id: 'quant', title: 'By quant', icon: <Layers className="h-3.5 w-3.5" />, compare: by((a, b) => (a.quant ?? '~').localeCompare(b.quant ?? '~') || a.name.localeCompare(b.name)) }
    ]
  }, [byId])

  const inTab = useMemo(() => list.filter((m) => (tab === 'all' ? true : tab === 'favourites' ? m.favourite : tab === 'remote' ? Boolean(m.remote) : m.info?.kind === tab)), [list, tab])
  const filtered = useMemo(() => applyFilters(inTab, filters, filterValues), [inTab, filters, filterValues])

  const items = useMemo(
    (): ShellItem[] =>
      filtered.shown
        .map((m) => {
          const isImage = m.info?.kind === 'image'
          const loaded = isImage
            ? imageHost.modelId === m.id && imageHost.status === 'ready'
            : host.modelId === m.id && host.status === 'ready'
          const loading = isImage
            ? imageHost.modelId === m.id && (imageHost.status === 'loading' || imageHost.status === 'generating')
            : host.modelId === m.id && host.status === 'loading'
          const remotePreset = m.remote ? presetForSpec(m.remote.api, m.remote.baseUrl) : null
          const fam = entryFamily(m)
          const arch = m.info?.architecture ?? null
          const what = m.remote
            ? [fam, `${remotePreset?.label ?? m.remote.api} · ${m.remote.model}`].filter(Boolean).join(' · ')
            : [fam, arch && fam?.toLowerCase() !== arch.toLowerCase() ? arch : null, m.info ? MODEL_KINDS[m.info.kind].label : null].filter(Boolean).join(' · ')
          return {
            key: m.id,
            title: m.name,
            subtitle: `${m.favourite ? '★ ' : ''}${what}`,
            excerpt: m.remote ? `${remoteHostLabel(m.remote.api, m.remote.baseUrl)} · ${m.remote.hasKey ? 'Key saved' : 'No key set'}` : m.path,
            icon: m.remote ? <Cloud className="h-4 w-4 text-teal" /> : <Cpu className="h-4 w-4" />,
            tag: loaded ? 'LOADED' : loading ? (isImage && imageHost.status === 'generating' ? 'GENERATING' : 'LOADING') : m.remote ? (remotePreset?.label ?? m.remote.api).toUpperCase() : (m.info ? MODEL_KINDS[m.info.kind].label : 'MODEL').toUpperCase(),
            traits: m.remote ? [] : modelTraits(m.info, modelBytes(m)),
            aside: m.remote ? (m.remote.hasKey ? 'key ok' : 'no key') : formatBytes(modelBytes(m)),
            updatedAt: m.lastUsedAt
          }
        }),
    [filtered, host.modelId, host.status, imageHost.modelId, imageHost.status]
  )

  useEffect(() => {
    if (selected && list.length && !list.some((m) => m.id === selected)) setSelected(null)
  }, [list, selected])

  const current = selected ? (byId.get(selected) ?? null) : null

  const menu = (e: React.MouseEvent, m: ModelEntry) => {
    const isImage = m.info?.kind === 'image'
    const isLoaded = isImage
      ? imageHost.modelId === m.id && (imageHost.status === 'ready' || imageHost.status === 'generating')
      : host.modelId === m.id && host.status === 'ready'
    if (m.remote)
      return openMenu(e, m.name, [
        { label: m.favourite ? 'Remove from favourites' : 'Favourite', icon: <Star />, onSelect: () => actions.star(m) },
        { label: '', separator: true },
        { label: 'Remove', icon: <Trash2 />, danger: true, onSelect: () => actions.drop(m) }
      ])
    openMenu(e, m.name, [
      ...(isImage ? [{ label: 'Generate image…', icon: <Sparkles />, onSelect: () => void generateImage({ modelId: m.id }) }] : []),
      m.info?.kind === 'embedding'
        ? { label: 'Use for memory search', icon: <Search />, onSelect: () => actions.useForSearch(m) }
        : { label: isLoaded ? 'Unload' : 'Load', icon: <Power />, disabled: (isImage ? imageHost.status === 'loading' || imageHost.status === 'generating' : host.status === 'loading') || !isRunnable(m), onSelect: () => void actions.toggle(m) },
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
    { value: 'remote', label: `Remote ${counts.remote}` },
    ...(Object.keys(MODEL_KINDS) as ModelKind[]).filter((k) => MODEL_KINDS[k].always || counts[k]).map((k) => ({ value: k as Tab, label: `${MODEL_KINDS[k].plural} ${counts[k]}` }))
  ]

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader
        title="Models"
        subtitle="Local and remote models Seven can run on this machine."
        actions={
          <>
            <Button variant={folders ? 'secondary' : 'ghost'} icon={<Folders />} onClick={() => setFolders(!folders)}>
              Folders
            </Button>
            <Button variant={hub ? 'primary' : 'secondary'} icon={<Download />} onClick={() => setHub(hub ? null : 'search')}>
              Download
            </Button>
            <Button variant="ghost" icon={<Server />} onClick={() => openServerView(tab === 'image' || current?.info?.kind === 'image' ? 'sd-server' : 'llama-server')}>
              Servers
            </Button>
            <Button variant="ghost" icon={<Cloud />} onClick={() => setAddingRemote(true)}>
              Add remote model
            </Button>
            <Button variant="primary" icon={<FilePlus />} onClick={() => void addFile()}>
              Add file
            </Button>
          </>
        }
      />
      {folders && <ModelFolders className="shrink-0" />}
      {addingRemote && <AddRemoteModal onClose={() => setAddingRemote(false)} onAdded={open} />}
      {host.status === 'error' && host.error && <div className="border border-alert/50 border-l-2 border-l-alert bg-alert/5 px-3.5 py-2.5 font-mono text-[12px] text-alert">{host.error}</div>}
      {imageHost.status === 'error' && imageHost.error && <div className="border border-alert/50 border-l-2 border-l-alert bg-alert/5 px-3.5 py-2.5 font-mono text-[12px] text-alert">{imageHost.error}</div>}
      {tab === 'image' && sdInstall && !sdReady && (
        <div className="flex items-center gap-3 border border-line border-l-2 border-l-accent bg-accent/5 px-3.5 py-2.5 text-[12.5px] text-white">
          <span className="flex-1">Local diffusion models need <span className="font-mono text-accent">sd-server</span>. Install a release build or point Seven at your own <span className="font-mono">sd-server.exe</span>.</span>
          <Button size="sm" variant="primary" icon={<Server />} onClick={() => openHelperInstaller('sd-server')}>
            Install sd-server…
          </Button>
        </div>
      )}
      <DownloadsCard />
      {hub ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <BackBar onBack={() => setHub(hub === 'search' ? null : 'search')} kind={hub === 'search' ? 'Hugging Face' : hub.repo} />
          {hub === 'search' ? <HubSearch onOpen={(model) => setHub({ repo: model.id, model })} /> : <HubRepo repo={hub.repo} model={hub.model} />}
        </div>
      ) : current ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <BackBar onBack={() => setSelected(null)} kind="Models" />
          {current.remote ? (
            <RemoteModelDetail
              key={current.id}
              model={current}
              onRemove={() => actions.drop(current)}
              onToggleFavourite={() => actions.star(current)}
            />
          ) : (
            <ModelDetail key={current.id} model={current} />
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
        <FilterBar filters={filters} values={filterValues} onChange={setFilter}>
          {`${filtered.shown.length} of ${inTab.length} shown${filtered.pending.length ? ` · reading ${filtered.pending.length} headers` : ''}`}
        </FilterBar>
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
          adds={tab === 'remote' ? [{ label: 'Connect remote model', icon: <Cloud />, onClick: () => setAddingRemote(true) }] : undefined}
          empty={
            tab === 'remote'
              ? 'No remote models connected yet. Click "Add remote" to connect Google Gemini, OpenAI, Anthropic, OpenRouter, or a local server.'
              : list.length
                ? 'Nothing here for this tab and these filters.'
                : 'Add a model folder (Folders), or add a model file (.gguf, .safetensors, .ckpt).'
          }
        />
        </div>
      )}
    </div>
  )
}
