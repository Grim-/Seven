import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { EngineResult } from '@shared/protocol'
import { Button, SettingCard, SettingRow } from '../../components/ui'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { rebuildIndex } from '../../store/data'
import { useBusy } from '../../lib/useBusy'
import { DataControlPanel } from '../../components/datacontrol/DataControl'

function FileCheck() {
  const [result, setResult] = useState<EngineResult<'data.check'> | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      setResult(await engine('data.check'))
    } catch (err) {
      toast.error('Check failed', errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <SettingRow wide label="Check files" hint="Reads every file in the data folder and lists any that can't be opened or decrypted.">
      <div className="flex w-full flex-col gap-2">
        <div>
          <Button variant="secondary" disabled={busy} onClick={() => void run()}>
            {busy ? 'Checking…' : 'Check files'}
          </Button>
        </div>
        {result && (
          <div className="flex flex-col gap-1 border border-line/50 bg-black/40 p-2.5 font-mono text-[11.5px]">
            <span className={result.failed.length ? 'text-alert' : 'text-ok'}>
              {result.checked} files: {result.sealed} encrypted, {result.plain} plain, {result.failed.length} with problems
            </span>
            {result.failed.map((f) => (
              <span key={f.file} className="break-all text-white/85">
                <span className="text-accent">{f.file}</span>: {f.error}
              </span>
            ))}
          </div>
        )}
      </div>
    </SettingRow>
  )
}

function RebuildIndex() {
  const [busy, run] = useBusy()
  return (
    <SettingRow label="Search index" hint="Seven keeps a list of every page and file so the Data view and search open fast. It updates itself as things change; rebuild it if something is missing or shows twice.">
      <div>
        <Button variant="secondary" icon={<RefreshCw />} disabled={busy} onClick={() => void run(async () => (await rebuildIndex(), toast.success('Index rebuilt')), 'Could not rebuild the index')}>
          {busy ? 'Rebuilding…' : 'Rebuild index'}
        </Button>
      </div>
    </SettingRow>
  )
}

export function Upkeep() {
  return (
    <>
      <DataControlPanel />
      <SettingCard title="Upkeep">
        <RebuildIndex />
        <FileCheck />
      </SettingCard>
    </>
  )
}
