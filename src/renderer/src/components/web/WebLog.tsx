import { useEffect, useState } from 'react'
import { Copy, Globe, RefreshCw } from 'lucide-react'
import type { WebLogEntry } from '@shared/types'
import { Button, EmptyState, Panel, openMenu } from '../ui'
import { showBrowser } from '../side/BrowserTab'
import { AgentAvatar } from '../agents/look'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { useAgents } from '../../store/agents'
import { cn } from '../../lib/cn'
import { copyText } from '../../lib/notify'

const OUTCOME: Record<WebLogEntry['outcome'], { label: string; className: string }> = {
  allowed: { label: 'You allowed', className: 'text-ok' },
  auto: { label: 'Allowed site', className: 'text-secondary' },
  denied: { label: 'You declined', className: 'text-faint' },
  blocked: { label: 'Blocked', className: 'text-alert' },
  failed: { label: 'Failed', className: 'text-alert' }
}

export function WebLog() {
  const agents = useAgents((s) => s.list)
  const [list, setList] = useState<WebLogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = () =>
    engine('weblog.list')
      .then((l) => (setList(l), setError(null)))
      .catch((err) => setError(errorText(err)))
  useEffect(() => {
    void load()
  }, [])
  return (
    <Panel
      className="flex-1"
      title="Web log"
      meta={list ? `#${list.length}` : undefined}
      actions={
        <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => void load()}>
          Refresh
        </Button>
      }
      bodyClassName="flex flex-col overflow-y-auto p-3"
    >
      <p className="mb-2 text-[12.5px] text-dim">Every search and page the Web module asked for, newest first, with what happened. Kept in the vault.</p>
      {error && <div className="font-ui text-[11px] text-alert">{error}</div>}
      {list && !list.length && <EmptyState title="Nothing yet">Searches and pages show here once an agent with the Web module uses them.</EmptyState>}
      {list?.map((e, i) => {
        const agent = agents.find((a) => a.id === e.agentId)
        const o = OUTCOME[e.outcome]
        return (
          <div
            key={i}
            onContextMenu={(ev) =>
              openMenu(ev, e.kind === 'search' ? 'Search' : 'Page', [
                ...(e.kind === 'read' ? [{ label: 'Open in the browser', icon: <Globe />, onSelect: () => showBrowser(e.target) }] : []),
                { label: e.kind === 'search' ? 'Copy search' : 'Copy address', icon: <Copy />, onSelect: () => void copyText(e.target, 'Copied', e.target) }
              ])
            }
            className="flex items-start gap-2.5 border-b border-line/30 py-2"
          >
            <AgentAvatar agent={agent} size={20} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 font-label text-[10.5px] caps-10 ">
                <span className="text-secondary/80">{new Date(e.at).toLocaleString('en-GB')}</span>
                <span className="text-accent">{e.kind === 'search' ? 'Search' : 'Page'}</span>
                <span className={cn(o.className)}>{o.label}</span>
              </div>
              <div className="break-all text-[13px] text-ink/90">{e.target}</div>
              {e.note && <div className="break-all text-[11.5px] text-faint">{e.note}</div>}
            </div>
          </div>
        )
      })}
    </Panel>
  )
}
