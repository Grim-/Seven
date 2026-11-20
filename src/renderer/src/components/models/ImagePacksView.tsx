import { useEffect, useMemo, useState } from 'react'
import { Check, Download, Layers } from 'lucide-react'
import { VERIFIED_IMAGE_PACKS, type VerifiedImagePack, type VerifiedPackFile, type VerifiedPackVariant } from '@shared/imageModels'
import type { CompanionRole, DownloadBundleFile, ImageModelConfig, ModelEntry } from '@shared/types'
import { AlertBox, Button, Select, SettingCard, SettingRow, StatusBadge } from '../ui'
import { pickFolder } from '../ui/FileField'
import { useApp } from '../../store/app'
import { useDownloads } from '../../store/downloads'
import { useModels } from '../../store/models'
import { engine } from '../../lib/ipc'
import { formatBytes } from '../../lib/format'
import { failed } from '../../lib/notify'

const ROLE_CONFIG_KEY: Partial<Record<CompanionRole, keyof Pick<ImageModelConfig, 'vae' | 'tae' | 'clipL' | 'clipG' | 't5xxl' | 'llm' | 'llmVision'>>> = {
  vae: 'vae',
  tae: 'tae',
  clipL: 'clipL',
  clipG: 'clipG',
  t5xxl: 't5xxl',
  llm: 'llm',
  llmVision: 'llmVision'
}

const filenameOf = (p: string): string => (p.split(/[\\/]/).pop() ?? p).toLowerCase()

function findLocalFile(models: ModelEntry[], packFile: VerifiedPackFile): ModelEntry | null {
  const want = filenameOf(packFile.targetRel)
  return models.find((m) => !m.remote && filenameOf(m.path) === want && (m.sizeBytes === 0 || m.sizeBytes === packFile.sizeBytes)) ?? null
}

