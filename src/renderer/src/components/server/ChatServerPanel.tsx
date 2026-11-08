import { Power, RotateCcw } from 'lucide-react'
import type { ServerStatus } from '@shared/types'
import { Button, Fact, FactGrid, LogBox, Panel } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { formatBytes, formatRelative } from '../../lib/format'

export function ChatServerPanel({ status, onChange }: { status: ServerStatus; onChange: () => void }) {
  const chat = status.chat
  const act = (name: 'server.stop' | 'server.restart', what: string) => void engine(name).then(onChange).catch(failed(what))
  return (
    <Panel title="Chat model" bodyClassName="flex flex-col gap-3 p-3">
      <FactGrid>
        <Fact label="llama-server">{status.installed ?? 'Not installed'}</Fact>
        <Fact label="State">{chat ? (chat.writing ? 'Running, writing now' : 'Running, idle') : 'Not running'}</Fact>
        <Fact label="Model">{chat?.modelName ?? '—'}</Fact>
        <Fact label="Process">{chat?.pid ?? '—'}</Fact>
        <Fact label="Started">{chat ? formatRelative(chat.startedAt) : '—'}</Fact>
        <Fact label="Context">{chat?.contextSize ? chat.contextSize.toLocaleString() : '—'}</Fact>
        <Fact label="Device">{chat?.device ?? '—'}</Fact>
        <Fact label="GPU layers">{chat?.offload ? `${chat.offload.gpu} of ${chat.offload.total}` : '—'}</Fact>
        <Fact label="VRAM">{status.vram ? `${formatBytes(status.vram.used)} of ${formatBytes(status.vram.total)}` : '—'}</Fact>
        <Fact label="MTP">{chat ? (chat.mtp ? (chat.last?.drafted ? `On, ${Math.round(((chat.last.accepted ?? 0) / chat.last.drafted) * 100)}% of drafts accepted` : 'On, no drafts yet') : 'Off') : '—'}</Fact>
        <Fact label="Vision">{chat ? (chat.vision ? 'On' : 'Off') : '—'}</Fact>
        <Fact label="Last reply">{chat?.last ? `${chat.last.genTps?.toFixed(1) ?? '—'} tok/s writing, ${chat.last.promptTps?.toFixed(1) ?? '—'} tok/s reading` : '—'}</Fact>
        {chat && (
          <Fact label="Command line" wide>
            <span className="font-mono text-[11.5px]">{chat.args.join(' ')}</span>
          </Fact>
        )}
      </FactGrid>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" icon={<RotateCcw />} disabled={!chat} onClick={() => act('server.restart', 'Could not restart llama-server')}>
          Restart
        </Button>
        <Button size="sm" variant="ghost" icon={<Power />} disabled={!chat} onClick={() => act('server.stop', 'Could not stop llama-server')}>
          Stop
        </Button>
      </div>
      <LogBox lines={chat?.log ?? []} empty={`The last ${status.logLines} lines llama-server writes show here.`} />
    </Panel>
  )
}
