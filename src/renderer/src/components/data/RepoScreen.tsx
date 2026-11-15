import { useEffect, useState } from 'react'
import { Copy, Dices, Link2, Plus, RefreshCw } from 'lucide-react'
import type { RepoEntry } from '@shared/types'
import { showName } from '@shared/ids'
import { splitLink } from '@shared/text'
import { Button, CountStepper, InlineTitle, KindShell, ListEditor, SaveState, Segmented, TagInput, askText, useAutosavedState } from '../ui'
import { engine, on } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import type { DataSelection } from '../../store/data'
import type { KindScreenProps } from '../../registries/kinds'
import { onLibraryChange } from '../../lib/library'
import { entryMenuAt } from '../../views/data/entryMenu'
import { copyText } from '../../lib/notify'
import { noteFailure } from '../../store/problems'
import { withReferences } from '../chat/References'
import { EntryPicker } from '../library/EntryPicker'

export function askNewRepo(select: (s: DataSelection | null) => void): void {
  askText('New repo', 'Name', '', async (title) => {
    try {
      const repo = await engine('repos.save', { id: null, title, tags: [], scope: 'use', values: [] })
      select({ kind: 'repo', id: repo.id })
    } catch (err) {
      toast.error('Could not make the repo', errorText(err))
    }
  })
}

function useRepos(): RepoEntry[] | null {
  const [list, setList] = useState<RepoEntry[] | null>(null)
  useEffect(() => {
    const load = () =>
      void engine('repos.list')
        .then(setList)
        .catch(noteFailure('repos', 'Could not list the repos', () => setList([])))
    load()
    const off = onLibraryChange(load)
    const offPage = on('page.changed', load)
    return () => {
      off()
      offPage()
    }
  }, [])
  return list
}

function ValueText({ value }: { value: string }) {
  return (
    <>
      {value.split(/(\{[^}]+\})/g).map((part, i) =>
        /^\{[^}]+\}$/.test(part) ? (
          <span key={i} className="mx-0.5 border border-teal/40 bg-teal/10 px-1 font-mono text-[11.5px] text-teal" title="Rolls from another repo">
            {part.slice(1, -1)}
          </span>
        ) : (
          <span key={i} onClick={(e) => { if ((e.target as HTMLElement).closest('button,[role="link"]')) e.stopPropagation() }}>
            {withReferences(part)}
          </span>
        )
      )}
    </>
  )
}

interface Rolled {
  id: number
  text: string
}

