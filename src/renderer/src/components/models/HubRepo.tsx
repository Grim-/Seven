import { useEffect, useMemo, useState } from 'react'
import { Download, X } from 'lucide-react'
import type { CompanionRole, DownloadBundleFile, HubFamily, HubFile, HubModel, ModelKind } from '@shared/types'
import { AlertBox, Button, Fold, SecretField, Select, SettingCard, SettingRow } from '../ui'
import { pickFolder } from '../ui/FileField'
import { filesKey, useHub } from '../../store/hub'
import { useApp } from '../../store/app'
import { useDownloads } from '../../store/downloads'
import { useSystemStats } from '../../lib/systemStats'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { formatBytes, formatCount } from '../../lib/format'
import { HubFileRow } from './HubFileRow'

const SHARD_CONTINUATION = /-(\d{5})-of-(\d{5})\.(?:gguf|safetensors|sft)$/i

function useHubToken(): [boolean, (token: string | null) => Promise<unknown>] {
  const [has, setHas] = useState(false)
  useEffect(() => {
    void engine('hub.token.has').then(setHas).catch(failed('Could not check the Hugging Face token'))
  }, [])
  return [has, (token) => engine('hub.token.set', { token }).then(setHas).catch(failed('Could not save the token'))]
}

type RepoBucket = 'standalone' | 'modular' | 'lora' | 'diffusers'

