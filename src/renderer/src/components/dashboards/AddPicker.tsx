import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, Import } from 'lucide-react'
import { widgetUiOf } from '../../registries/widgets'
import { useWidgetInfo } from '../../store/widgetInfo'
import { useTools } from '../../store/tools'
import type { AssetMeta, Dashboard, LibrarySection } from '@shared/types'
import { showName } from '@shared/ids'
import { presentOf } from '../../registries/kinds'
import { KindIcon } from '../../lib/library'
import { Button, Modal, SearchBox } from '../ui'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { chooseFiles } from '../../lib/importFiles'
import { cn } from '../../lib/cn'

export function fileThings(files: AssetMeta[]): string[] {
  return files.map((f) => `file/${f.id}`)
}

export async function placeOnBoard(dashboardId: string, things: string[], at: { x: number; y: number } | null = null): Promise<void> {
  if (!things.length) return
  await engine('widgets.place', { dashboardId, things, at })
}

type Key = `e:${string}` | `c:${string}:${string}`

const SHOWN = 30

function Row({ picked, onClick, icon, title, meta }: { picked: boolean; onClick: () => void; icon: React.ReactNode; title: string; meta: string }) {
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left', picked ? 'bg-accent/10' : 'hover:bg-white/[0.04]')}>
      <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center border', picked ? 'border-accent bg-accent text-black' : 'border-line')}>
        {picked && <Check className="h-3 w-3" />}
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-line/50">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-white">{title}</span>
      <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-teal/70">{meta}</span>
    </button>
  )
}

export function AddPicker({ dashboard, onClose }: { dashboard: Dashboard; onClose: () => void }) {
  const modules = useTools((s) => s.list)
  const [sections, setSections] = useState<LibrarySection[]>([])
  const providers = useWidgetInfo((s) => s.providers)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Key[]>([])
  const [busy, setBusy] = useState(false)
  const q = query.trim().toLowerCase()
  const match = (text: string) => !q || text.toLowerCase().includes(q)
  useEffect(() => {
    let live = true
    const timer = setTimeout(
      () =>
        void engine('library.overview', { query: q, perKind: SHOWN })
          .then((list) => live && setSections(list.filter((s) => s.boardable && s.entries.length)))
          .catch(() => undefined),
      q ? 200 : 0
    )
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q])
  const toggle = (key: Key) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]))

  const lists = useMemo(
    () => ({
      choices: providers.flatMap((p) => {
        const ui = widgetUiOf(p.kind)?.choices
        const list = (p.choices ?? []).filter((c) => (!c.module || modules.some((m) => m.id === c.module && m.state === 'on')) && match(c.label))
        return ui && list.length ? [{ kind: p.kind, ui, list }] : []
      })
    }),
    [q, modules, providers]
  )

  const add = async (keys: Key[]) => {
    setBusy(true)
    try {
      for (const key of keys.filter((k) => k.startsWith('c:'))) {
        const [, kind, id] = key.split(':')
        const source = widgetUiOf(kind)?.choices?.source(id)
        if (source) await engine('widgets.add', { dashboardId: dashboard.id, title: null, source, view: null, options: null })
      }
      await placeOnBoard(dashboard.id, keys.filter((k) => k.startsWith('e:')).map((k) => k.slice(2)))
      onClose()
    } catch (err) {
      toast.error('Could not add', errorText(err))
    }
    setBusy(false)
  }

  const create = async (kind: string) => {
    setBusy(true)
    try {
      await engine('widgets.create', { dashboardId: dashboard.id, kind })
      onClose()
    } catch (err) {
      toast.error('Could not add', errorText(err))
    }
    setBusy(false)
  }

  const importFiles = async () => {
    const added = await chooseFiles()
    if (!added.length) return
    try {
      await placeOnBoard(dashboard.id, fileThings(added))
      onClose()
    } catch (err) {
      toast.error('Could not add files', errorText(err))
    }
  }

  const heading = (text: string, count: number) =>
    count > 0 && <div className="mt-2 px-2.5 pb-1 font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-accent-soft">{text}</div>

  return (
    <Modal
      open
      title={`Add to ${dashboard.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" icon={<Import />} onClick={() => void importFiles()}>
            Files from disk…
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!picked.length || busy} onClick={() => void add(picked)}>
            Add{picked.length > 1 ? ` ${picked.length}` : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <SearchBox value={query} onChange={setQuery} />
        <div className="flex gap-2">
          {providers
            .filter((p) => p.create)
            .map((p) => (
              <Button key={p.kind} size="sm" variant="secondary" icon={widgetUiOf(p.kind)?.createIcon} onClick={() => void create(p.kind)}>
                {p.create}
              </Button>
            ))}
        </div>
        <div className="max-h-[50vh] overflow-y-auto border border-line/50">
          {lists.choices.map(({ kind, ui, list }) => (
            <Fragment key={kind}>
              {heading(ui.heading, list.length)}
              {list.map((c) => (
                <Row key={c.id} picked={picked.includes(`c:${kind}:${c.id}`)} onClick={() => toggle(`c:${kind}:${c.id}`)} icon={ui.icon} title={c.label} meta={ui.meta} />
              ))}
            </Fragment>
          ))}
          {sections.map((section) => {
            const { Thumb } = presentOf(section.kind)
            return (
              <Fragment key={section.kind}>
                {heading(section.plural, section.entries.length)}
                {section.entries.map((h) => {
                  const key: Key = `e:${section.kind}/${h.id}`
                  return (
                    <Row
                      key={key}
                      picked={picked.includes(key)}
                      onClick={() => toggle(key)}
                      icon={Thumb ? <Thumb id={h.id} /> : <KindIcon name={section.icon} className="h-3.5 w-3.5 text-dim" />}
                      title={showName(h.title)}
                      meta={section.label}
                    />
                  )
                })}
              </Fragment>
            )
          })}
          {!sections.length && !lists.choices.length && (
            <div className="px-3 py-4 text-[12.5px] text-dim">{q ? 'Nothing matches.' : 'Nothing yet. Add files from disk, or a Text or Page item.'}</div>
          )}
        </div>
      </div>
    </Modal>
  )
}
