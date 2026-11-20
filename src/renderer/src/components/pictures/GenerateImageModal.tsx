import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import { Aperture, Image as ImageIcon, Server, X } from 'lucide-react'
import { DEFAULT_IMAGE_CONFIG, type AssetMeta, type GeneratedImageResult, type ImageHistoryEntry, type ImagePromptContext } from '@shared/types'
import { isImageModel } from '@shared/remoteModels'
import { AlertBox, BrowsePick, Button, EmptyState, Fact, FactGrid, Field, Fold, Input, Modal, NumberField, Segmented, StatusBadge, Textarea, type BrowseOption } from '../ui'
import { AssetMedia } from './AssetMedia'
import { ImageContextSnippets } from './ImageContextSnippets'
import { ImageHistoryList } from './ImageHistoryList'
import { SAMPLER_OPTIONS } from '../models/samplerOptions'
import { pickPicture } from '../data/PicturePicker'
import { useData } from '../../store/data'
import { useModels } from '../../store/models'
import { useImageHost } from '../../store/image'
import { useInstallHelper } from '../install/useInstallHelper'
import { openHelperInstaller } from '../../lib/openServer'
import { mergeImageContexts, useActiveImageContext } from '../../lib/imagePromptContext'
import { chatSwapNotice, describeImageProgress } from '../../lib/imageHostProgress'
import { engine } from '../../lib/ipc'
import { useViewPlace } from '../../lib/viewPlace'
import { errorText } from '../../lib/format'
import { noteFailure } from '../../store/problems'

export interface GenerateImageOptions {
  modelId?: string
  sourceAssetId?: string
  prompt?: string
  title?: string
  context?: ImagePromptContext | null
}

interface GenerateRequest {
  options: GenerateImageOptions
  done: (asset: AssetMeta | null) => void
}

const useGenModal = create<{ request: GenerateRequest | null }>(() => ({ request: null }))

/** Open the reusable image generation modal anywhere in Seven and resolve with the generated AssetMeta (or null). */
export function generateImage(options: GenerateImageOptions = {}): Promise<AssetMeta | null> {
  return new Promise((resolve) => useGenModal.setState({ request: { options, done: resolve } }))
}

const SIZE_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '512×512', width: 512, height: 512 },
  { label: '768×768', width: 768, height: 768 },
  { label: '1024×1024', width: 1024, height: 1024 },
  { label: '1024×768', width: 1024, height: 768 },
  { label: '768×1024', width: 768, height: 1024 }
]

