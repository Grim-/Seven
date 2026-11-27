import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  AlertTriangle,
  Aperture,
  ArrowLeftRight,
  Ban,
  Copy,
  Dices,
  Download,
  FolderOpen,
  History,
  Image as ImageIcon,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Power,
  RefreshCw,
  Server,
  SlidersHorizontal,
  Star,
  Trash2,
  X
} from 'lucide-react'
import {
  DEFAULT_IMAGE_CONFIG,
  type AssetMeta,
  type ImageCompanions,
  type ImageHistoryEntry,
  type ImageModelConfig
} from '@shared/types'
import { resolveImageArchSpec, missingRecipeSlots } from '@shared/imageModels'
import { isImageModel } from '@shared/remoteModels'
import {
  AlertBox,
  BrowsePick,
  Button,
  EmptyState,
  Fact,
  FactGrid,
  Fold,
  Input,
  LogBox,
  Modal,
  NumberField,
  SegmentBar,
  Segmented,
  Slider,
  StatusBadge,
  Textarea,
  ViewHeader,
  openMenu,
  type BrowseOption
} from '../components/ui'
import { AssetMedia } from '../components/pictures/AssetMedia'
import { FileEditor } from '../components/pictures/FileEditor'
import { PictureGrid } from '../components/pictures/PictureGrid'
import { ImageContextSnippets } from '../components/pictures/ImageContextSnippets'
import { ImageHistoryList } from '../components/pictures/ImageHistoryList'
import { SAMPLER_OPTIONS } from '../components/models/samplerOptions'
import { pickPicture } from '../components/data/PicturePicker'
import { useInstallHelper } from '../components/install/useInstallHelper'
import { openHelperInstaller, openServerView } from '../lib/openServer'
import { chatSwapNotice, describeImageProgress } from '../lib/imageHostProgress'
import { useActiveImageContext } from '../lib/imagePromptContext'
import { showInData } from '../lib/library'
import { engine, main } from '../lib/ipc'
import { cn } from '../lib/cn'
import { copyText, failed } from '../lib/notify'
import { useViewPlace } from '../lib/viewPlace'
import { useApp } from '../store/app'
import { useData } from '../store/data'
import { useImageHost } from '../store/image'
import { useModels } from '../store/models'
import { noteFailure } from '../store/problems'
import { toast } from '../store/toasts'
import { LinkTextarea } from '../components/data/LinkTextarea'

type ResolutionTier = 512 | 768 | 1024

interface AspectRatioPreset {
  id: string
  label: string
  ratioW: number
  ratioH: number
  /** Visual icon preview proportions (px) */
  boxW: number
  boxH: number
}

const ASPECT_RATIOS: AspectRatioPreset[] = [
  { id: '1:1', label: '1:1', ratioW: 1, ratioH: 1, boxW: 14, boxH: 14 },
  { id: '4:3', label: '4:3', ratioW: 4, ratioH: 3, boxW: 16, boxH: 12 },
  { id: '3:4', label: '3:4', ratioW: 3, ratioH: 4, boxW: 12, boxH: 16 },
  { id: '16:9', label: '16:9', ratioW: 16, ratioH: 9, boxW: 18, boxH: 10 },
  { id: '9:16', label: '9:16', ratioW: 9, ratioH: 16, boxW: 10, boxH: 18 }
]

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: '512', label: '512' },
  { value: '768', label: '768' },
  { value: '1024', label: '1024' }
]

function round64(n: number): number {
  return Math.max(64, Math.min(4096, Math.round(n / 64) * 64))
}

function dimsForAspect(preset: AspectRatioPreset, tier: ResolutionTier): { w: number; h: number } {
  const area = tier * tier
  const scale = Math.sqrt(area / (preset.ratioW * preset.ratioH))
  return {
    w: round64(preset.ratioW * scale),
    h: round64(preset.ratioH * scale)
  }
}

function inferTier(w: number, h: number): ResolutionTier {
  const avg = Math.sqrt(w * h)
  if (avg <= 640) return 512
  if (avg <= 896) return 768
  return 1024
}

