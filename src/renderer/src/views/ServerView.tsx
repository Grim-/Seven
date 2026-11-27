import { useState, type ReactNode } from 'react'
import { Download, Power, Sparkles, X } from 'lucide-react'
import { Button, Fact, FactGrid, Fold, LogBox, SettingCard, SettingsBrowser, SaveState, Segmented, StatusBadge, ViewHeader, type BrowserSection } from '../components/ui'
import { useServerStatus } from '../components/server/useServerStatus'
import { ChatServerPanel } from '../components/server/ChatServerPanel'
import { MemoryServerPanel } from '../components/server/MemoryServerPanel'
import { NetworkPanel } from '../components/server/NetworkPanel'
import { useInstallHelper } from '../components/install/useInstallHelper'
import { useHelperSettings, settingKeys, settingMatches, settingSections } from '../components/install/useHelperSettings'
import { ParamRows } from '../components/game/ParamRows'
import { generateImage } from '../components/pictures/GenerateImageModal'
import { useImageHost } from '../store/image'
import { formatRelative } from '../lib/format'
import { chatSwapNotice, describeImageProgress } from '../lib/imageHostProgress'
import { openHelperInstaller } from '../lib/openServer'
import { failed } from '../lib/notify'
import { useViewPlace } from '../lib/viewPlace'
import type { InstallHelperState, NetworkStatus, ServerStatus } from '@shared/types'

const LLAMA_SERVER = 'llama-server'
const SD_SERVER = 'sd-server'
const SERVERS = [
  { value: LLAMA_SERVER, label: 'llama-server (Chat & Memory)' },
  { value: SD_SERVER, label: 'sd-server (Image Generation)' }
]

interface ServerPage extends BrowserSection {
  body: () => ReactNode
}

function ImageServerPanel({ state }: { state: InstallHelperState }) {
  const { host, unload, cancel } = useImageHost()
  const busy = host.status === 'loading' || host.status === 'generating'
  const tone = host.status === 'error' ? 'error' : busy ? 'busy' : host.status === 'ready' ? 'ok' : 'idle'
  const swapNotice = chatSwapNotice(state.settings.autoSwapChatModel)
  const keepLoaded = Boolean(state.settings.keepServerLoaded)
  const progressInfo = describeImageProgress(host, host.modelName)
  return (
    <SettingCard
      title="Image diffusion server"
      actions={
        <>
          <Button size="sm" variant="primary" icon={<Sparkles />} onClick={() => void generateImage()}>
            Generate image…
          </Button>
          {busy && (
            <Button size="sm" variant="ghost" icon={<X />} onClick={() => void cancel().catch(failed('Could not cancel sd-server'))}>
              Cancel
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<Power />} disabled={host.status === 'unloaded' && !host.pid} onClick={() => void unload().catch(failed('Could not stop sd-server'))}>
            Stop
          </Button>
        </>
      }
    >
      <div className="p-3.5">
        <FactGrid>
          <Fact label="State">
            <StatusBadge tone={tone}>{host.status}</StatusBadge>
          </Fact>
          <Fact label="Model">{host.modelName ?? '—'}</Fact>
          <Fact label="Residency">{host.status === 'unloaded' ? (keepLoaded ? 'Keep loaded when used' : 'Stops after each job') : host.residency === 'resident' ? 'Resident (stays warm)' : 'Ephemeral (stops after job)'}</Fact>
          <Fact label="Version">{host.version ?? '—'}</Fact>
          <Fact label="Process">{host.pid ?? '—'}</Fact>
          <Fact label="Started">{host.startedAt ? formatRelative(host.startedAt) : '—'}</Fact>
          <Fact label="Queue">{host.busyCount}</Fact>
          {busy && <Fact label="Progress" wide>{progressInfo.text}</Fact>}
          <Fact label="Low-RAM chat policy" wide>{swapNotice ?? 'Manual (keeps llama-server loaded)'}</Fact>
        </FactGrid>
      </div>
      {host.args.length > 0 && (
        <Fold label="Command line">
          <div className="px-3.5 pb-3 font-ui text-[11.5px] text-ink/85">{host.args.join(' ')}</div>
        </Fold>
      )}
      <Fold label="Log" count={host.log.length}>
        <div className="px-3.5 pb-3">
          <LogBox lines={host.log} empty="sd-server logs appear here once an image model loads." />
        </div>
      </Fold>
    </SettingCard>
  )
}

function ServerPages({ kind, state, status, network, reload }: { kind: string; state: InstallHelperState; status: ServerStatus | null; network: NetworkStatus | null; reload: () => void }) {
  const settings = useHelperSettings(state)
  const [page, setPage] = useViewPlace(`server.page.${kind}`, 'running')
  const [query, setQuery] = useState('')
  const isLlama = kind === LLAMA_SERVER
  const imageHost = useImageHost((s) => s.host)
  const settingsCard = (title: string, keys: string[]) => (
    <SettingCard title={title} actions={<SaveState status={settings.status} error={settings.error} />}>
      <ParamRows schema={state.schema} keys={keys} values={settings.value} onChange={settings.set} moreLabel={`More ${title.toLowerCase()} settings`} />
    </SettingCard>
  )
  const pages: ServerPage[] = [
    {
      id: 'running',
      label: 'Running',
      count: isLlama ? [status?.chat, status?.memory.running].filter(Boolean).length : imageHost.status === 'ready' || imageHost.status === 'generating' ? 1 : 0,
      body: () =>
        isLlama ? (
          status ? (
            <>
              <ChatServerPanel status={status} onChange={reload} />
              <MemoryServerPanel status={status} />
            </>
          ) : null
        ) : (
          <ImageServerPanel state={state} />
        )
    },
    ...(isLlama ? [{ id: 'network', label: 'Network', hint: network?.on ? 'On' : 'Off', body: () => (network ? <NetworkPanel network={network} /> : null) }] : []),
    ...settingSections(state).map((s) => ({ id: `settings:${s}`, label: s, group: 'Settings', body: () => settingsCard(s, settingKeys(state, s)) }))
  ]
  const current = pages.find((p) => p.id === page) ?? pages[0]
  const found = settingMatches(state, query)
  const pick = (id: string) => {
    setQuery('')
    setPage(id)
  }
  return (
    <SettingsBrowser sections={pages} current={query.trim() ? null : current.id} onPick={pick} query={query} onQuery={setQuery} placeholder={`Search ${state.title} settings`} wide>
      {!query.trim() ? current.body() : found.length ? settingsCard('Matching settings', found) : <div className="text-[12.5px] text-faint">No setting matches "{query.trim()}".</div>}
    </SettingsBrowser>
  )
}

export function ServerView() {
  const [serverKind, setServerKind] = useViewPlace('server.kind', LLAMA_SERVER)
  const { status, network, reload } = useServerStatus(2000)
  const { state } = useInstallHelper(serverKind)
  const active = state?.versions.find((v) => v.id === state.active)
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader
        title={serverKind === SD_SERVER ? 'sd-server' : 'llama-server'}
        subtitle={active ? `Active binary: ${active.label}` : 'No active binary installed yet — install or select one in Settings.'}
        actions={
          <>
            <Segmented value={serverKind} options={SERVERS} onChange={setServerKind} />
            <Button size="sm" variant="ghost" icon={<Download />} onClick={() => openHelperInstaller(serverKind === SD_SERVER ? SD_SERVER : LLAMA_SERVER)}>
              Helper installers…
            </Button>
          </>
        }
      />
      {state && (serverKind === SD_SERVER || status) && <ServerPages kind={serverKind} state={state} status={status} network={network} reload={reload} />}
    </div>
  )
}
