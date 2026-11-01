import { useEffect, useState } from 'react'
import { Play, Plus, Trash2 } from 'lucide-react'
import type { PythonRun, PythonScript } from '@shared/types'
import { engine, on } from '../../lib/ipc'
import { formatRelative } from '../../lib/format'
import { Button, EmptyState, Input, Panel, MakeOrSaved, useAutosavedState, ListRow, confirmDelete } from '../ui'
import { LiveAssets } from '../data/AssetView'
import { cn } from '../../lib/cn'
import { rowMenu } from '../../views/data/entryMenu'
import { failed } from '../../lib/notify'
import { useBusy } from '../../lib/useBusy'

const NEW = '_new'

export function usePythonScripts(): PythonScript[] | null {
  const [list, setList] = useState<PythonScript[] | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      void engine('python.scripts')
        .then((l) => live && setList(l))
        .catch(() => live && setList([]))
    load()
    const off = on('python.changed', load)
    return () => {
      live = false
      off()
    }
  }, [])
  return list
}

function RunOutput({ run }: { run: PythonRun }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-[10.5px] text-faint">
        {new Date(run.at).toLocaleString()} · {run.exit === null ? 'stopped' : `exit ${run.exit}`}
      </div>
      <pre className={cn('max-h-80 overflow-auto whitespace-pre-wrap border bg-black/60 p-3 font-mono text-[12px] leading-relaxed', run.exit === 0 ? 'border-line/40 text-white/90' : 'border-red-500/40 text-red-200')}>
        {run.output || '(no output)'}
      </pre>
      {run.files.length > 0 && <LiveAssets assetIds={run.files} />}
    </div>
  )
}

export function ScriptPart({ id, part }: { id: string; part: string }) {
  const list = usePythonScripts()
  if (!list) return null
  const script = list.find((s) => s.id === id)
  if (!script) return <EmptyState title="Removed">This script no longer exists.</EmptyState>
  if (part === 'output') return script.runs[0] ? <RunOutput run={script.runs[0]} /> : <EmptyState title="Not run yet">This script hasn't been run.</EmptyState>
  return <pre className="max-h-[420px] overflow-auto border border-line/40 bg-black/60 p-3 font-mono text-[12px] leading-relaxed text-white/90">{script.code}</pre>
}

interface Draft {
  name: string
  description: string
  code: string
}

