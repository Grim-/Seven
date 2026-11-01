import { Pause, Play, RotateCcw, X } from 'lucide-react'
import type { DownloadItem } from '@shared/types'
import { Button, SegmentBar, SettingCard, SettingRow, StatusBadge, type Tone } from '../ui'
import { useDownloads } from '../../store/downloads'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { formatBytes, formatDuration } from '../../lib/format'

const STATE: Record<DownloadItem['state'], { label: string; tone: Tone }> = {
  queued: { label: 'Queued', tone: 'idle' },
  downloading: { label: 'Downloading', tone: 'busy' },
  paused: { label: 'Paused', tone: 'warn' },
  done: { label: 'Done', tone: 'ok' },
  failed: { label: 'Failed', tone: 'error' }
}

function progressText(d: DownloadItem): string {
  if (d.state === 'done') return d.path ?? d.folder
  const amount = `${formatBytes(d.received)} of ${formatBytes(d.total)}`
  if (d.state !== 'downloading') return amount
  return [amount, d.speed ? `${formatBytes(d.speed)}/s` : null, d.secondsLeft !== null ? `${formatDuration(d.secondsLeft)} left` : null].filter(Boolean).join(' · ')
}

function DownloadRow({ d }: { d: DownloadItem }) {
  const act = (name: 'downloads.pause' | 'downloads.resume' | 'downloads.cancel') => void engine(name, { id: d.id }).catch(failed('Could not change the download'))
  return (
    <SettingRow wide label={d.name} hint={progressText(d)} error={d.state === 'failed' ? d.error : null} aside={<StatusBadge tone={STATE[d.state].tone}>{STATE[d.state].label}</StatusBadge>}>
      <div className="flex w-full items-center gap-2">
        <SegmentBar value={d.total ? d.received / d.total : 0} className="min-w-0 flex-1" />
        {d.state === 'downloading' && (
          <Button size="sm" variant="ghost" icon={<Pause />} onClick={() => act('downloads.pause')}>
            Pause
          </Button>
        )}
        {(d.state === 'paused' || d.state === 'failed') && (
          <Button size="sm" variant="ghost" icon={d.state === 'failed' ? <RotateCcw /> : <Play />} onClick={() => act('downloads.resume')}>
            {d.state === 'failed' ? 'Retry' : 'Resume'}
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<X />} onClick={() => act('downloads.cancel')}>
          {d.state === 'done' ? 'Dismiss' : 'Cancel'}
        </Button>
      </div>
    </SettingRow>
  )
}

export function DownloadsCard() {
  const list = useDownloads((s) => s.list)
  if (!list.length) return null
  return (
    <SettingCard
      className="shrink-0"
      title="Downloads"
      count={list.length}
      actions={
        list.some((d) => d.state === 'done') && (
          <Button size="sm" variant="ghost" onClick={() => void engine('downloads.clear').catch(failed('Could not clear finished downloads'))}>
            Clear finished
          </Button>
        )
      }
    >
      {list.map((d) => (
        <DownloadRow key={d.id} d={d} />
      ))}
    </SettingCard>
  )
}
