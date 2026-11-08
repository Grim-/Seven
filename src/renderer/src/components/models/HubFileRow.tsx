import { useEffect } from 'react'
import { Download } from 'lucide-react'
import { MODEL_KINDS, type HubFile, type SystemStats } from '@shared/types'
import { Button, SettingRow, TraitChips } from '../ui'
import { headerKey, useHub } from '../../store/hub'
import { useDownloads } from '../../store/downloads'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { formatBytes, formatCount } from '../../lib/format'
import { memoryFit } from './memoryFit'
import { modelTraits } from './ModelTraits'

export function HubFileRow({ repo, file, folder, stats }: { repo: string; file: HubFile; folder: string | null; stats: SystemStats | null }) {
  const header = useHub((s) => s.headers[headerKey(repo, file.file)])
  const loadHeader = useHub((s) => s.loadHeader)
  const queued = useDownloads((s) => s.list.some((d) => d.repo === repo && d.file === file.file && d.state !== 'failed'))
  useEffect(() => {
    void loadHeader(repo, file.file)
  }, [repo, file.file])
  const info = header?.value ?? null
  if (info && (!MODEL_KINDS[info.kind].listed || (info.split && info.split.part > 0))) return null
  const bytes = info?.sizeBytes ?? file.fileBytes
  const fit = info ? memoryFit(bytes, stats) : null
  const hint = [formatBytes(bytes), info?.split ? `${info.split.parts} parts` : null, info?.contextLength ? `${formatCount(info.contextLength)} context` : null, file.name].filter(Boolean).join(' · ')
  const start = () => void engine('downloads.start', { repo, file: file.file, name: file.name, folder: folder ?? '', total: bytes }).catch(failed('Could not start the download'))
  const traits = [
    ...(fit ? [{ key: 'fit', label: fit.label, tone: fit.tone, hint: fit.hint }] : []),
    ...modelTraits(info, bytes).filter((t) => t.key !== 'quant'),
    ...(!header ? [{ key: 'reading', label: 'Reading header', tone: 'busy' as const }] : []),
    ...(header?.error ? [{ key: 'error', label: 'Header unreadable', tone: 'error' as const, hint: header.error }] : [])
  ]
  return (
    <SettingRow label={info?.quant ?? file.name} hint={hint} aside={<TraitChips traits={traits} />}>
      <Button size="sm" variant={queued ? 'secondary' : 'badge'} icon={<Download />} disabled={queued || !folder || !info} onClick={start}>
        {queued ? 'In downloads' : 'Download'}
      </Button>
    </SettingRow>
  )
}
