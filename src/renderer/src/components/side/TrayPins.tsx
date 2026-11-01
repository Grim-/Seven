import { useEffect, useState } from 'react'
import { ChevronLeft, Database, Pin, PinOff } from 'lucide-react'
import { hitDetail, type LibraryHit, type TrayPin } from '@shared/types'
import { engine } from '../../lib/ipc'
import { KindIcon } from '../../lib/library'
import { kindUi, noteKindFamilies } from '../../registries/kinds'
import { useApp } from '../../store/app'
import type { DataSelection } from '../../store/data'
import { toast } from '../../store/toasts'
import { cn } from '../../lib/cn'
import { openMenu, type MenuItem } from '../ui'
import { KindBrowser } from '../data/KindBrowser'
import { failed } from '../../lib/notify'
import { showInData } from '../../lib/library'

const PER_KIND = 12

export function pinKey(pin: Pick<TrayPin, 'kind' | 'id'>): string {
  return `pin:${pin.kind}/${pin.id ?? '*'}`
}

export function useTrayPins(): TrayPin[] {
  return useApp((s) => s.settings?.trayPins) ?? []
}

function savePins(next: TrayPin[]): void {
  void useApp
    .getState()
    .updateSettings({ trayPins: next })
    .catch(failed('Could not save the chat bar'))
}

export function isPinned(kind: string, id: string | null): boolean {
  return (useApp.getState().settings?.trayPins ?? []).some((p) => p.kind === kind && p.id === id)
}

export function pinToTray(pin: TrayPin): void {
  const list = useApp.getState().settings?.trayPins ?? []
  if (list.some((p) => p.kind === pin.kind && p.id === pin.id)) return
  savePins([...list, pin])
  toast.success('Pinned to the chat bar', pin.label)
}

export function unpinFromTray(pin: Pick<TrayPin, 'kind' | 'id'>): void {
  const list = useApp.getState().settings?.trayPins ?? []
  savePins(list.filter((p) => !(p.kind === pin.kind && p.id === pin.id)))
}

export function pinMenuItem(pin: TrayPin): MenuItem {
  return isPinned(pin.kind, pin.id)
    ? { label: 'Unpin from chat bar', icon: <PinOff />, onSelect: () => unpinFromTray(pin) }
    : { label: 'Pin to chat bar', icon: <Pin />, onSelect: () => pinToTray(pin) }
}

export function openAddPinMenu(e: React.MouseEvent): void {
  const at = { preventDefault() {}, stopPropagation() {}, clientX: e.clientX, clientY: e.clientY }
  e.preventDefault()
  void engine('library.overview', { query: '', perKind: PER_KIND })
    .then((sections) => {
      noteKindFamilies(sections)
      const items: MenuItem[] = sections
        .filter((s) => s.count > 0 || kindUi(s.kind).whole)
        .map((s) => ({
          label: s.plural,
          icon: <KindIcon name={s.icon} />,
          children: [
            { label: `All ${s.plural.toLowerCase()}`, disabled: isPinned(s.kind, null), onSelect: () => pinToTray({ kind: s.kind, id: null, label: s.plural, icon: s.icon }) },
            ...(s.entries.length ? [{ label: '', separator: true }] : []),
            ...s.entries.map((h) => ({ label: h.title, disabled: isPinned(s.kind, h.id), onSelect: () => pinToTray({ kind: s.kind, id: h.id, label: h.title, icon: s.icon }) }))
          ]
        }))
      openMenu(at, 'Pin to chat bar', items.length ? items : [{ label: 'Nothing in the library yet', disabled: true }])
    })
    .catch(failed('Could not list the library'))
}

export function pinnedButtonMenu(e: React.MouseEvent, pin: TrayPin): void {
  openMenu(e, pin.label, [
    {
      label: 'Open in Data',
      icon: <Database />,
      onSelect: () => {
        showInData({ kind: pin.kind, id: pin.id ?? 'all' })
      }
    },
    { label: 'Unpin', icon: <PinOff />, danger: true, onSelect: () => unpinFromTray(pin) }
  ])
}

function EntryList({ kind, onPick }: { kind: string; onPick: (id: string) => void }) {
  const [list, setList] = useState<LibraryHit[] | null>(null)
  useEffect(() => {
    void engine('library.find', { query: '', kind })
      .then(setList)
      .catch(() => setList([]))
  }, [kind])
  if (list === null) return <div className="p-3 font-mono text-[11px] text-dim">Loading…</div>
  if (!list.length) return <div className="p-3 text-[12.5px] text-faint">Nothing here yet.</div>
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {list.map((h) => (
        <button key={h.id} onClick={() => onPick(h.id)} className="flex flex-col border-l-2 border-l-transparent px-2 py-1.5 text-left hover:border-l-accent hover:bg-white/[0.03]">
          <span className="truncate text-[13px] text-white">{h.title}</span>
          {hitDetail(h) && <span className="truncate text-[11.5px] text-dim">{hitDetail(h)}</span>}
        </button>
      ))}
    </div>
  )
}

export function PinnedView({ pin }: { pin: TrayPin }) {
  const [sel, setSel] = useState<DataSelection | null>(null)
  const kind = sel?.kind ?? pin.kind
  const id = sel ? sel.id : pin.id
  const ui = kindUi(kind)
  const Screen = ui.present?.Screen
  const initial = id && id !== 'all' ? id : null
  const select = (s: DataSelection | null) => setSel(s)
  let body: React.ReactNode
  if (Screen && (initial || ui.whole)) body = <Screen key={`${kind}/${id ?? 'all'}`} kind={kind} id={initial} select={select} />
  else if (!initial) body = Screen ? <EntryList kind={kind} onPick={(picked) => setSel({ kind, id: picked })} /> : <KindBrowser key={kind} kind={kind} title={pin.label} empty="Nothing here yet." />
  else body = <KindBrowser key={`${kind}/${initial}`} kind={kind} title={pin.label} empty="Nothing here yet." initial={initial} />
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {sel && (
        <button onClick={() => setSel(null)} className={cn('flex shrink-0 items-center gap-1 border-b border-line/40 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft hover:text-white')}>
          <ChevronLeft className="h-3.5 w-3.5" /> Back to {pin.label}
        </button>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{body}</div>
    </div>
  )
}
