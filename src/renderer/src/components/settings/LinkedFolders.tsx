import { Fragment, useEffect, useState } from 'react'
import { FolderOpen, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import type { LinkedFolder } from '@shared/types'
import { Button, Input, PathRow, SaveState, Select, SettingCard, SettingRow, Textarea, useAutosavedState, confirmDelete } from '../ui'
import { AgentAvatar } from '../agents/look'
import { engine, main, on } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useAgents } from '../../store/agents'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'
import { textLines } from '@shared/text'
import { noteFailure } from '../../store/problems'

function norm(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}

function relativeInside(root: string, target: string): string | null {
  const r = norm(root)
  const t = norm(target)
  if (t.toLowerCase() === r.toLowerCase()) return ''
  return t.toLowerCase().startsWith(`${r.toLowerCase()}/`) ? t.slice(r.length + 1) : null
}

function Detail({ folder }: { folder: LinkedFolder }) {
  const agents = useAgents((s) => s.list)
  const from = (f: LinkedFolder) => ({ draft: f, excludeText: f.exclude.join('\n') })
  const autosave = useAutosavedState(from(folder), (v) => engine('folders.save', { ...v.draft, exclude: textLines(v.excludeText) }), { when: (v) => Boolean(v.draft.name) })
  useEffect(() => {
    if (autosave.status !== 'saving') autosave.reset(from(folder))
  }, [folder])
  const { draft, excludeText } = autosave.value
  const exclude = textLines(excludeText)
  const setDraft = (d: LinkedFolder) => autosave.set((v) => ({ ...v, draft: d }))
  const setExcludeText = (text: string) => autosave.set((v) => ({ ...v, excludeText: text }))

  const pickPath = async () => {
    const picked = await main('dialog.openFolder')
    if (picked) setDraft({ ...draft, path: picked })
  }

  const addExclusion = async () => {
    const picked = await main('dialog.openFolder')
    if (!picked) return
    const rel = relativeInside(draft.path, picked)
    if (rel === null || rel === '') {
      toast.error('Pick a folder inside this one', draft.path)
      return
    }
    setExcludeText([...exclude, `${rel}/**`].join('\n'))
  }

  const toggleAgent = (id: string) => setDraft({ ...draft, agents: draft.agents.includes(id) ? draft.agents.filter((a) => a !== id) : [...draft.agents, id] })

  return (
    <div className="border-l-2 border-l-accent/60 tone-panel-30">
      <SettingRow label="Name" hint={`Agents use it as @${draft.name || 'name'}/path. Letters, numbers, - and _.`}>
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-') })} className="w-56 font-ui" />
      </SettingRow>
      <SettingRow label="Access" hint="Writes still follow each agent's permission mode and approvals.">
        <Select
          value={draft.access}
          options={[
            { value: 'read', label: 'Read only' },
            { value: 'write', label: 'Read and write' }
          ]}
          onChange={(v) => setDraft({ ...draft, access: v === 'write' ? 'write' : 'read' })}
          className="w-56"
        />
      </SettingRow>
      <SettingRow label="Folder" hint={draft.path}>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => void main('folder.open', { path: draft.path }).catch(failed('Could not open'))}>
            Open
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void pickPath()}>
            Change…
          </Button>
        </div>
      </SettingRow>
      <SettingRow wide label="Off limits" hint="One pattern per line, relative to the folder: Private/**, *.pdf, .obsidian/**. Agents can't list, read, search or change anything that matches.">
        <div className="flex w-full flex-col gap-2">
          <Textarea value={excludeText} onChange={(e) => setExcludeText(e.target.value)} rows={5} className="font-ui text-[12px]" placeholder={'.obsidian/**\nPrivate/**'} />
          <div>
            <Button size="sm" variant="secondary" icon={<FolderPlus />} onClick={() => void addExclusion()}>
              Add a subfolder…
            </Button>
          </div>
        </div>
      </SettingRow>
      <SettingRow wide label="Agents" hint="Which agents can use this folder.">
        <div className="flex flex-wrap gap-1.5">
          {agents.map((a) => {
            const on = draft.agents.includes(a.id)
            return (
              <button
                key={a.id}
                onClick={() => toggleAgent(a.id)}
                className={cn('flex items-center gap-2 border px-2 py-1 text-[12.5px]', on ? 'border-accent bg-accent/10 text-ink' : 'border-line/60 text-dim hover:text-ink')}
              >
                <AgentAvatar agent={a} size={18} />
                {a.name}
              </button>
            )
          })}
        </div>
      </SettingRow>
      <SettingRow label="Remove" hint="Agents lose access to it. Nothing in the folder itself is touched." aside={<SaveState status={autosave.status} error={autosave.error} />}>
        <Button
          size="sm"
          variant="ghost"
          icon={<Trash2 />}
          onClick={() =>
            confirmDelete(`Remove @${folder.name}?`, 'Agents lose access to it. Nothing in the folder itself is touched.', () => engine('folders.delete', { id: folder.id }), undefined, 'Remove')
          }
        >
          Remove
        </Button>
      </SettingRow>
    </div>
  )
}

export function LinkedFolders() {
  const [list, setList] = useState<LinkedFolder[]>([])
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    void engine('folders.list').then(setList).catch(noteFailure('folders', 'Could not list the linked folders'))
    return on('folders.changed', setList)
  }, [])

  const add = async () => {
    const picked = await main('dialog.openFolder')
    if (!picked) return
    try {
      const next = await engine('folders.save', { path: picked, access: 'read', exclude: [], agents: [] })
      const added = next.find((f) => norm(f.path).toLowerCase() === norm(picked).toLowerCase()) ?? next[next.length - 1]
      setList(next)
      if (added) setOpen(added.id)
    } catch (err) {
      toast.error('Could not add the folder', errorText(err))
    }
  }

  return (
    <SettingCard
      title="Linked folders · agents can use"
      count={list.length}
      intro="Folders on your PC that agents can use with their file tools, such as an Obsidian vault, without copying anything into Seven. Agents reach them as @name/path. Off limits stops Seven's file tools; commands an agent runs (run_command) aren't limited by it, so keep commands on Ask for agents with sensitive folders."
      actions={
        <Button size="sm" variant="badge" icon={<FolderPlus />} onClick={() => void add()}>
          Link folder
        </Button>
      }
    >
      {list.map((f) => (
        <Fragment key={f.id}>
          <PathRow mono label={`@${f.name}`} path={f.path} tags={[f.access === 'write' ? 'read + write' : 'read only', `${f.agents.length} agent${f.agents.length === 1 ? '' : 's'}`]}>
            <Button size="sm" variant={open === f.id ? 'primary' : 'ghost'} icon={<Pencil />} onClick={() => setOpen(open === f.id ? null : f.id)}>
              {open === f.id ? 'Done' : 'Edit'}
            </Button>
          </PathRow>
          {open === f.id && <Detail folder={f} />}
        </Fragment>
      ))}
    </SettingCard>
  )
}
