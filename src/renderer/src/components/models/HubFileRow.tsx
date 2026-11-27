import { useEffect } from 'react'
import { Download } from 'lucide-react'
import { MODEL_KINDS, type HubFile, type ModelKind, type SystemStats } from '@shared/types'
import { Button, SettingRow, TraitChips } from '../ui'
import { headerKey, useHub } from '../../store/hub'
import { useDownloads } from '../../store/downloads'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { formatBytes, formatCount } from '../../lib/format'
import { memoryFit } from './memoryFit'
import { modelTraits } from './ModelTraits'

const SHARD_PART = /-(\d{5})-of-(\d{5})\.(?:gguf|safetensors|sft)$/i

export function HubFileRow({
  repo,
  file,
  folder,
  stats,
  allowCompanions = false,
  expectedKind,
  selected,
  onToggleSelect
}: {
  repo: string
  file: HubFile
  folder: string | null
  stats: SystemStats | null
  allowCompanions?: boolean
  expectedKind?: ModelKind
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const header = useHub((s) => s.headers[headerKey(repo, file.file)])
  const loadHeader = useHub((s) => s.loadHeader)
  const queued = useDownloads((s) => s.list.some((d) => d.repo === repo && d.file === file.file && d.state !== 'failed'))

  const shardMatch = file.file.match(SHARD_PART)
  const shardPart = shardMatch ? Number(shardMatch[1]) : 0
  const shardCount = shardMatch ? Number(shardMatch[2]) : 0

  useEffect(() => {
    if (shardPart <= 1) void loadHeader(repo, file.file)
  }, [repo, file.file, shardPart])

  const info = header?.value ?? null
  const isCompanion = info ? info.kind === 'vae' || info.kind === 'text_encoder' || info.kind === 'lora' || info.kind === 'projector' : false

  if (shardPart > 1) return null
  if (info && ((!MODEL_KINDS[info.kind].listed && !(allowCompanions && isCompanion)) || (info.split && info.split.part > 0))) return null

  const bytes = info?.sizeBytes ?? file.fileBytes
  const fit = info ? memoryFit(bytes, stats) : null
  const partsNote = info?.split ? `${info.split.parts} parts` : shardCount > 1 ? `${shardCount} parts` : null
  const hint = [formatBytes(bytes), partsNote, info?.contextLength ? `${formatCount(info.contextLength)} context` : null, file.file].filter(Boolean).join(' · ')

  const startSingle = () =>
    void engine('downloads.start', {
      repo,
      file: file.file,
      name: file.name,
      folder: folder ?? '',
      total: bytes,
      ...(expectedKind ? { expectedKind } : {})
    }).catch(failed('Could not start the download'))

  const traits = [
    ...(fit ? [{ key: 'fit', label: fit.label, tone: fit.tone, hint: fit.hint }] : []),
    ...modelTraits(info, bytes).filter((t) => t.key !== 'quant'),
    ...(!header ? [{ key: 'reading', label: 'Checking', tone: 'busy' as const }] : []),
    ...(header?.error ? [{ key: 'error', label: 'Unprobed', tone: 'warn' as const, hint: `${header.error} (download still works)` }] : [])
  ]

  return (
    <SettingRow label={info?.quant ?? file.name} hint={hint} aside={<TraitChips traits={traits} />}>
      <div className="flex items-center gap-2">
        {onToggleSelect && (
          <input
            type="checkbox"
            aria-label={`Select ${file.name}`}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-accent"
            checked={Boolean(selected)}
            onChange={onToggleSelect}
          />
        )}
        <Button size="sm" variant={queued ? 'secondary' : 'badge'} icon={<Download />} disabled={queued || !folder} onClick={startSingle}>
          {queued ? 'In downloads' : 'Download'}
        </Button>
      </div>
    </SettingRow>
  )
}
