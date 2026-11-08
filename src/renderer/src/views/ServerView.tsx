import { ViewHeader } from '../components/ui'
import { useServerStatus } from '../components/server/useServerStatus'
import { ChatServerPanel } from '../components/server/ChatServerPanel'
import { MemoryServerPanel } from '../components/server/MemoryServerPanel'
import { NetworkPanel } from '../components/server/NetworkPanel'

export function ServerView() {
  const { status, reload } = useServerStatus(2000)
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-5">
      <ViewHeader title="llama-server" subtitle="What the model servers are doing, and access from other devices on your network." />
      {status && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(34rem,1fr))] items-start gap-3">
          <ChatServerPanel status={status} onChange={reload} />
          <NetworkPanel network={status.network} />
          <MemoryServerPanel status={status} />
        </div>
      )}
    </div>
  )
}
