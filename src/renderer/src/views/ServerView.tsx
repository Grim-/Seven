import { useState, type ReactNode } from 'react'
import { SettingCard, SettingsBrowser, SaveState, ViewHeader, type BrowserSection } from '../components/ui'
import { useServerStatus } from '../components/server/useServerStatus'
import { ChatServerPanel } from '../components/server/ChatServerPanel'
import { MemoryServerPanel } from '../components/server/MemoryServerPanel'
import { NetworkPanel } from '../components/server/NetworkPanel'
import { useInstallHelper } from '../components/install/useInstallHelper'
import { useHelperSettings, settingKeys, settingMatches, settingSections } from '../components/install/useHelperSettings'
import { HelperBar } from '../components/install/HelperBar'
import { VersionList } from '../components/install/VersionList'
import { InstallWizard } from '../components/install/wizard/InstallWizard'
import { ParamRows } from '../components/game/ParamRows'
import { useViewPlace } from '../lib/viewPlace'
import type { InstallHelperState, InstallProgress, NetworkStatus, ServerStatus } from '@shared/types'

const LLAMA_SERVER = 'llama-server'
interface ServerPage extends BrowserSection {
  body: () => ReactNode
}

function ServerPages({ state, progress, status, network, reload }: { state: InstallHelperState; progress: InstallProgress | null; status: ServerStatus; network: NetworkStatus | null; reload: () => void }) {
  const settings = useHelperSettings(state)
  const [page, setPage] = useViewPlace('server.page', 'running')
  const [query, setQuery] = useState('')
  const [installing, setInstalling] = useState(false)
  const settingsCard = (title: string, keys: string[]) => (
    <SettingCard title={title} actions={<SaveState status={settings.status} error={settings.error} />}>
      <ParamRows schema={state.schema} keys={keys} values={settings.value} onChange={settings.set} moreLabel={`More ${title.toLowerCase()} settings`} />
    </SettingCard>
  )
  const pages: ServerPage[] = [
    {
      id: 'running',
      label: 'Running',
      count: [status.chat, status.memory.running].filter(Boolean).length,
      body: () => (
        <>
          <ChatServerPanel status={status} onChange={reload} />
          <MemoryServerPanel status={status} />
        </>
      )
    },
    { id: 'versions', label: 'Versions', count: state.versions.length, body: () => <VersionList state={state} /> },
    { id: 'network', label: 'Network', hint: network?.on ? 'On' : 'Off', body: () => (network ? <NetworkPanel network={network} /> : null) },
    ...settingSections(state).map((s) => ({ id: `settings:${s}`, label: s, group: 'Settings', body: () => settingsCard(s, settingKeys(state, s)) }))
  ]
  const current = pages.find((p) => p.id === page) ?? pages[0]
  const found = settingMatches(state, query)
  const pick = (id: string) => {
    setQuery('')
    setPage(id)
  }
  return (
    <>
      <HelperBar state={state} onInstall={() => setInstalling(true)} />
      <SettingsBrowser sections={pages} current={query.trim() ? null : current.id} onPick={pick} query={query} onQuery={setQuery} placeholder="Search llama-server settings">
        {!query.trim() ? current.body() : found.length ? settingsCard('Matching settings', found) : <div className="text-[12.5px] text-faint">No setting matches "{query.trim()}".</div>}
      </SettingsBrowser>
      <InstallWizard state={state} progress={progress} open={installing} onClose={() => setInstalling(false)} />
    </>
  )
}

export function ServerView() {
  const { status, network, reload } = useServerStatus(2000)
  const { state, progress } = useInstallHelper(LLAMA_SERVER)
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader title="llama-server" subtitle="The installed versions, what the model servers are doing, and access from other devices on your network." />
      {status && state && <ServerPages state={state} progress={progress} status={status} network={network} reload={reload} />}
    </div>
  )
}
