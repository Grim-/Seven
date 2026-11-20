import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, RotateCcw, Server, Wand2 } from 'lucide-react'
import { DEFAULT_IMAGE_CONFIG, type ImageCompanionRef, type ImageCompanions, type ImageModelConfig, type ImagePipelineMode, type ModelEntry } from '@shared/types'
import { resolveImageArchSpec, missingRecipeSlots } from '@shared/imageModels'
import { AlertBox, BrowsePick, Button, Fact, FactGrid, Fold, LogBox, NumberField, Segmented, SettingCard, SettingRow, StatusBadge, Toggle, pickFile, pickFolder, type BrowseOption } from '../ui'
import { engine } from '../../lib/ipc'
import { formatRelative } from '../../lib/format'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'
import { useImageHost } from '../../store/image'
import { useModels } from '../../store/models'
import { useInstallHelper } from '../install/useInstallHelper'
import { openHelperInstaller } from '../../lib/openServer'
import { SAMPLER_OPTIONS } from './samplerOptions'

const PIPELINE_MODES: { value: ImagePipelineMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'model', label: 'Checkpoint (--model)' },
  { value: 'diffusion', label: 'Diffusion (--diffusion-model)' }
]

const SIZE_PRESETS: { label: string; width: number; height: number }[] = [
  { label: '512×512', width: 512, height: 512 },
  { label: '768×768', width: 768, height: 768 },
  { label: '1024×1024', width: 1024, height: 1024 },
  { label: '1024×768', width: 1024, height: 768 },
  { label: '768×1024', width: 768, height: 1024 }
]

const WEIGHT_FILTERS = [{ name: 'Model weights', extensions: ['safetensors', 'sft', 'ckpt', 'gguf'] }]

function CompanionRow({
  label,
  hint,
  value,
  options,
  folder = false,
  onChange
}: {
  label: string
  hint: string
  value: string | null
  options: ImageCompanionRef[]
  folder?: boolean
  onChange: (next: string | null) => void
}) {
  const browseOptions = useMemo<BrowseOption[]>(() => {
    const base: BrowseOption[] = options.map((o) => ({ value: o.id, label: o.name, group: 'Indexed weights', note: o.path }))
    if (value && !options.some((o) => o.id === value)) {
      const short = value.split(/[\\/]/).pop() ?? value
      base.unshift({ value, label: short, group: 'Selected path', note: value })
    }
    return base
  }, [options, value])

  return (
    <SettingRow label={label} hint={hint}>
      <div className="flex min-w-0 items-center gap-1.5">
        <BrowsePick value={value} options={browseOptions} placeholder="None (auto / built-in)" onChange={onChange} className="w-64" />
        <Button
          size="sm"
          variant="ghost"
          icon={<FolderOpen />}
          onClick={() => (folder ? pickFolder((p) => onChange(p)) : pickFile(WEIGHT_FILTERS, (p) => onChange(p)))}
        >
          Browse…
        </Button>
      </div>
    </SettingRow>
  )
}