function Roller({ repo, before }: { repo: RepoEntry; before: () => Promise<void> }) {
  const [count, setCount] = useState(3)
  const [rolled, setRolled] = useState<Rolled[]>([])
  const one = async (): Promise<string> => {
    await before()
    const r = await engine('library.rollText', { text: `@repo:${repo.id}#random` })
    if (r.rolled[0]?.error) throw new Error(r.rolled[0].error)
    return r.text
  }
  const roll = async () => {
    try {
      const out: Rolled[] = []
      for (let i = 0; i < count; i++) out.push({ id: Date.now() + i, text: await one() })
      setRolled(out)
    } catch (err) {
      toast.error('Could not roll', errorText(err))
    }
  }
  const again = async (id: number) => {
    try {
      const text = await one()
      setRolled((list) => list.map((r) => (r.id === id ? { id: Date.now(), text } : r)))
    } catch (err) {
      toast.error('Could not roll', errorText(err))
    }
  }
  return (
    <div className="flex w-72 shrink-0 flex-col gap-2 border border-line/50 bg-black/40 p-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Roll</span>
        <span className="ml-auto">
          <CountStepper value={count} min={1} max={20} onChange={setCount} />
        </span>
      </div>
      <Button variant="primary" icon={<Dices />} disabled={!repo.values.length} onClick={() => void roll()}>
        Roll {count}
      </Button>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {rolled.map((r) => (
          <div key={r.id} className="group flex items-center gap-1.5 border border-line/40 bg-black/50 px-2 py-1.5 text-[13px] text-white">
            <span className="min-w-0 flex-1 break-words">{withReferences(r.text)}</span>
            <button title="Roll this one again" onClick={() => void again(r.id)} className="text-dim opacity-0 hover:text-accent group-hover:opacity-100">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button title="Copy" onClick={() => void copyText(r.text, 'Copied', r.text)} className="text-dim opacity-0 hover:text-accent group-hover:opacity-100">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!rolled.length && <div className="text-[12px] text-faint">{repo.values.length ? 'Roll to see what comes up.' : 'Add some values first.'}</div>}
      </div>
    </div>
  )
}

function quoteLinkId(id: string): string {
  return /[\s,;!?)]/.test(id) ? `"${id}"` : id
}

function Editor({ start, tags, select }: { start: RepoEntry; tags: string[]; select: (s: DataSelection | null) => void }) {
  const saver = useAutosavedState<RepoEntry>(start, (next) => engine('repos.save', { id: next.id, title: next.title, tags: next.tags, scope: next.scope, values: next.values }))
  const repo = saver.value
  const change = (patch: Partial<RepoEntry>) => saver.set((r) => ({ ...r, ...patch }))
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [picking, setPicking] = useState(false)
  const addLink = (kind: string, id: string) => change({ values: [...repo.values, `@${kind}:${quoteLinkId(id)}`] })
  const linkButton = (
    <div className="relative">
      <button
        type="button"
        title="Link any entry (spell, card, scene prompt, page, etc.) into this repo"
        onClick={() => setPicking((v) => !v)}
        className="flex h-7 items-center gap-1 border border-line/50 px-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-dim hover:border-accent/60 hover:text-accent"
      >
        <Link2 className="h-3 w-3" /> Link entry
      </button>
      {picking && (
        <EntryPicker
          kind={null}
          title="Link entry to repo"
          onPick={(hit) => {
            addLink(hit.kind, hit.id)
            setPicking(false)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 border border-line/60 bg-black/70 p-3">
      <div className="flex items-center gap-3">
        <Dices className="h-5 w-5 shrink-0 text-accent-soft" />
        <InlineTitle value={showName(repo.title)} onSave={(title) => change({ title })} />
        <SaveState status={saver.status} error={saver.error} />
      </div>
      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <TagInput value={repo.tags} onChange={(t) => change({ tags: t })} suggestions={tags} placeholder="Tags, e.g. fantasy (a {tag:fantasy} value rolls from any repo tagged fantasy)" />
        <Segmented
          value={repo.scope}
          onChange={(scope) => change({ scope })}
          options={[
            { value: 'use', label: 'New roll each time', hint: 'Every roll picks again' },
            { value: 'run', label: 'Once per story run', hint: 'In a Story Nexus run, the first roll is kept' }
          ]}
        />
      </div>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'list', label: 'List' },
          { value: 'cards', label: 'Cards' }
        ]}
      />
      <div className="flex min-h-0 flex-1 gap-3">
        {view === 'list' ? (
          <ListEditor
            values={repo.values}
            onChange={(values) => change({ values })}
            placeholder="Add text, {other_repo}, or @kind:entry"
            render={(v) => <ValueText value={v} />}
            addActions={linkButton}
          />
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <KindShell
              id="repo.values"
              layouts={['deck']}
              items={repo.values.map((v, i) => {
                const parsed = splitLink(v)
                return parsed.kind
                  ? { key: String(i), title: showName(parsed.ref), subtitle: `@${parsed.kind}:${parsed.ref}`, tag: parsed.kind.toUpperCase(), icon: <Link2 className="h-4 w-4" /> }
                  : { key: String(i), title: v, tag: showName(repo.title), icon: <Dices className="h-4 w-4" /> }
              })}
              onOpen={(item) => {
                const raw = repo.values[Number(item.key)]
                if (!raw) return
                const parsed = splitLink(raw)
                if (parsed.kind) select({ kind: parsed.kind, id: parsed.ref })
              }}
              adds={[
                { label: 'Add value', icon: <Plus />, onClick: () => askText('Add value', 'Value', '', (v) => saver.set((r) => ({ ...r, values: [...r.values, v] }))) },
                { label: 'Link entry', icon: <Link2 />, onClick: () => setPicking(true) }
              ]}
              empty="No values yet."
            />
            {picking && (
              <EntryPicker
                kind={null}
                title="Link entry to repo"
                onPick={(hit) => {
                  addLink(hit.kind, hit.id)
                  setPicking(false)
                }}
                onClose={() => setPicking(false)}
              />
            )}
          </div>
        )}
        <Roller repo={repo} before={saver.flush} />
      </div>
    </div>
  )
}

export function RepoScreen({ id, select }: KindScreenProps) {
  const repos = useRepos()
  const [repo, setRepo] = useState<RepoEntry | null | undefined>(undefined)
  useEffect(() => {
    if (!id) return setRepo(null)
    let live = true
    void engine('repos.get', { id })
      .then((r) => live && setRepo(r))
      .catch(noteFailure('repos', 'Could not load the repo', () => live && setRepo(null)))
    return () => {
      live = false
    }
  }, [id])
  const tags = [...new Set((repos ?? []).flatMap((r) => r.tags))]
  if (id && repo === undefined) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  if (repo) return <Editor key={repo.id} start={repo} tags={tags} select={select} />
  return (
    <KindShell
      id="repos"
      layouts={['cards', 'deck', 'list']}
      items={(repos ?? []).map((r) => ({
        key: r.id,
        title: showName(r.title),
        subtitle: `${r.values.length} value${r.values.length === 1 ? '' : 's'}${r.tags.length ? ` · #${r.tags.join(' #')}` : ''}`,
        icon: <Dices className="h-4 w-4" />,
        updatedAt: r.updatedAt
      }))}
      onOpen={(item) => select({ kind: 'repo', id: item.key })}
      onMenu={(e, item) => entryMenuAt(e, 'repo', item.key, item.title)}
      adds={[{ label: 'New repo', icon: <Plus />, onClick: () => askNewRepo(select) }]}
      empty="No repos yet."
    />
  )
}
