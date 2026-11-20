import { useEffect, useMemo, useRef, useState } from 'react'
import { Aperture, Copy, Download, FolderOpen, Image as ImageIcon, Pencil, Power, RefreshCw, Server, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { DEFAULT_IMAGE_CONFIG, type AssetMeta, type GeneratedImageResult, type ImageHistoryEntry, type ImageModelConfig } from '@shared/types'
import { resolveImageArchSpec, missingRecipeSlots } from '@shared/imageModels'
import { isImageModel } from '@shared/remoteModels'
import { AlertBox, BrowsePick, Button, EmptyState, Fact, FactGrid, Field, Fold, Input, LogBox, NumberField, SegmentBar, Segmented, SettingCard, StatusBadge, Textarea, ViewHeader, type BrowseOption } from '../components/ui'
import { AssetMedia } from '../components/pictures/AssetMedia'
import { PictureGrid } from '../components/pictures/PictureGrid'
import { ImageContextSnippets } from '../components/pictures/ImageContextSnippets'
import { ImageHistoryList } from '../components/pictures/ImageHistoryList'
import { ImageModelConfigPanel } from '../components/models/ImageModelConfigPanel'
import { SAMPLER_OPTIONS } from '../components/models/samplerOptions'
import { pickPicture } from '../components/data/PicturePicker'
import { useInstallHelper } from '../components/install/useInstallHelper'
import { openHelperInstaller, openServerView } from '../lib/openServer'
import { chatSwapNotice, describeImageProgress } from '../lib/imageHostProgress'
import { useActiveImageContext } from '../lib/imagePromptContext'
import { showInData } from '../lib/library'
import { engine, main } from '../lib/ipc'
import { errorText } from '../lib/format'
import { copyText, failed } from '../lib/notify'
import { useViewPlace } from '../lib/viewPlace'
import { useApp } from '../store/app'
import { useData } from '../store/data'
import { useImageHost } from '../store/image'
import { useModels } from '../store/models'
import { noteFailure } from '../store/problems'

const SIZE_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '512×512 (Low VRAM)', width: 512, height: 512 },
  { label: '768×768', width: 768, height: 768 },
  { label: '1024×1024', width: 1024, height: 1024 },
  { label: '1024×768', width: 1024, height: 768 },
  { label: '768×1024', width: 768, height: 1024 }
]