export function PythonPanel({ initial = null }: { initial?: string | null }) {
  const list = usePythonScripts()
  const [selected, setSelected] = useState<string | null>(initial)
  const [shownRun, setShownRun] = useState(0)
  const script = list?.find((s) => s.id === selected) ?? null
  const usable = (d: Draft | null): d is Draft => Boolean(d && d.name.trim() && d.code.trim())
  const editor = useAutosavedState<Draft | null>(
    initial === NEW ? { name: '', description: '', code: 'print("hello")\n' } : null,
    (d) => engine('python.save', { id: selected, name: d!.name, code: d!.code, description: d!.description }),
    { when: (d) => usable(d) && Boolean(selected) && selected !== NEW }
  )
  const draft = editor.value
  const [running, run] = useBusy()
  useEffect(() => {
    setShownRun(0)
  }, [selected])
  useEffect(() => {
    if (selected === NEW || editor.status === 'saving') return
    editor.reset(script ? { name: script.name, description: script.description, code: script.code } : null)
  }, [selected, script?.updatedAt])
  const edit = (patch: Partial<Draft>) => editor.set((d) => (d ? { ...d, ...patch } : d))
  const create = () => {
    setSelected(NEW)
    editor.reset({ name: '', description: '', code: 'print("hello")\n' })
  }
  const make = async (): Promise<PythonScript | undefined> => {
    if (!draft) return undefined
    const saved = await engine('python.save', { id: null, name: draft.name, code: draft.code, description: draft.description }).catch((err) => void failed('Could not make the script')(err))
    if (saved) setSelected(saved.id)
    return saved ?? undefined
  }
  const start = () =>
    void run(async () => {
      await editor.flush()
      const target = selected === NEW ? await make() : script
      if (!target) return
      await engine('python.run', { id: target.id })
      setShownRun(0)
    }, 'Could not run the script')
  const remove = () =>
    script &&
    confirmDelete(`Delete ${script.name}?`, 'The script and its past runs are removed. Files it made stay in Files.', () => engine('python.delete', { id: script.id }), () => setSelected(null))
  const shown = script?.runs[shownRun] ?? null
  return (
    <Panel
      className="min-w-0 flex-1"
      title="Python"
      meta={list ? `${list.length}` : undefined}
      actions={
        <Button size="sm" variant="badge" icon={<Plus />} onClick={create}>
          New script
        </Button>
      }
      bodyClassName="flex min-h-0 gap-3 p-3"
    >
      <div className="flex w-60 shrink-0 flex-col gap-0.5 overflow-y-auto">
        {list && !list.length && selected !== NEW && <div className="text-[12px] text-faint">No scripts yet. Agents save them with python_save, or make one here.</div>}
        {selected === NEW && <div className="border-l-2 border-l-accent bg-accent/10 px-2 py-1.5 text-[13px] text-white">{draft?.name || 'New script'}</div>}
        {list?.map((s) => (
          <ListRow key={s.id} active={selected === s.id} onClick={() => setSelected(s.id)} onMenu={rowMenu('script', s.id, s.name, () => setSelected(s.id))} title={s.name} subtitle={s.description || `${s.code.split('\n').length} lines`} wrap>
            <span className="block font-mono text-[10px] text-faint">{s.runs[0] ? `ran ${formatRelative(s.runs[0].at)}` : 'not run yet'}</span>
          </ListRow>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-y-auto">
        {draft ? (
          <>
            <div className="flex items-center gap-2">
              <Input value={draft.name} onChange={(e) => edit({ name: e.target.value })} placeholder="Name" className="max-w-xs" />
              <span className="ml-auto flex items-center gap-1.5">
                <MakeOrSaved made={selected !== NEW} saver={editor} what="script" onMake={() => void make()} disabled={!usable(draft)} />
                <Button size="sm" variant="primary" icon={<Play />} disabled={running || !usable(draft)} onClick={start}>
                  {running ? 'Running…' : 'Run'}
                </Button>
                {script && (
                  <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
                    Delete
                  </Button>
                )}
              </span>
            </div>
            <Input value={draft.description} onChange={(e) => edit({ description: e.target.value })} placeholder="What it does" />
            <textarea
              value={draft.code}
              onChange={(e) => edit({ code: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const t = e.currentTarget
                  const at = t.selectionStart
                  const code = `${draft.code.slice(0, at)}    ${draft.code.slice(t.selectionEnd)}`
                  edit({ code })
                  requestAnimationFrame(() => t.setSelectionRange(at + 4, at + 4))
                }
              }}
              spellCheck={false}
              className="min-h-[260px] flex-1 resize-y border border-line/60 bg-black/60 p-3 font-mono text-[12.5px] leading-relaxed text-white"
            />
            {script && script.runs.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line/40 pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-soft">Runs</span>
                  {script.runs.map((r, i) => (
                    <button
                      key={r.at}
                      onClick={() => setShownRun(i)}
                      className={cn('border px-2 py-0.5 font-mono text-[10.5px]', i === shownRun ? 'border-accent bg-accent/10 text-white' : 'border-line/40 text-dim hover:text-white', r.exit !== 0 && 'text-red-300')}
                    >
                      {formatRelative(r.at)}
                    </button>
                  ))}
                </div>
                {shown && <RunOutput run={shown} />}
              </div>
            )}
          </>
        ) : (
          <EmptyState title="No script selected">Pick one on the left, or make a new one.</EmptyState>
        )}
      </div>
    </Panel>
  )
}
