import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { SkillInfo } from '@shared/types'
import { engine } from '../../lib/ipc'
import { formatRelative } from '../../lib/format'
import { Button, EmptyState, Panel, SaveState, askText, DoneEditing, useAutosavedState, ListRow, confirmDelete } from '../ui'
import { Markdown } from '../chat/Markdown'
import { rowMenu } from '../../views/data/entryMenu'
import { failed } from '../../lib/notify'

export function SkillsPanel({ initial = null }: { initial?: string | null }) {
  const [list, setList] = useState<SkillInfo[]>([])
  const [selected, setSelected] = useState<string | null>(initial)
  const [text, setText] = useState('')
  const editor = useAutosavedState<string | null>(
    null,
    async (t) => {
      await engine('skills.write', { name: selected!, text: t! })
      load()
    },
    { when: (t) => t !== null && Boolean(selected) }
  )
  const draft = editor.value
  const setDraft = editor.set
  const load = () =>
    void engine('skills.list')
      .then(setList)
      .catch(failed('Could not list skills'))
  useEffect(load, [])
  useEffect(() => {
    editor.reset(null)
    if (!selected) return setText('')
    void engine('skills.read', { name: selected })
      .then(setText)
      .catch(failed('Could not read the skill'))
  }, [selected])
  const current = list.find((s) => s.name === selected) ?? null
  const create = () =>
    askText('New skill', 'Folder name', '', async (name) => {
      const n = name.trim()
      if (!n) return
      const template = await engine('skills.template')
      await engine('skills.write', { name: n, text: template.replace('# Skill name', `# ${n}`) }).catch(failed('Could not make the skill'))
      load()
      setSelected(n)
    })
  const done = () => {
    if (draft !== null) setText(draft)
    editor.reset(null)
  }
  const remove = () =>
    selected &&
    confirmDelete(`Delete the skill ${selected}?`, 'Its folder and every file in it are removed.', () => engine('skills.delete', { name: selected }), () => {
      setSelected(null)
      load()
    })
  return (
    <Panel
      className="min-w-0 flex-1"
      title="Skills"
      meta={`${list.length}`}
      actions={
        <Button size="sm" variant="badge" icon={<Plus />} onClick={create}>
          New skill
        </Button>
      }
      bodyClassName="flex min-h-0 gap-3 p-3"
    >
      <div className="flex w-60 shrink-0 flex-col gap-0.5 overflow-y-auto">
        {!list.length && selected === null && <div className="text-[12px] text-faint">No skills yet. Agents with the Skills module save them, or make one here.</div>}
        {list.map((s) => (
          <ListRow key={s.name} active={selected === s.name} onClick={() => setSelected(s.name)} onMenu={rowMenu('skill', s.name, s.title, () => setSelected(s.name))} title={s.title} subtitle={s.description} wrap />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {selected ? (
          <>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-faint">{selected}/SKILL.md{current?.updatedAt ? ` · ${formatRelative(current.updatedAt)}` : ''}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {draft === null ? (
                  <>
                    <SaveState status={editor.status} error={editor.error} />
                    <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => editor.reset(text)}>
                      Edit
                    </Button>
                  </>
                ) : (
                  <DoneEditing saver={editor} onDone={done} />
                )}
                {current && (
                  <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
                    Delete
                  </Button>
                )}
              </span>
            </div>
            {draft !== null ? (
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-none border border-line/60 bg-black/60 p-3 font-mono text-[12.5px] leading-relaxed text-white" />
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto border border-line/40 bg-black/40 p-4">
                <Markdown text={text || '_Empty_'} />
              </div>
            )}
          </>
        ) : (
          <EmptyState title="No skill selected">Pick one on the left, or make a new one.</EmptyState>
        )}
      </div>
    </Panel>
  )
}
