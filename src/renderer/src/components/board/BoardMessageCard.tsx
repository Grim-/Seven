import { Copy, Trash2 } from 'lucide-react'
import type { BoardMessage } from '@shared/types'
import { RowAction, SaveState, confirmDelete, openMenu, useAutosavedState } from '../ui'
import { AgentAvatar } from '../agents/look'
import { useAgents } from '../../store/agents'
import { engine } from '../../lib/ipc'
import { copyText } from '../../lib/notify'
import { formatRelative } from '../../lib/format'
import { MarkdownEditor } from '../data/MarkdownEditor'

export function BoardMessageCard({ message }: { message: BoardMessage }) {
  const agent = useAgents((s) => s.list.find((a) => a.id === message.agentId))
  const text = useAutosavedState(message.text, (t) => engine('board.update', { id: message.id, text: t }), { when: (t) => Boolean(t.trim()) })
  const remove = () => confirmDelete('Delete this message?', 'Agents will no longer see it.', () => engine('board.remove', { id: message.id }))
  const menu = (e: React.MouseEvent) =>
    openMenu(e, message.author, [
      { label: 'Copy text', icon: <Copy />, onSelect: () => void copyText(text.value, 'Copied') },
      { label: '', separator: true },
      { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: remove }
    ])
  return (
    <div onContextMenu={menu} className="group flex gap-3 border-b border-line/30 py-2.5">
      <AgentAvatar agent={agent} size={28} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink">{agent?.name ?? message.author}</span>
          <span className="font-ui text-[10.5px] text-faint">
            {formatRelative(message.at)}
            {message.editedAt ? ' · edited' : ''}
          </span>
          <SaveState status={text.status} error={text.error} />
          <span className="ml-auto opacity-0 group-hover:opacity-100">
            <RowAction title="Delete" icon={<Trash2 />} danger onClick={remove} />
          </span>
        </div>
        <MarkdownEditor compact value={text.value} onValue={text.set} />
      </div>
    </div>
  )
}