function PackCard({
  pack,
  folder,
  localModels
}: {
  pack: VerifiedImagePack
  folder: string | null
  localModels: ModelEntry[]
}) {
  const downloads = useDownloads((s) => s.list)
  const [variantId, setVariantId] = useState(pack.variants[0]?.id ?? '')
  const variant: VerifiedPackVariant = useMemo(
    () => pack.variants.find((v) => v.id === variantId) ?? pack.variants[0],
    [pack.variants, variantId]
  )

  const resolved = useMemo(
    () =>
      variant.files.map((f) => ({
        file: f,
        local: findLocalFile(localModels, f)
      })),
    [variant, localModels]
  )

  const missing = resolved.filter((r) => !r.local).map((r) => r.file)
  const missingBytes = missing.reduce((s, f) => s + f.sizeBytes, 0)
  const mainItem = resolved.find((r) => r.file.role === 'model')
  const packKey = `pack:${pack.id}:${variant.id}`
  const queued = downloads.some((d) => d.repo === pack.id && d.file === packKey && d.state !== 'failed')

  const buildImageConfig = (): Partial<ImageModelConfig> => {
    const cfg: Partial<ImageModelConfig> = { ...pack.defaults }
    for (const r of resolved) {
      const slot = ROLE_CONFIG_KEY[r.file.role]
      if (slot && r.local) cfg[slot] = r.local.id
    }
    return cfg
  }

  const wireExisting = () => {
    if (!mainItem?.local) return
    void engine('models.imageConfig.set', { id: mainItem.local.id, patch: buildImageConfig() }).catch(failed('Could not apply pack settings'))
  }

  const startPack = () => {
    if (missing.length === 0) return wireExisting()
    const entries: DownloadBundleFile[] = missing.map((f) => ({
      repo: f.repo,
      file: f.file,
      size: f.sizeBytes,
      role: f.role,
      targetRel: f.targetRel
    }))
    void engine('downloads.start', {
      repo: pack.id,
      file: packKey,
      name: `${pack.name} (${variant.label.split('(')[0].trim()})`,
      folder: folder ?? '',
      total: missingBytes,
      files: entries,
      imageConfig: buildImageConfig(),
      ...(mainItem?.local ? { targetModelId: mainItem.local.id } : {})
    }).catch(failed(`Could not queue ${pack.name}`))
  }

  return (
    <SettingCard
      title={pack.name}
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge tone="idle">{pack.category}</StatusBadge>
          {missing.length === 0 ? (
            <Button size="sm" variant="secondary" icon={<Check />} onClick={wireExisting}>
              Installed · Configure slots
            </Button>
          ) : (
            <Button size="sm" variant={queued ? 'secondary' : 'primary'} icon={<Download />} disabled={queued || !folder} onClick={startPack}>
              {queued ? 'In downloads' : `Download (${missing.length} ${missing.length === 1 ? 'file' : 'files'} · ${formatBytes(missingBytes)})`}
            </Button>
          )}
        </div>
      }
    >
      <div className="px-3.5 py-2 text-[12.5px] text-subtle">{pack.tagline}</div>
      {pack.variants.length > 1 && (
        <SettingRow label="Variant" hint={variant.vramHint}>
          <Select
            value={variant.id}
            options={pack.variants.map((v) => ({ value: v.id, label: v.label }))}
            onChange={setVariantId}
            className="w-72"
          />
        </SettingRow>
      )}
      {pack.variants.length === 1 && (
        <SettingRow label="Profile" hint={variant.vramHint}>
          <span className="font-mono text-[12px] text-white/90">{variant.label}</span>
        </SettingRow>
      )}
      {resolved.map(({ file, local }) => (
        <SettingRow
          key={`${file.repo}/${file.file}`}
          label={file.label}
          hint={`${file.repo} · ${file.targetRel} · ${formatBytes(file.sizeBytes)}`}
          aside={<span className="font-mono text-[11px] text-faint">{file.flag}</span>}
        >
          {local ? <StatusBadge tone="ok">On disk</StatusBadge> : <StatusBadge tone="idle">Queued on download</StatusBadge>}
        </SettingRow>
      ))}
    </SettingCard>
  )
}

export function ImagePacksView({ filterText }: { filterText: string }) {
  const folders = useApp((s) => s.settings?.modelFolders) ?? []
  const [folder, setFolder] = useState<string | null>(folders[0] ?? null)
  const localModels = useModels((s) => s.list)

  useEffect(() => {
    if (!folder && folders.length) setFolder(folders[0])
  }, [folders.length])

  const shown = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return VERIFIED_IMAGE_PACKS
    return VERIFIED_IMAGE_PACKS.filter((p) => `${p.name} ${p.category} ${p.tagline} ${p.id}`.toLowerCase().includes(q))
  }, [filterText])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center gap-3 border border-line bg-panel px-3.5 py-2.5 text-[12.5px]">
        <Layers className="h-4 w-4 shrink-0 text-accent" />
        <div className="min-w-0 flex-1 text-subtle">
          Verified <span className="font-mono text-white">sd-server</span> packs: exact diffusion weights, compatible VAE, matching text encoder / <span className="font-mono">--llm_vision</span>, and tested defaults. Shared files like <span className="font-mono">ae.safetensors</span> and <span className="font-mono">Qwen3-4B</span> are automatically reused without re-downloading.
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-faint">Save to</span>
          <Select value={folder ?? ''} options={folders.map((f) => ({ value: f, label: f }))} onChange={setFolder} className="w-60 font-mono text-[12px]" />
        </div>
      </div>
      {!folder && (
        <AlertBox>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>No models folder is set. Choose where downloaded packs should be saved.</span>
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
      {shown.length === 0 ? (
        <AlertBox>No verified packs match "{filterText}".</AlertBox>
      ) : (
        shown.map((pack) => <PackCard key={pack.id} pack={pack} folder={folder} localModels={localModels} />)
      )}
    </div>
  )
}
