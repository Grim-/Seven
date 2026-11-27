import type { InstallHelperState, InstallProgress, InstallStage } from '@shared/types'
import { ActionBar, AlertBox, SegmentBar, StatusBadge, type Tone } from '../../ui'
import { formatBytes } from '../../../lib/format'
import { versionActions } from '../versionActions'

const STAGES: Record<InstallStage, { label: string; tone: Tone; measured?: boolean; finished?: boolean }> = {
  resolve: { label: 'Reading the release', tone: 'busy' },
  download: { label: 'Downloading', tone: 'busy', measured: true },
  checksum: { label: 'Checking checksums', tone: 'busy' },
  unpack: { label: 'Unpacking', tone: 'busy' },
  verify: { label: 'Running it to check it works', tone: 'busy' },
  done: { label: 'Installed', tone: 'ok', finished: true },
  failed: { label: 'Failed', tone: 'error' },
  cancelled: { label: 'Cancelled', tone: 'warn' }
}

export function ProgressStep({ state, progress }: { state: InstallHelperState; progress: InstallProgress | null }) {
  if (!progress) return <span className="text-[12.5px] text-dim">Starting…</span>
  const stage = STAGES[progress.stage]
  const version = progress.version ? (state.versions.find((v) => v.id === progress.version) ?? null) : null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <StatusBadge tone={stage.tone}>{stage.label}</StatusBadge>
        {progress.file && <span className="truncate font-ui text-[12px] text-dim">{progress.file}</span>}
      </div>
      <SegmentBar value={stage.measured && progress.total ? progress.received / progress.total : stage.finished ? 1 : null} />
      {progress.total > 0 && <span className="font-ui text-[11.5px] text-dim">{`${formatBytes(progress.received)} of ${formatBytes(progress.total)}`}</span>}
      {progress.error && <AlertBox>{progress.error}</AlertBox>}
      {stage.finished && version && (
        <>
          {version.check?.ok ? <span className="text-[12.5px] text-ink/80">{version.label} passed its check. Make it active when you want to use it.</span> : <AlertBox>{version.check?.error ?? 'It did not pass its check.'}</AlertBox>}
          <ActionBar items={versionActions(state, version)} />
        </>
      )}
    </div>
  )
}