export function ImageModelConfigPanel({ model, showStatus = true }: { model: ModelEntry; showStatus?: boolean }) {
  const imageHost = useImageHost((s) => s.host)
  const localModels = useModels((s) => s.list)
  const { state: sdInstall } = useInstallHelper('sd-server')
  const sdReady = Boolean(sdInstall?.active || String(sdInstall?.settings?.customExecutable ?? '').trim())
  const [config, setConfig] = useState<ImageModelConfig>(DEFAULT_IMAGE_CONFIG)
  const [companions, setCompanions] = useState<ImageCompanions>({ vaes: [], textEncoders: [], projectors: [], loras: [] })

  const llmEncoderOptions = useMemo<ImageCompanionRef[]>(() => {
    const chats = localModels
      .filter((m) => !m.remote && m.info?.kind === 'chat')
      .map((m) => ({ id: m.id, name: m.name, path: m.path }))
    return [...companions.textEncoders, ...chats]
  }, [companions.textEncoders, localModels])

  useEffect(() => {
    let live = true
    void Promise.all([engine('models.imageConfig.get', { id: model.id }), engine('models.imageCompanions')])
      .then(([cfg, comp]) => {
        if (!live) return
        setConfig(cfg)
        setCompanions(comp)
      })
      .catch(noteFailure('models', 'Could not load image model settings'))
    return () => {
      live = false
    }
  }, [model.id])

  const patch = (next: Partial<ImageModelConfig>) => {
    setConfig((prev) => ({ ...prev, ...next }))
    void engine('models.imageConfig.set', { id: model.id, patch: next })
      .then(setConfig)
      .catch(failed('Could not save image model settings'))
  }

  const reset = () => {
    void engine('models.imageConfig.reset', { id: model.id })
      .then(setConfig)
      .catch(failed('Could not reset image model settings'))
  }

  const autoMatch = () => {
    void engine('models.imageConfig.autoMatch', { id: model.id })
      .then(setConfig)
      .catch(failed('Could not auto-match companions'))
  }

  const archSpec = useMemo(() => resolveImageArchSpec(model.info?.architecture, model.name), [model.info?.architecture, model.name])
  const missingSlots = useMemo(
    () => (archSpec && config.mode !== 'model' ? missingRecipeSlots(archSpec, config) : []),
    [archSpec, config]
  )

  const activeHere = imageHost.modelId === model.id
  const tone = imageHost.status === 'error' ? 'error' : imageHost.status === 'generating' || imageHost.status === 'loading' ? 'busy' : imageHost.status === 'ready' ? 'ok' : 'idle'

  return (
    <div className="flex flex-col gap-3">
      {sdInstall && !sdReady && (
        <div className="flex items-center gap-3 border border-line border-l-2 border-l-accent bg-accent/5 px-3.5 py-2.5 text-[12.5px] text-white">
          <span className="flex-1"><span className="font-mono text-accent">sd-server</span> is not installed yet. Download a build or point Seven at your own <span className="font-mono">sd-server.exe</span> to run this model.</span>
          <Button size="sm" variant="primary" icon={<Server />} onClick={() => openHelperInstaller('sd-server')}>
            Install sd-server…
          </Button>
        </div>
      )}
      {showStatus && (activeHere || imageHost.status !== 'unloaded') && (
        <SettingCard title="sd-server status">
          {activeHere && imageHost.error && <AlertBox className="m-3">{imageHost.error}</AlertBox>}
          <div className="p-3.5">
            <FactGrid>
              <Fact label="State">
                <StatusBadge tone={tone}>{imageHost.status}</StatusBadge>
              </Fact>
              <Fact label="Active model">{imageHost.modelName ?? '—'}</Fact>
              <Fact label="Process">{imageHost.pid ?? '—'}</Fact>
              <Fact label="Started">{imageHost.startedAt ? formatRelative(imageHost.startedAt) : '—'}</Fact>
            </FactGrid>
          </div>
          {activeHere && imageHost.args.length > 0 && (
            <Fold label="Command line">
              <div className="px-3.5 pb-3 font-mono text-[11.5px] text-white/85">{imageHost.args.join(' ')}</div>
            </Fold>
          )}
          {imageHost.log.length > 0 && (
            <Fold label="Log" count={imageHost.log.length}>
              <div className="px-3.5 pb-3">
                <LogBox lines={imageHost.log} empty="sd-server output appears here once it starts." />
              </div>
            </Fold>
          )}
        </SettingCard>
      )}

      <SettingCard
        title="Pipeline & Companions"
        actions={
          <div className="flex items-center gap-1.5">
            {archSpec && (
              <Button size="sm" variant="ghost" icon={<Wand2 />} onClick={autoMatch}>
                Auto-match
              </Button>
            )}
            <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={reset}>
              Reset defaults
            </Button>
          </div>
        }
      >
        {missingSlots.length > 0 && (
          <AlertBox className="m-3">
            {`${archSpec?.label ?? 'Modular'} requires companion weights (${missingSlots.map((s) => s.label).join(', ')}). Pick them below or click Auto-match if downloaded.`}
          </AlertBox>
        )}
        <SettingRow label="Pipeline mode" hint="Monolithic checkpoints (SD 1.5 / SDXL) use --model; modular UNets/DiTs (Flux / SD 3.5 / Z-Image / Qwen) use --diffusion-model with companions.">
          <Segmented value={config.mode} options={PIPELINE_MODES} onChange={(mode) => patch({ mode })} />
        </SettingRow>
        <CompanionRow label="VAE (--vae)" hint="Standalone VAE weights (e.g. ae.safetensors, flux2-vae.safetensors, qwen_image_2.1_vae)." value={config.vae} options={companions.vaes} onChange={(vae) => patch({ vae })} />
        <CompanionRow label="TAE / TAESD (--taesd)" hint="Optional fast tiny autoencoder alternative to a full VAE (taef1, taeqi2_1, taesd)." value={config.tae} options={companions.vaes} onChange={(tae) => patch({ tae })} />
        <CompanionRow label="CLIP-L (--clip_l)" hint="CLIP-L text encoder weights (FLUX.1 / SD 3.5)." value={config.clipL} options={companions.textEncoders} onChange={(clipL) => patch({ clipL })} />
        <CompanionRow label="CLIP-G (--clip_g)" hint="CLIP-G text encoder weights (SDXL / SD 3.5)." value={config.clipG} options={companions.textEncoders} onChange={(clipG) => patch({ clipG })} />
        <CompanionRow label="T5-XXL (--t5xxl)" hint="T5-XXL text encoder weights (FLUX.1 / SD 3.5 / Chroma / Wan)." value={config.t5xxl} options={companions.textEncoders} onChange={(t5xxl) => patch({ t5xxl })} />
        <CompanionRow label="LLM encoder (--llm)" hint="LLM text encoder (Qwen3-4B/8B for FLUX.2 & Z-Image, Qwen3-VL / 2.5-VL for Qwen-Image, Mistral 3.2 for FLUX.2 dev)." value={config.llm} options={llmEncoderOptions} onChange={(llm) => patch({ llm })} />
        <CompanionRow label="LLM Vision / mmproj (--llm_vision)" hint="Multimodal mmproj GGUF required for image editing with separate Qwen2.5-VL / Qwen3-VL GGUF encoders." value={config.llmVision} options={companions.projectors} onChange={(llmVision) => patch({ llmVision })} />
        <CompanionRow label="LoRA folder (--lora-model-dir)" hint="Optional folder of LoRA files available for prompts with <lora:name:weight>." value={config.loraDir} options={companions.loras} folder onChange={(loraDir) => patch({ loraDir })} />
      </SettingCard>

      <SettingCard title="Generation Defaults">
        <SettingRow label="Size preset" hint="Quick default aspect ratios applied unless overridden per generation.">
          <div className="flex flex-wrap gap-1">
            {SIZE_PRESETS.map((p) => (
              <Button
                key={p.label}
                size="sm"
                variant={config.width === p.width && config.height === p.height ? 'badge' : 'ghost'}
                onClick={() => patch({ width: p.width, height: p.height })}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Width">
          <NumberField value={config.width} min={64} max={4096} step={64} onChange={(width) => width !== undefined && patch({ width })} />
        </SettingRow>
        <SettingRow label="Height">
          <NumberField value={config.height} min={64} max={4096} step={64} onChange={(height) => height !== undefined && patch({ height })} />
        </SettingRow>
        <SettingRow label="Steps">
          <NumberField value={config.steps} min={1} max={150} step={1} onChange={(steps) => steps !== undefined && patch({ steps })} />
        </SettingRow>
        <SettingRow label="CFG scale">
          <NumberField value={config.cfgScale} min={0} max={30} step={0.5} onChange={(cfgScale) => cfgScale !== undefined && patch({ cfgScale })} />
        </SettingRow>
        <SettingRow label="Sampler">
          <BrowsePick
            value={config.sampler}
            options={SAMPLER_OPTIONS}
            placeholder="Pick a sampler"
            allowCustom
            clearable={false}
            onChange={(sampler) => sampler && patch({ sampler })}
            className="w-64"
          />
        </SettingRow>
      </SettingCard>

      <Fold label="VRAM & acceleration options">
        <SettingCard
          title="Memory & Acceleration"
          actions={
            <Button size="sm" variant="ghost" onClick={() => patch({ width: 512, height: 512, clipOnCpu: true, vaeTiling: true, offloadToCpu: true })}>
              Low-VRAM preset (512px + CPU offload)
            </Button>
          }
        >
          <SettingRow label="Keep CLIP/text encoder on CPU (--clip-on-cpu)" hint="Saves GPU VRAM during prompt encoding with minimal slowdown.">
            <Toggle checked={config.clipOnCpu} onChange={(clipOnCpu) => patch({ clipOnCpu })} />
          </SettingRow>
          <SettingRow label="Enable VAE tiling (--vae-tiling)" hint="Processes large images in tiles to prevent out-of-memory spikes during decode.">
            <Toggle checked={config.vaeTiling} onChange={(vaeTiling) => patch({ vaeTiling })} />
          </SettingRow>
          <SettingRow label="Offload model weights to CPU (--offload-to-cpu)" hint="Keeps weights in system RAM between layers for low-VRAM GPUs.">
            <Toggle checked={config.offloadToCpu} onChange={(offloadToCpu) => patch({ offloadToCpu })} />
          </SettingRow>
          <SettingRow label="Flash attention (--diffusion-fa / --flash-attn)" hint="Reduces memory bandwidth and speeds up attention kernels.">
            <Toggle checked={config.flashAttention} onChange={(flashAttention) => patch({ flashAttention })} />
          </SettingRow>
        </SettingCard>
      </Fold>
    </div>
  )
}
