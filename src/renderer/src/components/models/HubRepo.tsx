import { useEffect, useState } from 'react'
import type { HubModel } from '@shared/types'
import { AlertBox, SecretField, Select, SettingCard, SettingRow } from '../ui'
import { useHub } from '../../store/hub'
import { useApp } from '../../store/app'
import { useSystemStats } from '../../lib/systemStats'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { formatCount } from '../../lib/format'
import { HubFileRow } from './HubFileRow'

function useHubToken(): [boolean, (token: string | null) => Promise<unknown>] {
  const [has, setHas] = useState(false)
  useEffect(() => {
    void engine('hub.token.has').then(setHas).catch(failed('Could not check the Hugging Face token'))
  }, [])
  return [has, (token) => engine('hub.token.set', { token }).then(setHas).catch(failed('Could not save the token'))]
}

export function HubRepo({ repo, model }: { repo: string; model: HubModel | null }) {
  const files = useHub((s) => s.files[repo])
  const loadFiles = useHub((s) => s.loadFiles)
  const folders = useApp((s) => s.settings?.modelFolders) ?? []
  const [folder, setFolder] = useState<string | null>(folders[0] ?? null)
  const [hasToken, saveToken] = useHubToken()
  const stats = useSystemStats(10000)
  useEffect(() => {
    void loadFiles(repo)
  }, [repo])
  useEffect(() => {
    if (!folder && folders.length) setFolder(folders[0])
  }, [folders.length])
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem] items-start gap-3 overflow-y-auto pr-1">
      <SettingCard title="Files" count={files?.value?.length}>
        {!files && <div className="px-3.5 py-3 text-[12.5px] text-faint">Listing files…</div>}
        {files?.error && <AlertBox className="m-3">{files.error}</AlertBox>}
        {files?.value?.length === 0 && <div className="px-3.5 py-3 text-[12.5px] text-faint">This repo has no GGUF files.</div>}
        {files?.value?.map((f) => <HubFileRow key={f.file} repo={repo} file={f} folder={folder} stats={stats} />)}
      </SettingCard>
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
          <SettingRow wide label="Model folder" hint={folders.length ? 'The model shows in your list when it finishes.' : 'Add a model folder under Folders in Models first.'}>
            <Select value={folder ?? ''} options={folders.map((f) => ({ value: f, label: f }))} onChange={setFolder} className="w-full font-mono text-[12px]" />
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
