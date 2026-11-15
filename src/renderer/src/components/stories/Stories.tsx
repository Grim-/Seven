import { useEffect, useState } from 'react'
import { CheckCircle2, Pause, Play, RefreshCw, Trash2, XCircle } from 'lucide-react'
import type { StoryAction, StorySummary } from '@shared/types'
import { engine, on } from '../../lib/ipc'
import { errorText, formatRelative } from '../../lib/format'
import { Button, EmptyState, Panel, askText, ListRow, confirmDelete } from '../ui'
import { Markdown } from '../chat/Markdown'
import { cn } from '../../lib/cn'
import { rowMenu } from '../../views/data/entryMenu'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'

const STATUS_STYLE: Record<StorySummary['status'], string> = {
  active: 'text-teal',
  paused: 'text-accent',
  completed: 'text-dim',
  abandoned: 'text-faint'
}

export function StoriesPanel({ initial = null }: { initial?: string | null }) {
  const [list, setList] = useState<StorySummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(initial)
  const [text, setText] = useState('')
  const load = () =>
    void engine('stories.list')
      .then(setList)
      .catch(noteFailure('stories', 'Could not list the stories', () => setList([])))
  useEffect(() => {
    load()
    const offs = [on('stories.changed', load), on('turn.finish', load)]
    return () => offs.forEach((off) => off())
  }, [])
  const story = list?.find((s) => s.id === selected) ?? null
  useEffect(() => {
    if (!selected) return setText('')
    void engine('library.read', { entry: `story/${selected}` })
      .then(setText)
      .catch((err) => setText(errorText(err)))
  }, [selected, story?.at])

  const act = (action: StoryAction, note: string | null) =>
    void engine('stories.act', { id: story!.id, action, note })
      .then(load)
      .catch(failed('Could not change the story'))
  const withNote = (action: StoryAction, title: string, label: string, confirmLabel: string) => askText(title, label, '', (note) => act(action, note.trim() || null), { optional: true, confirmLabel })
  const remove = () =>
    story &&
    confirmDelete(`Delete ${story.id}?`, 'The run and everything true in it are removed. Its template stays.', () => engine('stories.delete', { id: story.id }), () => {
      setSelected(null)
      load()
    })

  return (
    <Panel className="min-w-0 flex-1" title="Stories" meta={list ? `${list.length}` : undefined} actions={<Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={load} />} bodyClassName="flex min-h-0 gap-3 p-3">
      <div className="flex w-60 shrink-0 flex-col gap-0.5 overflow-y-auto">
        {list && !list.length && <div className="text-[12px] text-faint">No stories yet. An agent with Storyteller starts them.</div>}
        {list?.map((s) => (
          <ListRow key={s.id} active={selected === s.id} onClick={() => setSelected(s.id)} onMenu={rowMenu('story', s.id, s.id, () => setSelected(s.id))} title={s.id} subtitle={s.template}>
            <span className="block font-mono text-[10px]">
              <span className={STATUS_STYLE[s.status]}>{s.status}</span>
              <span className="text-faint"> · act {s.act} · turn {s.turn} · {formatRelative(s.at)}</span>
            </span>
          </ListRow>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
        {story ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={cn('font-mono text-[11px] uppercase tracking-[0.14em]', STATUS_STYLE[story.status])}>{story.status}</span>
              <span className="ml-auto flex flex-wrap gap-1.5">
                {story.status === 'active' && (
                  <Button size="sm" variant="ghost" icon={<Pause />} onClick={() => withNote('pause', 'Pause the story', 'Where things stand (optional)', 'Pause')}>
                    Pause
                  </Button>
                )}
                {story.status === 'paused' && (
                  <Button size="sm" variant="ghost" icon={<Play />} onClick={() => act('resume', null)}>
                    Resume
                  </Button>
                )}
                {(story.status === 'active' || story.status === 'paused') && (
                  <>
                    <Button size="sm" variant="ghost" icon={<CheckCircle2 />} onClick={() => withNote('complete', 'Complete the story', 'How it ended (optional)', 'Complete')}>
                      Complete
                    </Button>
                    <Button size="sm" variant="ghost" icon={<XCircle />} onClick={() => withNote('abandon', 'Abandon the story', 'Why (optional)', 'Abandon')}>
                      Abandon
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
                  Delete
                </Button>
              </span>
            </div>
            <div className="border border-line/40 bg-black/40 p-4">
              <Markdown text={text} />
            </div>
          </>
        ) : (
          <EmptyState title="No story selected">Pick one on the left.</EmptyState>
        )}
      </div>
    </Panel>
  )
}
