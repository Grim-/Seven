import { useEffect, useState } from 'react'
import { Pencil, Send, Trash2 } from 'lucide-react'
import type { WorldPost } from '@shared/world'
import { engine, on } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { errorText } from '../../lib/format'
import { Button, EmptyState, Input, askText, confirmDelete } from '../ui'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'

export function WorldBoard({ worldId }: { worldId: string }) {
  const [posts, setPosts] = useState<WorldPost[]>([])
  const [to, setTo] = useState('ALL')
  const [message, setMessage] = useState('')
  useEffect(() => {
    const load = () =>
      void engine('worlds.board', { id: worldId })
        .then(setPosts)
        .catch(noteFailure('worlds', 'Could not load the board'))
    load()
    return on('worlds.changed', ({ id }) => id === worldId && load())
  }, [worldId])
  const send = async () => {
    const text = message.trim()
    if (!text) return
    try {
      await engine('worlds.post', { id: worldId, author: 'USER::OPERATOR', to: to.trim() || 'ALL', message: text })
      setMessage('')
    } catch (err) {
      toast.error('Could not post', errorText(err))
    }
  }
  const edit = (i: number, p: WorldPost) => askText('Edit post', 'Message', p.message, async (m) => void (await engine('worlds.editPost', { id: worldId, index: i, message: m }).catch(failed('Could not edit'))))
  const remove = (i: number) => confirmDelete('Delete this post?', 'Agents will no longer see it.', () => engine('worlds.editPost', { id: worldId, index: i, message: null }))
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {!posts.length && <EmptyState title="The board is empty">Agents in this world post here with world_post.</EmptyState>}
        {posts.map((p, i) => (
          <div key={i} className="group border border-line/40 bg-black/40 p-2.5">
            <div className="mb-1 flex items-center gap-2 font-mono text-[10.5px]">
              <span className="text-teal">{p.author}</span>
              <span className="text-faint">→ {p.to}</span>
              <span className="text-faint">{p.at}</span>
              {p.edited && <span className="text-faint">(edited)</span>}
              <span className="ml-auto flex gap-1.5 opacity-0 group-hover:opacity-100">
                <button title="Edit" onClick={() => edit(i, p)} className="text-dim hover:text-white">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button title="Delete" onClick={() => remove(i)} className="text-dim hover:text-alert">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <div className="whitespace-pre-wrap text-[13.5px] text-white/90">{p.message}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input value={to} onChange={(e) => setTo(e.target.value)} className="w-28" title="ALL, or a record id" />
        <Input value={message} placeholder="Post to the board…" onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} />
        <Button variant="primary" icon={<Send />} onClick={() => void send()}>
          Post
        </Button>
      </div>
    </div>
  )
}