function GenerateImageModal({ request }: { request: GenerateRequest }) {
  const models = useModels((s) => s.list)
  const assets = useData((s) => s.assets)
  const chatHost = useModels((s) => s.host)
  const imageModels = useMemo(() => models.filter((m) => isImageModel(m)), [models])
  const host = useImageHost((s) => s.host)
  const history = useImageHost((s) => s.history)
  const { generate, edit, cancel, refreshHistory, removeHistory, clearHistory } = useImageHost()
  const { state: sdInstall } = useInstallHelper('sd-server')
  const sdReady = Boolean(sdInstall?.active || String(sdInstall?.settings?.customExecutable ?? '').trim())
  const swapNotice = chatSwapNotice(sdInstall?.settings?.autoSwapChatModel)
  const progressInfo = describeImageProgress(host, undefined)

  const activeContext = useActiveImageContext()
  const context = useMemo(() => mergeImageContexts(request.options.context, activeContext), [request.options.context, activeContext])

  const defaultModelId = request.options.modelId ?? (host.modelId && imageModels.some((m) => m.id === host.modelId) ? host.modelId : imageModels[0]?.id ?? '')
  const [tab, setTab] = useState<'create' | 'history'>('create')
  const [modelId, setModelId] = useState(defaultModelId)
  const [prompt, setPrompt] = useState(request.options.prompt ?? '')
  const [negativePrompt, setNegativePrompt] = useViewPlace<string>('image.negativePrompt', '')
  const [width, setWidth] = useViewPlace<number>('image.width', DEFAULT_IMAGE_CONFIG.width)
  const [height, setHeight] = useViewPlace<number>('image.height', DEFAULT_IMAGE_CONFIG.height)
  const [steps, setSteps] = useViewPlace<number>('image.steps', DEFAULT_IMAGE_CONFIG.steps)
  const [cfgScale, setCfgScale] = useViewPlace<number>('image.cfgScale', DEFAULT_IMAGE_CONFIG.cfgScale)
  const [sampler, setSampler] = useViewPlace<string>('image.sampler', DEFAULT_IMAGE_CONFIG.sampler)
  const [seedText, setSeedText] = useState('')
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(request.options.sourceAssetId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratedImageResult | null>(null)

  const selectedEntry = useMemo(() => imageModels.find((m) => m.id === modelId) ?? null, [imageModels, modelId])
  const prevModelRef = useRef<string | null>(null)
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

  useEffect(() => {
    void refreshHistory().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!modelId && imageModels[0]) setModelId(imageModels[0].id)
  }, [imageModels, modelId])

  useEffect(() => {
    if (!selectedEntry || selectedEntry.remote) {
      prevModelRef.current = selectedEntry?.id ?? null
      return
    }
    const switchedModel = prevModelRef.current !== null && prevModelRef.current !== selectedEntry.id
    prevModelRef.current = selectedEntry.id
    if (!switchedModel) return
    let live = true
    void engine('models.imageConfig.get', { id: selectedEntry.id })
      .then((cfg) => {
        if (!live) return
        setWidth(cfg.width)
        setHeight(cfg.height)
        setSteps(cfg.steps)
        setCfgScale(cfg.cfgScale)
        setSampler(cfg.sampler)
      })
      .catch(noteFailure('models', 'Could not load image defaults'))
    return () => {
      live = false
    }
  }, [selectedEntry?.id, selectedEntry?.remote])

  const close = (asset: AssetMeta | null) => {
    if (busy) void cancel()
    useGenModal.setState({ request: null })
    request.done(asset)
  }

  const run = async () => {
    if (!prompt.trim() || !modelId) return
    setBusy(true)
    setError(null)
    const parsedSeed = seedText.trim() !== '' && Number.isFinite(Number(seedText)) ? Math.trunc(Number(seedText)) : undefined
    try {
      const common = {
        modelId,
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        width,
        height,
        steps,
        cfgScale,
        sampler,
        seed: parsedSeed,
        contextTitle: context?.title
      }
      const res = sourceAssetId ? await edit({ ...common, sourceAssetId }) : await generate(common)
      setResult(res)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const loadFromHistory = (entry: ImageHistoryEntry) => {
    if (imageModels.some((m) => m.id === entry.modelId)) setModelId(entry.modelId)
    setPrompt(entry.prompt)
    setNegativePrompt(entry.negativePrompt ?? '')
    setWidth(entry.width)
    setHeight(entry.height)
    setSteps(entry.steps)
    setCfgScale(entry.cfgScale)
    if (entry.sampler) setSampler(entry.sampler)
    setSeedText(entry.seed !== null ? String(entry.seed) : '')
    setSourceAssetId(entry.sourceAssetId ?? null)
    setTab('create')
  }

  const pickSource = async () => {
    const picked = await pickPicture(sourceAssetId, { what: 'a reference image to edit', context })
    if (picked) setSourceAssetId(picked.id)
  }

  return (
    <Modal
      open
      wide
      title={request.options.title ?? (sourceAssetId ? 'Generate / Edit Image' : 'Generate Image')}
      onClose={() => close(null)}
      footer={
        <>
          {busy && (
            <Button variant="ghost" onClick={() => void cancel()}>
              Stop generation
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => close(null)}>
            Cancel
          </Button>
          {result && (
            <Button variant="primary" onClick={() => close(result.asset)}>
              Use image
            </Button>
          )}
          <Button variant={result ? 'secondary' : 'primary'} icon={<Aperture />} disabled={busy || !prompt.trim() || !modelId} onClick={() => void run()}>
            {busy ? (host.status === 'loading' ? 'Loading model…' : 'Generating…') : result ? 'Generate again' : 'Generate'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Segmented
            value={tab}
            options={[
              { value: 'create', label: 'Create' },
              { value: 'history', label: `Prompt history (${history.length})` }
            ]}
            onChange={(v) => setTab(v as 'create' | 'history')}
          />
          {context && <span className="truncate font-mono text-[11px] text-accent-soft">{context.title}</span>}
        </div>

        {tab === 'history' ? (
          <ImageHistoryList
            entries={history}
            selectedAssetId={result?.asset.id}
            onLoad={loadFromHistory}
            onEditAsset={(assetId) => {
              setSourceAssetId(assetId)
              setTab('create')
            }}
            onUseAsset={(assetId) => {
              const found = assets.find((a) => a.id === assetId)
              if (found) close(found)
            }}
            onRemove={(id) => void removeHistory(id)}
            onClear={() => void clearHistory()}
          />
        ) : imageModels.length === 0 ? (
          <EmptyState title="No image models available yet">Add a diffusion checkpoint (.safetensors / .ckpt / .gguf) or connect a remote image model (OpenAI / Gemini) in Models first.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {error && <AlertBox>{error}</AlertBox>}
            {selectedEntry && !selectedEntry.remote && sdInstall && !sdReady && (
              <div className="flex items-center gap-3 border border-line border-l-2 border-l-accent bg-accent/5 px-3 py-2 text-[12px] text-white">
                <span className="flex-1"><span className="font-mono text-accent">sd-server</span> is needed to run <span className="font-mono">{selectedEntry.name}</span>.</span>
                <Button size="sm" variant="primary" icon={<Server />} onClick={() => { close(null); openHelperInstaller('sd-server') }}>
                  Install sd-server…
                </Button>
              </div>
            )}
            {selectedEntry && !selectedEntry.remote && sdReady && chatHost.modelId && swapNotice && (
              <div className="border border-line/50 bg-bg px-3 py-1.5 font-mono text-[11.5px] text-dim">
                {swapNotice}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Image model">
                <BrowsePick
                  value={modelId || null}
                  options={modelOptions}
                  placeholder="Choose an image model"
                  clearable={false}
                  onChange={(v) => v && setModelId(v)}
                  className="w-full"
                />
              </Field>
              <Field label="Reference image (optional edit / img2img)">
                <div className="flex items-center gap-2">
                  {sourceAssetId && (
                    <div className="h-9 w-9 shrink-0 overflow-hidden border border-line bg-bg">
                      <AssetMedia id={sourceAssetId} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <Button size="sm" variant="ghost" icon={<ImageIcon />} onClick={() => void pickSource()}>
                    {sourceAssetId ? 'Change source…' : 'Pick source image…'}
                  </Button>
                  {sourceAssetId && (
                    <Button size="sm" variant="ghost" icon={<X />} onClick={() => setSourceAssetId(null)}>
                      Clear
                    </Button>
                  )}
                </div>
              </Field>
            </div>

            <ImageContextSnippets context={context} prompt={prompt} onPromptChange={setPrompt} />

            <Field
              label="Prompt"
              hint="Supports @kind:name links (e.g. @page:style, @sheet:name#Appearance) — hydrated before generating."
            >
              <div className="flex flex-col gap-1.5">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
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

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11.5px] text-dim">Size</span>
              {SIZE_PRESETS.map((p) => (
                <Button key={p.label} size="sm" variant={width === p.width && height === p.height ? 'badge' : 'ghost'} onClick={() => (setWidth(p.width), setHeight(p.height))}>
                  {p.label}
                </Button>
              ))}
            </div>

            <Fold label="Advanced options">
              <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field label="Negative prompt (sd-server / local)">
                    <Textarea value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} rows={2} placeholder="Elements to avoid…" />
                  </Field>
                </div>
                <Field label="Width">
                  <NumberField value={width} min={64} max={4096} step={64} onChange={(v) => v !== undefined && setWidth(v)} />
                </Field>
                <Field label="Height">
                  <NumberField value={height} min={64} max={4096} step={64} onChange={(v) => v !== undefined && setHeight(v)} />
                </Field>
                <Field label="Steps">
                  <NumberField value={steps} min={1} max={150} step={1} onChange={(v) => v !== undefined && setSteps(v)} />
                </Field>
                <Field label="CFG Scale">
                  <NumberField value={cfgScale} min={0} max={30} step={0.5} onChange={(v) => v !== undefined && setCfgScale(v)} />
                </Field>
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
                  <Input value={seedText} onChange={(e) => setSeedText(e.target.value)} placeholder="Random" className="font-mono" />
                </Field>
              </div>
            </Fold>

            {busy && (
              <div className="flex items-center justify-between border border-line bg-bg px-3 py-2 text-[12px] text-dim">
                <span className="font-mono">{progressInfo.text}</span>
                <StatusBadge tone="busy">{host.progress?.stage || host.status}</StatusBadge>
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-2 border border-line bg-bg p-3">
                <div className="flex max-h-80 items-center justify-center overflow-hidden bg-black/30">
                  <AssetMedia id={result.asset.id} className="max-h-80 w-auto object-contain" />
                </div>
                <FactGrid>
                  <Fact label="Dimensions">{`${result.width}×${result.height}`}</Fact>
                  <Fact label="Seed">{result.seed ?? '—'}</Fact>
                  <Fact label="Time">{`${(result.durationMs / 1000).toFixed(1)}s`}</Fact>
                </FactGrid>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function GenerateImageHost() {
  const request = useGenModal((s) => s.request)
  return request ? <GenerateImageModal request={request} /> : null
}
