import { Power, RotateCcw } from 'lucide-react'
import type { ServerStatus } from '@shared/types'
import { Button, Fact, FactGrid, Fold, LogBox, SettingCard } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { formatBytes, formatRelative } from '../../lib/format'

export function ChatServerPanel({ status, onChange }: { status: ServerStatus; onChange: () => void }) {
  const chat = status.chat
  const act = (name: 'server.stop' | 'server.restart', what: string) => void engine(name).then(onChange).catch(failed(what))
  return (
    <SettingCard
      title="Chat model"
      actions={
        <>
          <Button size="sm" variant="ghost" icon={<RotateCcw />} disabled={!chat} onClick={() => act('server.restart', 'Could not restart llama-server')}>
            Restart
          </Button>
          <Button size="sm" variant="ghost" icon={<Power />} disabled={!chat} onClick={() => act('server.stop', 'Could not stop llama-server')}>
            Stop
          </Button>
        </>
      }
    >
      <div className="p-3.5">
        <FactGrid>
          <Fact label="Active version">{status.build?.label ?? 'None'}</Fact>
          <Fact label="Running version">{chat ? (chat.version === status.build?.version ? 'The active one' : `${chat.version}. Restart to use the active one.`) : '—'}</Fact>
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

        </FactGrid>
      </div>
      {chat && (
        <Fold label="Command line">
          <div className="px-3.5 pb-3 font-mono text-[11.5px] text-white/85">{chat.args.join(' ')}</div>
        </Fold>
      )}
      <Fold label="Log" count={chat?.log.length ?? 0}>
        <div className="px-3.5 pb-3">
          <LogBox lines={chat?.log ?? []} empty={`The last ${status.logLines} lines llama-server writes show here.`} />
        </div>
      </Fold>
    </SettingCard>
  )
}