export function ImageView() {
  const models = useModels((s) => s.list)
  const chatHost = useModels((s) => s.host)
  const imageModels = useMemo(() => models.filter((m) => isImageModel(m)), [models])
  const assets = useData((s) => s.assets)
  const host = useImageHost((s) => s.host)
  const history = useImageHost((s) => s.history)
  const defaultModelId = useImageHost((s) => s.defaultModelId)
  const storeGenerating = useImageHost((s) => s.generating)
  const error = useImageHost((s) => s.error)
  const lastResult = useImageHost((s) => s.lastResult)
  const selectedAssetId = useImageHost((s) => s.selectedAssetId)
  const activeLoras = useImageHost((s) => s.activeLoras)
  const {
    generate,
    edit,
    cancel,
    unload,
    refresh,
    refreshHistory,
    removeHistory,
    clearHistory,
    setDefaultModel,
    setSelectedAssetId,
    addLora,
    setLoraWeight,
    removeLora,
    clearLoras,
    openSetup
  } = useImageHost()

  const activeContext = useActiveImageContext()
  const { state: sdInstall } = useInstallHelper('sd-server')
  const sdReady = Boolean(sdInstall?.active || String(sdInstall?.settings?.customExecutable ?? '').trim())
  const swapNotice = chatSwapNotice(sdInstall?.settings?.autoSwapChatModel)
  const keepLoaded = Boolean(sdInstall?.settings?.keepServerLoaded)
  const progressInfo = describeImageProgress(host, undefined)

  // Persistent busy derivation — survives view switching!
  const busy = storeGenerating || host.status === 'loading' || host.status === 'generating' || host.busyCount > 0
  const livePreviewUrl = busy ? (host.progress?.previewDataUrl ?? null) : null

  const [dockOpen, setDockOpen] = useViewPlace<boolean>('image.dockOpen', true)
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
  const [companions, setCompanions] = useState<ImageCompanions>({ vaes: [], textEncoders: [], projectors: [], loras: [] })
  const [historyView, setHistoryView] = useViewPlace<'prompts' | 'grid'>('image.historyView', 'prompts')
  const [historyOpen, setHistoryOpen] = useState(false)

  // Progressive disclosure toggles inside the compact studio dock
  const [showNegative, setShowNegative] = useState(() => Boolean(negativePrompt.trim()))
  const [showLoras, setShowLoras] = useState(() => activeLoras.length > 0)
  const [showCustomSize, setShowCustomSize] = useState(false)

  // Sync live sd-server state, default model, history, and LoRAs whenever ImageView mounts
  useEffect(() => {
    void refresh().catch(noteFailure('image', 'Could not refresh sd-server status'))
    void refreshHistory().catch(noteFailure('image', 'Could not load image history'))
    void engine('models.imageCompanions')
      .then(setCompanions)
      .catch(noteFailure('models', 'Could not load LoRAs and companions'))
  }, [refresh, refreshHistory, models.length])

  useEffect(() => {
    if (!modelId || !imageModels.some((m) => m.id === modelId)) {
      const preferred =
        (defaultModelId && imageModels.find((m) => m.id === defaultModelId)?.id) ??
        (host.modelId && imageModels.find((m) => m.id === host.modelId)?.id) ??
        imageModels[0]?.id ??
        ''
      if (preferred && preferred !== modelId) setModelId(preferred)
    }
  }, [imageModels, modelId, defaultModelId, host.modelId])

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

  const patchModelFlag = (patch: Partial<ImageModelConfig>) => {
    if (!selectedEntry || selectedEntry.remote) return
    setModelConfig((prev) => (prev ? { ...prev, ...patch } : prev))
    void engine('models.imageConfig.set', { id: selectedEntry.id, patch })
      .then(setModelConfig)
      .catch(failed('Could not update pipeline option'))
  }

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
        label: defaultModelId === m.id ? `★ ${m.name}` : m.name,
        group: m.remote ? 'Remote' : 'Local',
        note: m.remote ? m.remote.model : [m.info?.architecture, m.quant].filter(Boolean).join(' · ') || undefined
      })),
    [imageModels, defaultModelId]
  )

  const loraOptions = useMemo<BrowseOption[]>(
    () =>
      companions.loras
        .filter((l) => !activeLoras.some((a) => a.id === l.id))
        .map((l) => ({
          value: l.id,
          label: l.name,
          group: 'Installed LoRAs',
          note: l.path
        })),
    [companions.loras, activeLoras]
  )

  const loraById = useMemo(() => new Map(companions.loras.map((l) => [l.id, l])), [companions.loras])

  const historyByAssetId = useMemo(() => {
    const map = new Map<string, ImageHistoryEntry>()
    for (const h of history) {
      if (!map.has(h.assetId)) map.set(h.assetId, h)
    }
    return map
  }, [history])

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

  const openHistoryAssetMenu = (e: MouseEvent, assetId: string) => {
    const entry = historyByAssetId.get(assetId)
    const asset = assets.find((a) => a.id === assetId)
    openMenu(e, asset?.name ?? 'Generated image', [
      ...(entry
        ? [
            {
              label: 'Load Prompt & Settings',
              icon: <RefreshCw className="h-3.5 w-3.5 text-accent" />,
              onSelect: () => {
                loadFromHistory(entry)
                setHistoryOpen(false)
              }
            }
          ]
        : []),
      {
        label: 'View Image Only',
        icon: <ImageIcon className="h-3.5 w-3.5" />,
        onSelect: () => {
          setSelectedAssetId(assetId)
          setHistoryOpen(false)
        }
      },
      {
        label: 'Use as Reference (Edit / img2img)',
        icon: <Pencil className="h-3.5 w-3.5 text-secondary-ink" />,
        onSelect: () => {
          setSelectedAssetId(assetId)
          setSourceAssetId(assetId)
          setHistoryOpen(false)
        }
      },
      { label: '', separator: true },
      ...(entry
        ? [
            {
              label: 'Copy Prompt',
              icon: <Copy className="h-3.5 w-3.5" />,
              onSelect: () => void copyText(entry.prompt)
            },
            ...(entry.seed !== null
              ? [
                  {
                    label: `Copy Seed (${entry.seed})`,
                    icon: <Dices className="h-3.5 w-3.5" />,
                    onSelect: () => void copyText(String(entry.seed))
                  }
                ]
              : [])
          ]
        : []),
      ...(asset
        ? [
            {
              label: 'Open in Files',
              icon: <FolderOpen className="h-3.5 w-3.5" />,
              onSelect: () => {
                setHistoryOpen(false)
                showInData({ kind: 'asset', id: asset.id })
              }
            },
            {
              label: 'Save a copy…',
              icon: <Download className="h-3.5 w-3.5" />,
              onSelect: () => void main('asset.saveAs', { id: asset.id, name: asset.name }).catch(failed('Could not save image'))
            }
          ]
        : []),
      ...(entry
        ? [
            { label: '', separator: true },
            {
              label: 'Remove from History',
              icon: <X className="h-3.5 w-3.5" />,
              onSelect: () => void removeHistory(entry.id, false)
            },
            {
              label: 'Delete Image File',
              icon: <Trash2 className="h-3.5 w-3.5 text-alert" />,
              danger: true,
              onSelect: () => void removeHistory(entry.id, true)
            }
          ]
        : [])
    ])
  }

  const previewId = selectedAssetId ?? lastResult?.asset.id ?? generatedHistory[0]?.id ?? null
  const previewAsset = useMemo(() => (previewId ? assets.find((a) => a.id === previewId) ?? null : null), [assets, previewId])

  const runGenerate = async () => {
    if (!prompt.trim() || !selectedEntry || busy) return
    const parsedSeed = seedText.trim() !== '' && Number.isFinite(Number(seedText)) ? Math.trunc(Number(seedText)) : undefined
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
      loras: !selectedEntry.remote && activeLoras.length > 0 ? activeLoras : undefined,
      contextTitle: activeContext?.title
    }
    try {
      if (sourceAssetId) await edit({ ...common, sourceAssetId })
      else await generate(common)
    } catch {
      // Error state is persisted inside useImageHost
    }
  }

  const loadFromHistory = (entry: ImageHistoryEntry) => {
    if (entry.modelId && imageModels.some((m) => m.id === entry.modelId)) setModelId(entry.modelId)
    setPrompt(entry.prompt)
    setNegativePrompt(entry.negativePrompt ?? '')
    if (entry.negativePrompt) setShowNegative(true)
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

  const toggleDefaultModel = () => {
    if (!selectedEntry) return
    const nextId = defaultModelId === selectedEntry.id ? null : selectedEntry.id
    void setDefaultModel(nextId)
      .then(() =>
        toast.success(
          nextId ? 'Default image model set' : 'Default image model cleared',
          nextId ? `Agents calling generate_image will automatically use ${selectedEntry.name}.` : 'Agents will use the active image model.'
        )
      )
      .catch(failed('Could not save default image model'))
  }

  const activeTier = inferTier(width, height)
  const activeRatioId = useMemo(() => {
    const ratio = width / Math.max(1, height)
    const found = ASPECT_RATIOS.find((p) => Math.abs(p.ratioW / p.ratioH - ratio) < 0.08)
    return found?.id ?? null
  }, [width, height])

  const applyRatio = (preset: AspectRatioPreset) => {
    const next = dimsForAspect(preset, activeTier)
    setWidth(next.w)
    setHeight(next.h)
  }

  const applyTier = (tierStr: string) => {
    const tier = Number(tierStr) as ResolutionTier
    const matched = ASPECT_RATIOS.find((p) => p.id === activeRatioId) ?? ASPECT_RATIOS[0]
    const next = dimsForAspect(matched, tier)
    setWidth(next.w)
    setHeight(next.h)
  }

  const isSelectedDefault = Boolean(selectedEntry && defaultModelId === selectedEntry.id)
  const serverTone = host.status === 'error' ? 'error' : host.status === 'loading' || host.status === 'generating' ? 'busy' : host.status === 'ready' ? 'ok' : 'idle'

  return (
    <div className="flex h-full flex-col gap-2.5 p-4">
      <ViewHeader
        title="Image Studio"
        subtitle="Generate and edit pictures directly using sd-server or remote image models."
        actions={
          <>
            <Button
              size="sm"
              variant={historyOpen ? 'primary' : 'secondary'}
              icon={<History />}
              onClick={() => setHistoryOpen(true)}
            >
              {`History${history.length ? ` (${history.length})` : ''}`}
            </Button>
            <StatusBadge tone={serverTone}>
              {host.status === 'ready'
                ? `sd-server: ${host.modelName ? `${host.modelName} (${host.residency})` : host.residency}`
                : host.status === 'loading' || host.status === 'generating'
                  ? `sd-server: ${host.status}${host.modelName ? ` · ${host.modelName}` : ''}`
                  : `sd-server: ${host.status}`}
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
        <div className="flex shrink-0 items-center gap-3 border border-line border-l-2 border-l-accent bg-accent/5 px-3.5 py-2 text-[12px] text-ink">
          <span className="flex-1">
            To run local image models, install <span className="font-ui text-accent">sd-server</span> or set your own <span className="font-ui">sd-server.exe</span> path.
          </span>
          <Button size="sm" variant="primary" icon={<Server />} onClick={() => openHelperInstaller('sd-server')}>
            Open helper installers…
          </Button>
        </div>
      )}

      {imageModels.length === 0 ? (
        <EmptyState title="No image models configured yet">
          <div className="flex flex-col items-center gap-3">
            <span>Add a diffusion checkpoint (.safetensors, .ckpt, or .gguf) to a model folder, download a verified pack from Hugging Face, or add a remote image model.</span>
            <Button variant="primary" icon={<Download />} onClick={() => useApp.getState().setView('models')}>
              Open Models
            </Button>
          </div>
        </EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          {/* LEFT STUDIO CONTROL DOCK — COMPACT, TACTILE, ZERO-SCROLL GENERATE FLOW */}
          {!dockOpen ? (
            <button
              type="button"
              title="Expand Image Studio controls"
              onClick={() => setDockOpen(true)}
              className="flex w-9 shrink-0 flex-col items-center gap-2 border border-line/70 tone-sidebar-95 py-3 text-dim hover:border-accent hover:text-accent cursor-pointer"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ) : (
            <aside className="flex w-[23.5rem] shrink-0 flex-col overflow-hidden border border-line/70 tone-sidebar-95 shadow-panel">
              {/* PINNED MODEL BAR (1 compact row) */}
              <div className="flex shrink-0 flex-col gap-1.5 border-b border-line/50 tone-panel-70 p-2.5">
                <div className="flex items-center gap-1.5">
                  <BrowsePick
                    value={selectedEntry?.id ?? null}
                    options={modelOptions}
                    placeholder="Choose image model"
                    clearable={false}
                    onChange={(v) => v && setModelId(v)}
                    className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    title={isSelectedDefault ? 'Default model for generate_image (click to clear)' : 'Set as default model for agents calling generate_image'}
                    onClick={toggleDefaultModel}
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center border transition-colors cursor-pointer',
                      isSelectedDefault
                        ? 'border-accent/70 bg-accent/15 text-accent'
                        : 'border-line/50 tone-well-40 text-faint hover:border-line hover:text-ink'
                    )}
                  >
                    <Star className="h-3.5 w-3.5" fill={isSelectedDefault ? 'currentColor' : 'none'} />
                  </button>
                  {selectedEntry && !selectedEntry.remote && (
                    <button
                      type="button"
                      title="Configure pipeline companions & defaults…"
                      onClick={() => openSetup(selectedEntry.id, selectedEntry.name, missingCompanions)}
                      className={cn(
                        'relative flex h-8 w-8 shrink-0 items-center justify-center border transition-colors cursor-pointer',
                        missingCompanions.length > 0
                          ? 'border-warn/70 bg-warn/15 text-warn'
                          : 'border-line/50 tone-well-40 text-dim hover:border-line hover:text-ink'
                      )}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {missingCompanions.length > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warn" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    title="Collapse controls to maximize canvas"
                    onClick={() => setDockOpen(false)}
                    className="flex h-8 w-7 shrink-0 items-center justify-center text-faint hover:text-ink cursor-pointer"
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </button>
                </div>

                {selectedEntry && !selectedEntry.remote && missingCompanions.length > 0 && (
                  <div className="flex items-center gap-1.5 border border-warn/40 bg-warn/10 px-2 py-1 text-[11px] text-warn">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate" title={missingCompanions.join(', ')}>
                      Missing: {missingCompanions.join(', ')}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void engine('models.imageConfig.autoMatch', { id: selectedEntry.id })
                          .then(setModelConfig)
                          .catch(failed('Could not auto-match companions'))
                      }
                      className="font-label text-[9.5px] font-bold caps-5 underline hover:text-ink cursor-pointer"
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => openSetup(selectedEntry.id, selectedEntry.name, missingCompanions)}
                      className="font-label text-[9.5px] font-bold caps-5 underline hover:text-ink cursor-pointer"
                    >
                      Fix
                    </button>
                  </div>
                )}

                {selectedEntry && !selectedEntry.remote && sdReady && chatHost.modelId && swapNotice && (
                  <div className="truncate font-ui text-[10.5px] text-faint">{swapNotice}</div>
                )}
              </div>

              {/* SCROLLABLE COMPACT CONTROLS BODY */}
              <div
                className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !busy && prompt.trim()) {
                    e.preventDefault()
                    void runGenerate()
                  }
                }}
              >
                {/* 1. PROMPT HERO DECK */}
                <div className="flex flex-col gap-1.5">
                  <ImageContextSnippets context={activeContext} prompt={prompt} onPromptChange={setPrompt} />
                  <div className="flex flex-col border border-line/70 tone-well-40 focus-within:border-accent/80 transition-colors">
                    <LinkTextarea
                      rolls={false}
                      value={prompt}
                      onValue={(v) => setPrompt(v)}
                      rows={4}
                      placeholder="Describe the image, or type @page:style @sheet:hero#Appearance…"
                      className="border-0 bg-transparent focus:ring-0"
                    />
                    {/* Interactive Attachment Chip Bar */}
                    <div className="flex flex-wrap items-center gap-1 border-t border-line/35 tone-panel-50 px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setShowNegative((v) => !v)}
                        className={cn(
                          'flex items-center gap-1 border px-1.5 py-0.5 font-label text-[9.5px] font-bold caps-5 transition-colors cursor-pointer',
                          showNegative || negativePrompt.trim()
                            ? 'border-accent/60 bg-accent/15 text-accent'
                            : 'border-line/40 text-dim hover:text-ink'
                        )}
                      >
                        <Ban className="h-2.5 w-2.5" />
                        <span>Negative</span>
                      </button>

                      {sourceAssetId ? (
                        <div className="flex items-center gap-1 border border-accent/60 bg-accent/15 pl-0.5 pr-1.5 py-0.5 text-[10px] text-accent">
                          <div className="h-4 w-4 overflow-hidden border border-line/50">
                            <AssetMedia id={sourceAssetId} className="h-full w-full object-cover" />
                          </div>
                          <button type="button" onClick={() => void pickSource()} className="font-label text-[9.5px] font-bold caps-5 hover:underline cursor-pointer">
                            Edit Ref
                          </button>
                          <button type="button" onClick={() => setSourceAssetId(null)} className="hover:text-ink cursor-pointer" title="Clear reference image">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void pickSource()}
                          className="flex items-center gap-1 border border-line/40 px-1.5 py-0.5 font-label text-[9.5px] font-bold caps-5 text-dim hover:border-line hover:text-ink transition-colors cursor-pointer"
                        >
                          <ImageIcon className="h-2.5 w-2.5" />
                          <span>Ref / Edit</span>
                        </button>
                      )}

                      {selectedEntry && !selectedEntry.remote && (
                        <button
                          type="button"
                          onClick={() => setShowLoras((v) => !v)}
                          className={cn(
                            'flex items-center gap-1 border px-1.5 py-0.5 font-label text-[9.5px] font-bold caps-5 transition-colors cursor-pointer',
                            showLoras || activeLoras.length > 0
                              ? 'border-secondary-ink/70 bg-secondary/15 text-secondary-ink'
                              : 'border-line/40 text-dim hover:text-ink'
                          )}
                        >
                          <Layers className="h-2.5 w-2.5" />
                          <span>LoRAs{activeLoras.length ? ` (${activeLoras.length})` : ''}</span>
                        </button>
                      )}

                      {prompt.trim() && (
                        <button
                          type="button"
                          title="Clear prompt"
                          onClick={() => setPrompt('')}
                          className="ml-auto p-0.5 text-faint hover:text-alert cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Negative Prompt Drawer (inline only when toggled) */}
                  {showNegative && (
                    <Textarea
                      value={negativePrompt}
                      onChange={(e) => setNegativePrompt(e.target.value)}
                      rows={2}
                      placeholder="Negative prompt — elements to avoid…"
                      className="text-[12px]"
                    />
                  )}

                  {/* Interactive LoRAs Drawer (inline only when toggled) */}
                  {showLoras && selectedEntry && !selectedEntry.remote && (
                    <div className="flex flex-col gap-2 border border-line/50 tone-well-40 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-label text-[9.5px] font-bold caps-8 text-secondary-ink">LoRA Adapters</span>
                        {activeLoras.length > 0 && (
                          <button type="button" onClick={clearLoras} className="font-label text-[9.5px] caps-5 text-faint hover:text-alert cursor-pointer">
                            Clear all
                          </button>
                        )}
                      </div>
                      {companions.loras.length === 0 ? (
                        <div className="flex items-center justify-between text-[11px] text-faint">
                          <span>No LoRAs installed yet.</span>
                          <button type="button" onClick={() => useApp.getState().setView('models')} className="text-accent hover:underline cursor-pointer">
                            Open Models
                          </button>
                        </div>
                      ) : (
                        <>
                          {loraOptions.length > 0 && (
                            <BrowsePick
                              value={null}
                              options={loraOptions}
                              placeholder="Add a LoRA…"
                              onChange={(id) => id && addLora(id, 0.8)}
                              className="w-full"
                            />
                          )}
                          {activeLoras.map((item) => {
                            const ref = loraById.get(item.id)
                            return (
                              <div key={item.id} className="flex flex-col gap-1 border border-line/40 tone-panel-60 px-2 py-1.5">
                                <div className="flex items-center justify-between gap-1.5">
                                  <span className="truncate text-[11.5px] font-semibold text-ink">{ref?.name ?? item.id}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-data text-[10.5px] text-accent">{item.weight.toFixed(2)}</span>
                                    <button type="button" onClick={() => removeLora(item.id)} className="text-faint hover:text-alert cursor-pointer" title="Remove LoRA">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                <Slider value={item.weight} min={-2} max={2} step={0.05} onChange={(w) => setLoraWeight(item.id, w)} />
                              </div>
                            )
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. VISUAL ASPECT RATIO & RESOLUTION STUDIO STRIP */}
                <div className="flex flex-col gap-2 border-t border-line/35 pt-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-label text-[10px] font-bold caps-8 text-dim">Canvas</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Click to enter exact custom pixel dimensions"
                        onClick={() => setShowCustomSize((v) => !v)}
                        className={cn(
                          'border px-1.5 py-0.5 font-data text-[10.5px] transition-colors cursor-pointer',
                          showCustomSize ? 'border-accent bg-accent/15 text-accent' : 'border-line/50 tone-well-40 text-ink hover:border-accent/60'
                        )}
                      >
                        {width} × {height}
                      </button>
                      <button
                        type="button"
                        title="Swap width & height"
                        onClick={() => {
                          const w = width
                          setWidth(height)
                          setHeight(w)
                        }}
                        className="flex h-6 w-6 items-center justify-center border border-line/50 tone-well-40 text-dim hover:border-line hover:text-ink cursor-pointer"
                      >
                        <ArrowLeftRight className="h-3 w-3" />
                      </button>
                      <Segmented value={String(activeTier)} options={TIER_OPTIONS} onChange={applyTier} />
                    </div>
                  </div>

                  {/* Proportional Aspect Ratio Visual Tiles */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {ASPECT_RATIOS.map((preset) => {
                      const active = activeRatioId === preset.id
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyRatio(preset)}
                          className={cn(
                            'flex flex-col items-center justify-center gap-1 border py-2 transition-all cursor-pointer',
                            active
                              ? 'border-accent bg-accent/15 text-accent shadow-[inset_0_-2px_0_var(--color-accent)]'
                              : 'border-line/45 tone-well-40 text-dim hover:border-line hover:text-ink'
                          )}
                        >
                          <span
                            style={{ width: preset.boxW, height: preset.boxH }}
                            className={cn(
                              'block border transition-colors',
                              active ? 'border-accent bg-accent/25' : 'border-dim/60'
                            )}
                          />
                          <span className="font-data text-[9.5px] leading-none">{preset.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {showCustomSize && (
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-label text-[10px] font-bold caps-5 text-faint">W</span>
                        <NumberField value={width} min={64} max={4096} step={64} onChange={(v) => v !== undefined && setWidth(v)} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-label text-[10px] font-bold caps-5 text-faint">H</span>
                        <NumberField value={height} min={64} max={4096} step={64} onChange={(v) => v !== undefined && setHeight(v)} />
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. INTERACTIVE SAMPLING SLIDERS (Steps + CFG) */}
                <div className="flex flex-col gap-2 border-t border-line/35 pt-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 shrink-0 font-label text-[10px] font-bold caps-8 text-dim">Steps</span>
                    <div className="min-w-0 flex-1">
                      <Slider value={Math.min(60, steps)} min={1} max={60} step={1} onChange={setSteps} />
                    </div>
                    <NumberField value={steps} min={1} max={150} step={1} onChange={(v) => v !== undefined && setSteps(v)} className="w-14 text-center" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 shrink-0 font-label text-[10px] font-bold caps-8 text-dim">CFG</span>
                    <div className="min-w-0 flex-1">
                      <Slider value={Math.min(15, cfgScale)} min={0} max={15} step={0.5} onChange={setCfgScale} />
                    </div>
                    <NumberField value={cfgScale} min={0} max={30} step={0.5} onChange={(v) => v !== undefined && setCfgScale(v)} className="w-14 text-center" />
                  </div>

                  {/* Sampler + Seed Compact Split Row */}
                  <div className="grid grid-cols-[1.15fr_1fr] gap-2 pt-0.5">
                    <BrowsePick
                      value={sampler}
                      options={SAMPLER_OPTIONS}
                      placeholder="Sampler"
                      allowCustom
                      clearable={false}
                      onChange={(v) => v && setSampler(v)}
                      className="w-full"
                    />
                    <div className="flex min-w-0 items-center border border-line/60 tone-well-40 pr-1">
                      <Input
                        value={seedText}
                        onChange={(e) => setSeedText(e.target.value)}
                        placeholder="Random seed"
                        className="h-8 min-w-0 flex-1 border-0 bg-transparent px-2 font-data text-[11px]"
                      />
                      {lastResult?.seed !== null && lastResult?.seed !== undefined && (
                        <button
                          type="button"
                          title={`Reuse last seed (${lastResult.seed})`}
                          onClick={() => setSeedText(String(lastResult.seed))}
                          className="p-1 text-dim hover:text-accent cursor-pointer"
                        >
                          <RefreshCw className="h-3 w-3" />
                        </button>
                      )}
                      {seedText ? (
                        <button type="button" title="Randomize seed" onClick={() => setSeedText('')} className="p-1 text-dim hover:text-ink cursor-pointer">
                          <Dices className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 4. QUICK ONE-CLICK VRAM & HARDWARE CHIPS (Local sd-server) */}
                {selectedEntry && !selectedEntry.remote && modelConfig && (
                  <div className="flex flex-col gap-1.5 border-t border-line/35 pt-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-label text-[10px] font-bold caps-8 text-dim">Hardware &amp; VRAM</span>
                      <button
                        type="button"
                        onClick={() => openSetup(selectedEntry.id, selectedEntry.name, missingCompanions)}
                        className="font-label text-[9.5px] font-bold caps-5 text-accent hover:underline cursor-pointer"
                      >
                        Companions &amp; Files…
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(
                        [
                          ['offloadToCpu', 'CPU Offload', 'Offload weights to system RAM (--offload-to-cpu)'],
                          ['vaeTiling', 'VAE Tiling', 'Tile VAE decode to prevent OOM (--vae-tiling)'],
                          ['clipOnCpu', 'CLIP on CPU', 'Run text encoder on CPU (--clip-on-cpu)'],
                          ['flashAttention', 'Flash Attn', 'Enable flash attention kernels']
                        ] as const
                      ).map(([key, label, tip]) => {
                        const on = Boolean(modelConfig[key])
                        return (
                          <button
                            key={key}
                            type="button"
                            title={tip}
                            onClick={() => patchModelFlag({ [key]: !on })}
                            className={cn(
                              'border px-2 py-1 font-label text-[9.5px] font-bold caps-5 transition-colors cursor-pointer',
                              on
                                ? 'border-accent/70 bg-accent/15 text-accent'
                                : 'border-line/45 tone-well-40 text-dim hover:border-line hover:text-ink'
                            )}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* PINNED STICKY GENERATE FOOTER — ALWAYS REACHABLE WITH ZERO SCROLLING */}
              <div className="flex shrink-0 flex-col gap-1.5 border-t border-line/60 tone-panel-85 p-2.5">
                <div className="flex items-center justify-between font-data text-[10px] text-faint">
                  <span>
                    {width}×{height} · {steps}st · CFG {cfgScale} · {sampler}
                  </span>
                  {activeLoras.length > 0 && <span className="text-secondary-ink">{activeLoras.length} LoRA</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="primary"
                    size="lg"
                    icon={<Aperture />}
                    disabled={busy || !prompt.trim() || !selectedEntry || (!selectedEntry.remote && !sdReady)}
                    onClick={() => void runGenerate()}
                    className="flex-1 justify-center"
                  >
                    {busy
                      ? host.status === 'loading'
                        ? 'Starting sd-server…'
                        : 'Generating…'
                      : sourceAssetId
                        ? 'Edit Image'
                        : 'Generate Image'}
                  </Button>
                  {busy && (
                    <Button variant="ghost" size="lg" icon={<X />} onClick={() => void cancel()}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </aside>
          )}

          {/* RIGHT COLUMN: FULL-SPACE SHARED IMAGE VIEWER (FileEditor) + COLLAPSIBLE HISTORY & LOG */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 overflow-hidden">
            {(error || host.error) && <AlertBox>{error ?? host.error}</AlertBox>}

            {busy && (
              <div className="flex shrink-0 items-center gap-3 border border-accent/50 tone-panel-60 px-3.5 py-2 text-[12px] text-dim">
                <StatusBadge tone="busy">{host.progress?.stage || host.status}</StatusBadge>
                <span className="truncate font-ui text-ink">{progressInfo.text}</span>
                <SegmentBar value={progressInfo.ratio} className="ml-auto w-36 shrink-0" />
              </div>
            )}

            {/* SHARED FRONT-AND-CENTER PAN/ZOOM IMAGE VIEWER WITH GRADUAL SCAN & OVERLAY PROPERTIES */}
            {(() => {
              const displayedAsset = busy ? null : previewAsset
              const currentIdx = displayedAsset ? generatedHistory.findIndex((a) => a.id === displayedAsset.id) : -1
              const prevGenerated = currentIdx > 0 ? generatedHistory[currentIdx - 1] : null
              const nextGenerated = currentIdx >= 0 && currentIdx < generatedHistory.length - 1 ? generatedHistory[currentIdx + 1] : null
              const streamBadge =
                host.progress?.completed !== null && host.progress?.total
                  ? `Step ${host.progress.completed} / ${host.progress.total}`
                  : host.progress?.stage || null

              return (
                <div className="relative flex min-h-[24rem] flex-1 overflow-hidden border border-line/70">
                  <FileEditor
                    asset={displayedAsset}
                    liveStreamUrl={livePreviewUrl}
                    liveStreamKey={`gen-${host.modelId ?? 'active'}-${host.startedAt ?? 0}`}
                    liveStreamBadge={streamBadge}
                    busy={busy}
                    busyStage={host.progress?.stage || host.status}
                    busyText={progressInfo.text}
                    busyProgress={progressInfo.ratio}
                    targetDimensions={{ w: width, h: height }}
                    revealKey={lastResult?.asset.id ?? null}
                    inspectorStorageKey="imageGenViewer"
                    onPrev={prevGenerated ? () => setSelectedAssetId(prevGenerated.id) : undefined}
                    onNext={nextGenerated ? () => setSelectedAssetId(nextGenerated.id) : undefined}
                    hasPrev={Boolean(prevGenerated)}
                    hasNext={Boolean(nextGenerated)}
                    positionText={currentIdx >= 0 && generatedHistory.length > 1 ? `${currentIdx + 1} / ${generatedHistory.length}` : undefined}
                    topActions={
                      !livePreviewUrl && displayedAsset ? (
                        <>
                          <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setSourceAssetId(displayedAsset.id)}>
                            Edit / img2img
                          </Button>
                          <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => showInData({ kind: 'asset', id: displayedAsset.id })}>
                            Open in Files
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Download />}
                            onClick={() => void main('asset.saveAs', { id: displayedAsset.id, name: displayedAsset.name }).catch(failed('Could not save image'))}
                          >
                            Save as…
                          </Button>
                        </>
                      ) : undefined
                    }
                    extraInspector={
                      lastResult && displayedAsset && lastResult.asset.id === displayedAsset.id ? (
                        <div className="flex flex-col gap-2 border-b border-line/40 pb-4">
                          <FactGrid>
                            <Fact label="Dimensions">{`${lastResult.width}×${lastResult.height}`}</Fact>
                            <Fact label="Seed">
                              <span className="inline-flex items-center gap-1.5">
                                <span>{lastResult.seed ?? '—'}</span>
                                {lastResult.seed !== null && (
                                  <button type="button" title="Copy seed" onClick={() => void copyText(String(lastResult.seed))} className="text-faint hover:text-ink cursor-pointer">
                                    <Copy className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            </Fact>
                            <Fact label="Time">{`${(lastResult.durationMs / 1000).toFixed(1)}s`}</Fact>
                          </FactGrid>
                        </div>
                      ) : undefined
                    }
                    emptyState={
                      <span>
                        Describe an image on the left and press <span className="mx-1 font-ui text-ink">Generate Image</span> (or <span className="font-data text-accent">Ctrl+Enter</span>).
                      </span>
                    }
                  />
                </div>
              )
            })()}

            <div className="flex shrink-0 flex-col gap-2">
              <Fold label={`sd-server status & log${host.pid ? ` (PID ${host.pid})` : ''}`} count={host.log.length}>
                <div className="flex max-h-52 flex-col gap-2 overflow-y-auto px-3.5 pb-3">
                  {(host.modelName || host.pid || host.args.length > 0) && (
                    <FactGrid>
                      <Fact label="State">
                        <StatusBadge tone={serverTone}>{host.status}</StatusBadge>
                      </Fact>
                      <Fact label="Model">{host.modelName ?? '—'}</Fact>
                      <Fact label="Process">{host.pid ?? '—'}</Fact>
                      <Fact label="Version">{host.version ?? '—'}</Fact>
                    </FactGrid>
                  )}
                  <LogBox lines={host.log} empty="sd-server output appears here once a generation starts." />
                </div>
              </Fold>
            </div>
          </div>
        </div>
      )}

      {/* SPACIOUS PROMPT & IMAGE HISTORY MODAL (REMEMBERS TAB, CLICK LOADS PROMPT+SETTINGS, RIGHT-CLICK MENU) */}
      <Modal
        open={historyOpen}
        title={`Prompt & Image History (${historyView === 'prompts' ? history.length : generatedHistory.length})`}
        width={880}
        onClose={() => setHistoryOpen(false)}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 border-b border-line/40 pb-2.5">
            <Segmented
              value={historyView}
              options={[
                { value: 'prompts', label: `Prompts (${history.length})` },
                { value: 'grid', label: `Grid (${generatedHistory.length})` }
              ]}
              onChange={(v) => setHistoryView(v as 'prompts' | 'grid')}
            />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-faint">Click to load prompt &amp; settings · Right-click for menu</span>
              {history.length > 0 && (
                <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void clearHistory()}>
                  Clear all
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-[65vh] overflow-y-auto pr-1">
            {history.length === 0 && generatedHistory.length === 0 ? (
              <EmptyState title="No image history yet">
                Generated and edited images appear here with their full prompts, seeds, and settings.
              </EmptyState>
            ) : historyView === 'prompts' ? (
              <ImageHistoryList
                entries={history}
                selectedAssetId={previewId}
                onLoad={(entry) => {
                  loadFromHistory(entry)
                  setHistoryOpen(false)
                }}
                onEditAsset={(id) => {
                  setSelectedAssetId(id)
                  setSourceAssetId(id)
                  setHistoryOpen(false)
                }}
                onUseAsset={(id) => {
                  setSelectedAssetId(id)
                  setHistoryOpen(false)
                }}
                onRemove={(id, deleteAsset) => void removeHistory(id, deleteAsset)}
                onClear={() => void clearHistory()}
              />
            ) : (
              <PictureGrid
                ids={generatedHistory.map((a) => a.id)}
                min="9.5rem"
                names
                isOn={(id) => id === previewId}
                onPick={(id) => {
                  const entry = historyByAssetId.get(id)
                  if (entry) {
                    loadFromHistory(entry)
                  } else {
                    setSelectedAssetId(id)
                    const meta = assets.find((a) => a.id === id)
                    if (meta?.source?.original) setPrompt(meta.source.original)
                  }
                  setHistoryOpen(false)
                }}
                onMenu={(e, id) => openHistoryAssetMenu(e, id)}
              />
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