export function ImageView() {
  const models = useModels((s) => s.list)
  const chatHost = useModels((s) => s.host)
  const imageModels = useMemo(() => models.filter((m) => isImageModel(m)), [models])
  const assets = useData((s) => s.assets)
  const host = useImageHost((s) => s.host)
  const history = useImageHost((s) => s.history)
  const { generate, edit, cancel, unload, refreshHistory, removeHistory, clearHistory } = useImageHost()
  const activeContext = useActiveImageContext()
  const { state: sdInstall } = useInstallHelper('sd-server')
  const sdReady = Boolean(sdInstall?.active || String(sdInstall?.settings?.customExecutable ?? '').trim())
  const swapNotice = chatSwapNotice(sdInstall?.settings?.autoSwapChatModel)
  const keepLoaded = Boolean(sdInstall?.settings?.keepServerLoaded)
  const progressInfo = describeImageProgress(host, undefined)

  const [modelId, setModelId] = useViewPlace<string>('image.modelId', '')
  const [prompt, setPrompt] = useViewPlace<string>('image.prompt', '')
  const [negativePrompt, setNegativePrompt] = useViewPlace<string>('image.negativePrompt', '')
  const [width, setWidth] = useViewPlace<number>('image.width', DEFAULT_IMAGE_CONFIG.width)
  const [height, setHeight] = useViewPlace<number>('image.height', DEFAULT_IMAGE_CONFIG.height)
  const [steps, setSteps] = useViewPlace<number>('image.steps', DEFAULT_IMAGE_CONFIG.steps)
  const [cfgScale, setCfgScale] = useViewPlace<number>('image.cfgScale', DEFAULT_IMAGE_CONFIG.cfgScale)
  const [sampler, setSampler] = useViewPlace<string>('image.sampler', DEFAULT_IMAGE_CONFIG.sampler)
  const [seedText, setSeedText] = useState('')
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null)
  const [modelConfig, setModelConfig] = useState<ImageModelConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<GeneratedImageResult | null>(null)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [historyView, setHistoryView] = useState<'prompts' | 'grid'>('prompts')

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    if ((!modelId || !imageModels.some((m) => m.id === modelId)) && imageModels[0]) {
      setModelId(imageModels[0].id)
    }
  }, [imageModels, modelId])

  const selectedEntry = useMemo(() => imageModels.find((m) => m.id === modelId) ?? null, [imageModels, modelId])
  const prevModelRef = useRef<string | null>(null)

  useEffect(() => {
    if (!selectedEntry || selectedEntry.remote) {
      setModelConfig(null)
      prevModelRef.current = selectedEntry?.id ?? null
      return
    }
    const switchedModel = prevModelRef.current !== null && prevModelRef.current !== selectedEntry.id
    prevModelRef.current = selectedEntry.id
    let live = true
    void engine('models.imageConfig.get', { id: selectedEntry.id })
      .then((cfg) => {
        if (!live) return
        setModelConfig(cfg)
        if (switchedModel) {
          setWidth(cfg.width)
          setHeight(cfg.height)
          setSteps(cfg.steps)
          setCfgScale(cfg.cfgScale)
          setSampler(cfg.sampler)
        }
      })
      .catch(noteFailure('models', 'Could not load image defaults'))
    return () => {
      live = false
    }
  }, [selectedEntry?.id, selectedEntry?.remote])

  const missingCompanions = useMemo(() => {
    if (!selectedEntry || selectedEntry.remote || !modelConfig || modelConfig.mode === 'model') return []
    const spec = resolveImageArchSpec(selectedEntry.info?.architecture, selectedEntry.name)
    if (!spec) return []
    return missingRecipeSlots(spec, modelConfig).map((slot) => slot.label)
  }, [selectedEntry, modelConfig])

  const modelOptions = useMemo<BrowseOption[]>(
    () =>
      imageModels.map((m) => ({
        value: m.id,
        label: m.name,
        group: m.remote ? 'Remote image API' : 'Local diffusion (sd-server)',
        note: m.remote ? m.remote.model : [m.info?.architecture, m.quant].filter(Boolean).join(' · ') || m.path
      })),
    [imageModels]
  )

  const generatedHistory = useMemo<AssetMeta[]>(() => {
    const byId = new Map(assets.map((a) => [a.id, a]))
    const seen = new Set<string>()
    const out: AssetMeta[] = []
    for (const h of history) {
      if (seen.has(h.assetId)) continue
      const asset = byId.get(h.assetId)
      if (!asset) continue
      seen.add(h.assetId)
      out.push(asset)
    }
    return out
  }, [assets, history])

  const handleClearHistory = async () => {
    await clearHistory()
    setLastResult(null)
    setSelectedAssetId(null)
  }

  const previewId = selectedAssetId ?? lastResult?.asset.id ?? generatedHistory[0]?.id ?? null
  const previewAsset = useMemo(() => (previewId ? assets.find((a) => a.id === previewId) ?? null : null), [assets, previewId])

  const runGenerate = async () => {
    if (!prompt.trim() || !selectedEntry || busy) return
    setBusy(true)
    setError(null)
    const parsedSeed = seedText.trim() !== '' && Number.isFinite(Number(seedText)) ? Math.trunc(Number(seedText)) : undefined
    try {
      const common = {
        modelId: selectedEntry.id,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        width,
        height,
        steps,
        cfgScale,
        sampler,
        seed: parsedSeed,
        contextTitle: activeContext?.title
      }
      const res = sourceAssetId ? await edit({ ...common, sourceAssetId }) : await generate(common)
      setLastResult(res)
      setSelectedAssetId(res.asset.id)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const loadFromHistory = (entry: ImageHistoryEntry) => {
    if (entry.modelId && imageModels.some((m) => m.id === entry.modelId)) setModelId(entry.modelId)
    setPrompt(entry.prompt)
    setNegativePrompt(entry.negativePrompt ?? '')
    setWidth(entry.width)
    setHeight(entry.height)
    setSteps(entry.steps)
    setCfgScale(entry.cfgScale)
    if (entry.sampler) setSampler(entry.sampler)
    setSeedText(entry.seed !== null ? String(entry.seed) : '')
    setSourceAssetId(entry.sourceAssetId ?? null)
    if (assets.some((a) => a.id === entry.assetId)) setSelectedAssetId(entry.assetId)
  }

  const pickSource = async () => {
    const picked = await pickPicture(sourceAssetId, { what: 'a reference image to edit', context: activeContext })
    if (picked) setSourceAssetId(picked.id)
  }

  const serverTone = host.status === 'error' ? 'error' : host.status === 'loading' || host.status === 'generating' ? 'busy' : host.status === 'ready' ? 'ok' : 'idle'

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader
        title="Image"
        subtitle="Generate and edit pictures directly using sd-server or remote image models — no chat model required."
        actions={
          <>
            <StatusBadge tone={serverTone}>
              {host.status === 'ready' ? `sd-server: ${host.residency === 'resident' ? 'resident' : 'ready'}` : `sd-server: ${host.status}`}
            </StatusBadge>
            <Button size="sm" variant={sdReady ? 'ghost' : 'primary'} icon={<Server />} onClick={() => (sdReady ? openServerView('sd-server') : openHelperInstaller('sd-server'))}>
              {sdReady ? (keepLoaded ? 'sd-server (keep loaded)' : 'sd-server') : 'Install sd-server…'}
            </Button>
            {(host.status === 'ready' || host.status === 'error' || Boolean(host.pid)) && (
              <Button size="sm" variant="ghost" icon={<Power />} onClick={() => void unload().catch(failed('Could not stop sd-server'))}>
                Stop server
              </Button>
            )}
          </>
        }
      />

      {sdInstall && !sdReady && (
        <div className="flex items-center gap-3 border border-line border-l-2 border-l-accent bg-accent/5 px-3.5 py-2.5 text-[12.5px] text-white">
          <span className="flex-1">
            To run local image models, install <span className="font-mono text-accent">sd-server</span> or set your own <span className="font-mono">sd-server.exe</span> path.
          </span>
          <Button size="sm" variant="primary" icon={<Server />} onClick={() => openHelperInstaller('sd-server')}>
            Open helper installers…
          </Button>
        </div>
      )}

      {imageModels.length === 0 ? (
        <EmptyState title="No image models configured yet">
          <div className="flex flex-col items-center gap-3">
            <span>Add a diffusion checkpoint (.safetensors, .ckpt, or .gguf) to a model folder, download one from Hugging Face, or add a remote image model.</span>
            <Button variant="primary" icon={<Download />} onClick={() => useApp.getState().setView('models')}>
              Open Models
            </Button>
          </div>
        </EmptyState>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]">
          {/* Left column: model, prompt, config & Generate */}
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            <SettingCard title="Model & Pipeline">
              <div className="flex flex-col gap-2.5 p-3.5">
                <Field label="Image model">
                  <BrowsePick
                    value={selectedEntry?.id ?? null}
                    options={modelOptions}
                    placeholder="Choose an image model"
                    clearable={false}
                    onChange={(v) => v && setModelId(v)}
                    className="w-full"
                  />
                </Field>
                {selectedEntry && !selectedEntry.remote && sdReady && chatHost.modelId && swapNotice && (
                  <div className="border border-line/40 bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-dim">
                    {swapNotice}
                  </div>
                )}
                {selectedEntry && !selectedEntry.remote && missingCompanions.length > 0 && (
                  <div className="flex items-center gap-2 border border-warn/40 bg-warn/5 px-2.5 py-2 text-[11.5px] text-warn">
                    <span className="flex-1">{`Missing companions: ${missingCompanions.join(', ')}`}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<SlidersHorizontal />}
                      onClick={() =>
                        void engine('models.imageConfig.autoMatch', { id: selectedEntry.id })
                          .then(setModelConfig)
                          .catch(failed('Could not auto-match companions'))
                      }
                    >
                      Auto-match
                    </Button>
                  </div>
                )}
                {selectedEntry && !selectedEntry.remote && (
                  <Fold label="Companions & low-VRAM flags">
                    <div className="pt-2">
                      <ImageModelConfigPanel model={selectedEntry} showStatus={false} />
                    </div>
                  </Fold>
                )}
              </div>
            </SettingCard>

            <SettingCard title={sourceAssetId ? 'Prompt & Image Edit' : 'Prompt'}>
              <div className="flex flex-col gap-3 p-3.5">
                <ImageContextSnippets context={activeContext} prompt={prompt} onPromptChange={setPrompt} />
                <Field
                  label="Prompt"
                  hint="Supports @kind:name links (e.g. @page:style, @sheet:name#Appearance) — hydrated before generating."
                >
                  <div className="flex flex-col gap-1.5">
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
                      placeholder="Describe the image, or reference @page:style @sheet:name#Appearance…"
                    />
                    {prompt.trim() && (
                      <div className="flex justify-end">
                        <Button size="sm" variant="ghost" icon={<X />} onClick={() => setPrompt('')}>
                          Clear prompt
                        </Button>
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Negative prompt (sd-server / local)">
                  <Textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    rows={2}
                    placeholder="Elements to avoid…"
                  />
                </Field>
                <Field label="Reference image (optional edit / img2img)">
                  <div className="flex items-center gap-2">
                    {sourceAssetId && (
                      <div className="h-10 w-10 shrink-0 overflow-hidden border border-line bg-bg">
                        <AssetMedia id={sourceAssetId} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <Button size="sm" variant="ghost" icon={<ImageIcon />} onClick={() => void pickSource()}>
                      {sourceAssetId ? 'Change source…' : 'Pick source…'}
                    </Button>
                    {sourceAssetId && (
                      <Button size="sm" variant="ghost" icon={<X />} onClick={() => setSourceAssetId(null)}>
                        Clear
                      </Button>
                    )}
                  </div>
                </Field>
              </div>
            </SettingCard>

            <SettingCard
              title="Settings"
              actions={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setWidth(512)
                    setHeight(512)
                    setSteps(20)
                  }}
                >
                  Low-VRAM 512×512
                </Button>
              }
            >
              <div className="flex flex-col gap-3 p-3.5">
                <div className="flex flex-wrap gap-1">
                  {SIZE_PRESETS.map((p) => (
                    <Button key={p.label} size="sm" variant={width === p.width && height === p.height ? 'badge' : 'ghost'} onClick={() => (setWidth(p.width), setHeight(p.height))}>
                      {p.label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Width">
                    <NumberField value={width} min={64} max={4096} step={64} onChange={(v) => v !== undefined && setWidth(v)} />
                  </Field>
                  <Field label="Height">
                    <NumberField value={height} min={64} max={4096} step={64} onChange={(v) => v !== undefined && setHeight(v)} />
                  </Field>
                  <Field label="Steps">
                    <NumberField value={steps} min={1} max={150} step={1} onChange={(v) => v !== undefined && setSteps(v)} />
                  </Field>
                  <Field label="CFG scale">
                    <NumberField value={cfgScale} min={0} max={30} step={0.5} onChange={(v) => v !== undefined && setCfgScale(v)} />
                  </Field>
                </div>
                <Field label="Sampler">
                  <BrowsePick
                    value={sampler}
                    options={SAMPLER_OPTIONS}
                    placeholder="Pick a sampler"
                    allowCustom
                    clearable={false}
                    onChange={(v) => v && setSampler(v)}
                    className="w-full"
                  />
                </Field>
                <Field label="Seed (blank = random)">
                  <div className="flex items-center gap-1.5">
                    <Input value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="Random" className="font-mono" />
                    {lastResult?.seed !== null && lastResult?.seed !== undefined && (
                      <Button size="sm" variant="ghost" icon={<RefreshCw />} title="Use last generated seed" onClick={() => setSeedText(String(lastResult.seed))}>
                        Last
                      </Button>
                    )}
                    {seedText && (
                      <Button size="sm" variant="ghost" icon={<X />} title="Clear seed" onClick={() => setSeedText('')} />
                    )}
                  </div>
                </Field>
              </div>
            </SettingCard>

            <div className="flex items-center gap-2 pt-0.5">
              <Button
                variant="primary"
                size="lg"
                icon={<Aperture />}
                disabled={busy || !prompt.trim() || !selectedEntry || (!selectedEntry.remote && !sdReady)}
                onClick={() => void runGenerate()}
                className="flex-1 justify-center"
              >
                {busy ? (host.status === 'loading' ? 'Starting sd-server…' : 'Generating image…') : sourceAssetId ? 'Edit Image' : 'Generate Image'}
              </Button>
              {busy && (
                <Button variant="ghost" size="lg" icon={<X />} onClick={() => void cancel()}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Right column: live canvas, recent history & server log */}
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            {(error || host.error) && <AlertBox>{error ?? host.error}</AlertBox>}

            {busy && (
              <div className="flex items-center gap-3 border border-line bg-black/50 px-3.5 py-2.5 text-[12px] text-dim">
                <StatusBadge tone="busy">{host.progress?.stage || host.status}</StatusBadge>
                <span className="truncate font-mono">{progressInfo.text}</span>
                <SegmentBar value={progressInfo.ratio} className="ml-auto w-32 shrink-0" />
              </div>
            )}

            <SettingCard
              title={previewAsset ? previewAsset.name : 'Output'}
              actions={
                previewAsset && (
                  <>
                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setSourceAssetId(previewAsset.id)}>
                      Edit / img2img
                    </Button>
                    <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => showInData({ kind: 'asset', id: previewAsset.id })}>
                      Open in Files
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Download />}
                      onClick={() => void main('asset.saveAs', { id: previewAsset.id, name: previewAsset.name }).catch(failed('Could not save image'))}
                    >
                      Save as…
                    </Button>
                  </>
                )
              }
            >
              {previewAsset ? (
                <div className="flex flex-col gap-3 p-3.5">
                  <div className="flex max-h-[55vh] min-h-[16rem] items-center justify-center overflow-hidden border border-line/40 bg-black/50">
                    <AssetMedia id={previewAsset.id} className="max-h-[54vh] w-auto object-contain" />
                  </div>
                  {lastResult && lastResult.asset.id === previewAsset.id && (
                    <FactGrid>
                      <Fact label="Dimensions">{`${lastResult.width}×${lastResult.height}`}</Fact>
                      <Fact label="Seed">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{lastResult.seed ?? '—'}</span>
                          {lastResult.seed !== null && (
                            <button type="button" title="Copy seed" onClick={() => void copyText(String(lastResult.seed))} className="text-faint hover:text-white">
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      </Fact>
                      <Fact label="Time">{`${(lastResult.durationMs / 1000).toFixed(1)}s`}</Fact>
                    </FactGrid>
                  )}
                  {previewAsset.source?.original && (
                    <div className="border-t border-line/30 pt-2 font-mono text-[11.5px] text-dim">{previewAsset.source.original}</div>
                  )}
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center p-6 text-center text-[13px] text-faint">
                  Enter a prompt on the left and press <span className="mx-1 font-mono text-white">Generate Image</span>. Generated pictures save automatically to Files.
                </div>
              )}
            </SettingCard>

            {(history.length > 0 || generatedHistory.length > 0) && (
              <SettingCard
                title="Prompt & Image History"
                count={historyView === 'prompts' ? history.length : generatedHistory.length}
                actions={
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void handleClearHistory()}>
                      Clear
                    </Button>
                    <Segmented
                      value={historyView}
                      options={[
                        { value: 'prompts', label: 'Prompts' },
                        { value: 'grid', label: 'Grid' }
                      ]}
                      onChange={(v) => setHistoryView(v as 'prompts' | 'grid')}
                    />
                  </div>
                }
              >
                <div className="p-3">
                  {historyView === 'prompts' ? (
                    <ImageHistoryList
                      entries={history}
                      selectedAssetId={previewId}
                      onLoad={loadFromHistory}
                      onEditAsset={(id) => {
                        setSelectedAssetId(id)
                        setSourceAssetId(id)
                      }}
                      onUseAsset={(id) => setSelectedAssetId(id)}
                      onRemove={(id) => void removeHistory(id)}
                      onClear={() => void handleClearHistory()}
                    />
                  ) : (
                    <PictureGrid
                      ids={generatedHistory.slice(0, 24).map((a) => a.id)}
                      isOn={(id) => id === previewId}
                      onPick={(id) => {
                        setSelectedAssetId(id)
                        const meta = assets.find((a) => a.id === id)
                        if (meta?.source?.original && !prompt.trim()) setPrompt(meta.source.original)
                      }}
                    />
                  )}
                </div>
              </SettingCard>
            )}

            <Fold label="sd-server log" count={host.log.length}>
              <div className="px-3.5 pb-3">
                <LogBox lines={host.log} empty="sd-server output appears here once a generation starts." />
              </div>
            </Fold>
          </div>
        </div>
      )}
    </div>
  )
}