function classifyRepoPath(file: string): RepoBucket {
  const lower = file.toLowerCase()
  if (/\.bin$/i.test(lower)) return 'diffusers'
  if (/^(unet|transformer|text_encoder|text_encoder_2|text_encoder_3|safety_checker|feature_extractor|tokenizer|scheduler|vae_encoder|vae_decoder)\//i.test(lower)) {
    return 'diffusers'
  }
  if (/^vae(_1_0)?\/diffusion_pytorch_model/i.test(lower)) return 'diffusers'
  if (/(^|\/)(lora|loras)\//i.test(lower) || /lora/i.test(lower)) return 'lora'
  if (/^(diffusion_models|vae|vae_approx|text_encoders)\//i.test(lower)) return 'modular'
  if (/^(split_files|non_official)\/(diffusion_models|vae|text_encoders|clip_vision)\//i.test(lower)) return 'modular'
  if (/(^|\/)(ae|flux2-vae|qwen_image_vae|qwen_image_2\.1_vae.*)\.(safetensors|sft)$/i.test(lower)) return 'modular'
  if (/mmproj/i.test(lower)) return 'modular'
  return 'standalone'
}

function roleForPath(file: string): CompanionRole {
  const lower = file.toLowerCase()
  const base = lower.split('/').pop() ?? lower
  if (/mmproj/i.test(lower)) return 'llmVision'
  if (/taesd|taef1|taeqi|taew/i.test(lower)) return 'tae'
  if (/(^|\/)(vae|vae_approx)\//i.test(lower) || base === 'ae.safetensors' || /vae/.test(base)) return 'vae'
  if (/clip[-_]?l/.test(base)) return 'clipL'
  if (/clip[-_]?g/.test(base)) return 'clipG'
  if (/t5|umt5/.test(base)) return 't5xxl'
  if (/qwen|mistral|gemma|ministral|llm/i.test(base)) return 'llm'
  if (/lora/i.test(lower)) return 'lora'
  if (/diffusion_models/i.test(lower) || /\.(gguf|safetensors|sft|ckpt)$/i.test(lower)) return 'model'
  return 'other'
}

const ROLE_TO_KIND: Partial<Record<CompanionRole, ModelKind>> = {
  vae: 'vae',
  tae: 'vae',
  clipL: 'text_encoder',
  clipG: 'text_encoder',
  t5xxl: 'text_encoder',
  llm: 'text_encoder',
  llmVision: 'projector',
  lora: 'lora'
}

function expectedKindForFile(family: HubFamily, bucket: RepoBucket, file: string): ModelKind | undefined {
  if (bucket === 'lora') return 'lora'
  const role = roleForPath(file)
  if (ROLE_TO_KIND[role]) return ROLE_TO_KIND[role]
  if (family === 'image-gguf' || family === 'diffusion' || family === 'image-packs') return 'image'
  if (bucket === 'modular' && /diffusion_models/i.test(file)) return 'image'
  return undefined
}

function canonicalTargetForRepoFile(slug: string, file: string, role: CompanionRole): string {
  const base = file.split('/').pop() ?? file
  const dirByRole: Partial<Record<CompanionRole, string>> = {
    vae: 'vae',
    tae: 'vae',
    clipL: 'text_encoders',
    clipG: 'text_encoders',
    t5xxl: 'text_encoders',
    llm: 'text_encoders',
    llmVision: 'text_encoders',
    lora: 'loras'
  }
  const canonicalDir = dirByRole[role]
  if (canonicalDir) return `${canonicalDir}/${base}`
  return file.includes('/') ? `${slug}/${file}` : base
}

export function HubRepo({ repo, model }: { repo: string; model: HubModel | null }) {
  const hubFamily = useHub((s) => s.family)
  const family = model?.family ?? hubFamily
  const files = useHub((s) => s.files[filesKey(repo, family)])
  const loadFiles = useHub((s) => s.loadFiles)
  const folders = useApp((s) => s.settings?.modelFolders) ?? []
  const [folder, setFolder] = useState<string | null>(folders[0] ?? null)
  const [hasToken, saveToken] = useHubToken()
  const stats = useSystemStats(10000)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const downloads = useDownloads((s) => s.list)

  useEffect(() => {
    setSelected(new Set())
    void loadFiles(repo, family)
  }, [repo, family])
  useEffect(() => {
    if (!folder && folders.length) setFolder(folders[0])
  }, [folders.length])

  const allFiles = files?.value ?? []
  const grouped = useMemo(() => {
    const standalone: HubFile[] = []
    const modular: HubFile[] = []
    const loras: HubFile[] = []
    const diffusers: HubFile[] = []
    for (const f of allFiles) {
      const m = f.file.match(SHARD_CONTINUATION)
      if (m && Number(m[1]) > 1) continue
      const bucket = classifyRepoPath(f.file)
      if (bucket === 'lora') loras.push(f)
      else if (bucket === 'modular') modular.push(f)
      else if (bucket === 'diffusers') diffusers.push(f)
      else standalone.push(f)
    }
    return { standalone, modular, loras, diffusers }
  }, [allFiles])

  const selectableMap = useMemo(() => new Map([...grouped.standalone, ...grouped.modular, ...grouped.loras].map((f) => [f.file, f])), [grouped])
  const selectedFiles = useMemo(() => [...selected].map((k) => selectableMap.get(k)).filter((f): f is HubFile => Boolean(f)), [selected, selectableMap])
  const selectedBytes = useMemo(() => selectedFiles.reduce((s, f) => s + f.fileBytes, 0), [selectedFiles])
  const selectionKey = useMemo(() => [...selected].sort().join('|'), [selected])
  const queuedSelected = Boolean(selectionKey) && downloads.some((d) => d.repo === repo && d.file === selectionKey && d.state !== 'failed')

  const toggleSelect = (filePath: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }

  const downloadSelected = () => {
    if (selectedFiles.length === 0) return
    const slug = repo.split('/').pop() ?? repo
    const entries: DownloadBundleFile[] = selectedFiles.map((f) => {
      const role = roleForPath(f.file)
      return {
        repo,
        file: f.file,
        size: f.fileBytes,
        role,
        targetRel: canonicalTargetForRepoFile(slug, f.file, role)
      }
    })
    const primary = selectedFiles.find((f) => roleForPath(f.file) === 'model') ?? selectedFiles[0]
    const expectedKind = primary ? expectedKindForFile(family, classifyRepoPath(primary.file), primary.file) : undefined
    void engine('downloads.start', {
      repo,
      file: selectionKey,
      name: entries.length === 1 ? selectedFiles[0].name : `${slug} (${entries.length} selected files)`,
      folder: folder ?? '',
      total: selectedBytes,
      files: entries,
      ...(expectedKind ? { expectedKind } : {})
    })
      .then(() => setSelected(new Set()))
      .catch(failed('Could not start selected file downloads'))
  }

  const allowCompanions = family !== 'gguf' || grouped.modular.length > 0 || grouped.loras.length > 0

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem] items-start gap-3 overflow-y-auto pr-1">
      <div className="flex flex-col gap-3">
        {!files && (
          <SettingCard title="Files">
            <div className="px-3.5 py-3 text-[12.5px] text-faint">Listing files…</div>
          </SettingCard>
        )}
        {files?.error && <AlertBox>{files.error}</AlertBox>}
        {files?.value?.length === 0 && (
          <SettingCard title="Files" count={0}>
            <div className="px-3.5 py-3 text-[12.5px] text-faint">This repo has no compatible model files.</div>
          </SettingCard>
        )}

        {!folder && (
          <AlertBox>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>No models folder is set. Choose where downloaded models should be saved.</span>
              <Button
                size="sm"
                variant="primary"
                onClick={() =>
                  pickFolder(async (chosen) => {
                    const next = await useApp.getState().updateSettings({ modelFolders: [...folders, chosen] })
                    setFolder(chosen)
                    await engine('models.scan', { folders: next.modelFolders })
                  })
                }
              >
                Choose folder…
              </Button>
            </div>
          </AlertBox>
        )}

        {selectedFiles.length > 0 && (
          <div className="flex items-center gap-2 border border-line border-l-2 border-l-accent bg-accent/5 px-3.5 py-2 text-[12.5px] text-ink">
            <span className="flex-1">
              {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected ({formatBytes(selectedBytes)})
            </span>
            <Button size="sm" variant="ghost" icon={<X />} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant={queuedSelected ? 'secondary' : 'primary'} icon={<Download />} disabled={queuedSelected || !folder} onClick={downloadSelected}>
              {queuedSelected ? 'Queued' : `Download selected (${selectedFiles.length})`}
            </Button>
          </div>
        )}

        {grouped.standalone.length > 0 && (
          <SettingCard title="Checkpoints & GGUF Models" count={grouped.standalone.length}>
            {grouped.standalone.map((f) => (
              <HubFileRow
                key={f.file}
                repo={repo}
                file={f}
                folder={folder}
                stats={stats}
                allowCompanions={allowCompanions}
                expectedKind={expectedKindForFile(family, 'standalone', f.file)}
                selected={selected.has(f.file)}
                onToggleSelect={() => toggleSelect(f.file)}
              />
            ))}
          </SettingCard>
        )}

        {grouped.modular.length > 0 && (
          <SettingCard title="sd-server Modular Weights (pick 1 precision per slot)" count={grouped.modular.length}>
            {grouped.modular.map((f) => (
              <HubFileRow
                key={f.file}
                repo={repo}
                file={f}
                folder={folder}
                stats={stats}
                allowCompanions
                expectedKind={expectedKindForFile(family, 'modular', f.file)}
                selected={selected.has(f.file)}
                onToggleSelect={() => toggleSelect(f.file)}
              />
            ))}
          </SettingCard>
        )}

        {grouped.loras.length > 0 && (
          <Fold label="LoRAs" count={grouped.loras.length}>
            <SettingCard title="LoRA weights" count={grouped.loras.length}>
              {grouped.loras.map((f) => (
                <HubFileRow
                  key={f.file}
                  repo={repo}
                  file={f}
                  folder={folder}
                  stats={stats}
                  allowCompanions
                  expectedKind="lora"
                  selected={selected.has(f.file)}
                  onToggleSelect={() => toggleSelect(f.file)}
                />
              ))}
            </SettingCard>
          </Fold>
        )}

        {grouped.diffusers.length > 0 && (
          <Fold label="Diffusers PyTorch / OpenVINO internals (not directly loaded by sd-server)" count={grouped.diffusers.length}>
            <SettingCard title="Diffusers Internal Shards" count={grouped.diffusers.length}>
              <div className="px-3.5 py-2 text-[12px] text-faint">
                These subfolders come from Python Diffusers / OpenVINO exports and cannot be loaded directly by <span className="font-ui">sd-server</span>. Prefer single checkpoints above, modular <span className="font-ui">diffusion_models/</span> weights, or curated <span className="font-ui">sd-server Packs</span>.
              </div>
              {grouped.diffusers.map((f) => (
                <HubFileRow key={f.file} repo={repo} file={f} folder={folder} stats={stats} allowCompanions />
              ))}
            </SettingCard>
          </Fold>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {model && (
          <SettingCard title="About">
            <SettingRow label="Downloads">{formatCount(model.downloads)}</SettingRow>
            <SettingRow label="Likes">{formatCount(model.likes)}</SettingRow>
            {model.params !== null && <SettingRow label="Parameters">{formatCount(model.params)}</SettingRow>}
            {model.architecture && <SettingRow label="Architecture">{model.architecture}</SettingRow>}
            {model.contextLength !== null && <SettingRow label="Trained context">{model.contextLength.toLocaleString()}</SettingRow>}
            <SettingRow label="Access">{model.gated ? 'Gated' : 'Public'}</SettingRow>
          </SettingCard>
        )}
        <SettingCard title="Save to">
          <SettingRow wide label="Model folder" hint={folders.length ? 'Files save cleanly and appear automatically when done.' : 'Add a model folder under Folders in Models first.'}>
            <Select value={folder ?? ''} options={folders.map((f) => ({ value: f, label: f }))} onChange={setFolder} className="w-full font-ui text-[12px]" />
          </SettingRow>
        </SettingCard>
        <SettingCard title="Access">
          <SettingRow wide label="Hugging Face token" hint="Only needed for gated models, after you accept their terms on huggingface.co. Kept in the vault.">
            <SecretField set={hasToken} onSave={saveToken} placeholder="hf_…" />
          </SettingRow>
        </SettingCard>
      </div>
    </div>
  )
}
