import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Command, defaultFilter } from 'cmdk'
import { Dumbbell, FilePlus, FolderPlus, Lock, LockOpen, MessageSquarePlus, Search as SearchIcon, Terminal } from 'lucide-react'
import { hitDetail, type LibraryHit, type LibrarySection } from '@shared/types'
import { engine } from '../../lib/ipc'
import { KindIcon, openEntry } from '../../lib/library'
import { noteKindFamilies } from '../../registries/kinds'
import { cn } from '../../lib/cn'
import { useApp } from '../../store/app'
import { useVault } from '../../store/vault'
import { useTools } from '../../store/tools'
import { useCommands } from '../../store/commands'
import { askNewFolder, askNewPage } from '../data/PageView'
import { openWorkout } from '../workout/Workout'
import { fillComposer } from '../chat/Thread'
import { showPage } from '../../views/PagesView'
import { SETTINGS_TAB, VIEW_TABS } from './views'
import { failed } from '../../lib/notify'
import { focusedConversation, openChat } from '../../lib/conversation'

const PER_KIND = 6
const MAX_ACTIONS = 8

type Group = 'Go to' | 'Do' | 'Slash commands'

interface Action {
  id: string
  group: Group
  label: string
  detail?: string
  icon: ReactNode
  keywords?: string[]
  run: () => void
}

function useResults(query: string): LibrarySection[] | null {
  const [sections, setSections] = useState<LibrarySection[] | null>(null)
  const latest = useRef(0)
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSections(null)
      return
    }
    const n = ++latest.current
    const timer = setTimeout(() => {
      void engine('library.overview', { query: q, perKind: PER_KIND })
        .then((s) => {
          noteKindFamilies(s)
          if (n === latest.current) setSections(s.filter((x) => x.entries.length))
        })
        .catch(() => n === latest.current && setSections([]))
    }, 150)
    return () => clearTimeout(timer)
  }, [query])
  return sections
}

function useActions(open: boolean): Action[] {
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const vault = useVault((s) => s.status)
  const workoutOn = useTools((s) => s.list.some((m) => m.id === 'workout' && m.state === 'on'))
  const commands = useCommands((s) => s.list)
  const loadCommands = useCommands((s) => s.load)

  useEffect(() => {
    if (open) void loadCommands(focusedConversation())
  }, [open, loadCommands])

  return useMemo(() => {
    const out: Action[] = [...VIEW_TABS, SETTINGS_TAB]
      .filter((v) => v.id !== view)
      .map((v) => ({ id: `view:${v.id}`, group: 'Go to', label: v.label, icon: v.icon, keywords: ['open', 'go', 'view'], run: () => setView(v.id) }))
    out.push({
      id: 'new-chat',
      group: 'Do',
      label: 'New chat',
      icon: <MessageSquarePlus />,
      keywords: ['start', 'session', 'conversation'],
      run: () => {
        openChat(null)
      }
    })
    out.push({ id: 'new-page', group: 'Do', label: 'New page', icon: <FilePlus />, keywords: ['create', 'note', 'wiki'], run: () => askNewPage((id) => showPage(id)) })
    out.push({ id: 'new-folder', group: 'Do', label: 'New folder', icon: <FolderPlus />, keywords: ['create', 'pages', 'directory'], run: () => askNewFolder((id) => showPage(id)) })
    if (vault.configured && vault.unlocked)
      out.push({ id: 'lock', group: 'Do', label: 'Lock vault', icon: <Lock />, keywords: ['secure', 'hide', 'private'], run: () => void useVault.getState().lock().catch(failed('Could not lock')) })
    if (vault.configured && !vault.unlocked) out.push({ id: 'unlock', group: 'Do', label: 'Unlock vault', icon: <LockOpen />, keywords: ['passphrase', 'private'], run: () => useVault.getState().ask() })
    if (workoutOn) out.push({ id: 'workout', group: 'Do', label: 'Open Workout', icon: <Dumbbell />, keywords: ['exercise', 'training', 'gym', 'today'], run: openWorkout })
    for (const c of commands)
      out.push({
        id: `cmd:${c.name}`,
        group: 'Slash commands',
        label: `/${c.name}`,
        detail: c.summary,
        icon: <Terminal />,
        keywords: [c.name, c.summary],
        run: () => {
          setView('chat')
          fillComposer(`/${c.name} `)
        }
      })
    return out
  }, [view, setView, vault.configured, vault.unlocked, workoutOn, commands])
}

function matching(actions: Action[], query: string): Action[] {
  const q = query.trim()
  if (!q) return actions
  return actions
    .map((a) => ({ a, score: defaultFilter(a.label, q, a.keywords) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, MAX_ACTIONS)
    .map((x) => x.a)
}

const GROUPS: Group[] = ['Go to', 'Do', 'Slash commands']

const groupClass = '[&_[cmdk-group-heading]]:flex [&_[cmdk-group-heading]]:items-center [&_[cmdk-group-heading]]:gap-1.5 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-0.5 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-accent-soft'
const itemClass = 'flex cursor-pointer items-center gap-2 border-l-2 border-l-transparent px-2.5 py-1 text-left data-[selected=true]:border-l-accent data-[selected=true]:bg-accent/[0.07]'

export function AppSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const sections = useResults(query)
  const actions = useActions(open)
  const shown = useMemo(() => matching(actions, query), [actions, query])
  const searching = query.trim().length > 0

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const done = (run: () => void) => {
    setOpen(false)
    setQuery('')
    input.current?.blur()
    run()
  }

  const pickHit = (hit: LibraryHit) => done(() => openEntry(hit.kind, hit.id))

  const wide = open || query.length > 0

  return (
    <Command ref={box} shouldFilter={false} loop vimBindings={false} label="Search and commands" className="relative flex min-w-0 shrink items-center px-2">
      <div
        title="Search everything or run an action (Ctrl+K)"
        onClick={() => input.current?.focus()}
        className={cn('flex h-7 max-w-full cursor-text items-center gap-2 border px-2 transition-[width,border-color,background-color] duration-200', wide ? 'w-60 min-w-28' : 'w-24', open ? 'border-accent/50 bg-accent/[0.04]' : 'border-line/40 hover:border-line')}
      >
        <SearchIcon className={cn('h-3.5 w-3.5 shrink-0', open ? 'text-accent' : 'text-dim')} />
        <Command.Input
          ref={input}
          value={query}
          onValueChange={(v) => {
            setQuery(v)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            if (query) setQuery('')
            else {
              setOpen(false)
              input.current?.blur()
            }
          }}
          placeholder={wide ? 'Search or type a command' : 'Search'}
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent font-sans text-[12.5px] text-white outline-none placeholder:text-faint"
        />
        {wide && !open && <span className="shrink-0 font-mono text-[9.5px] tracking-widest text-faint">CTRL K</span>}
      </div>
      {open && (
        <Command.List className="absolute bottom-full left-2 z-50 mb-2 max-h-[60vh] w-[34rem] overflow-y-auto border border-line bg-bg/95 p-1 shadow-[0_0_24px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          {GROUPS.map((group) => {
            const items = shown.filter((a) => a.group === group)
            if (!items.length) return null
            return (
              <Command.Group key={group} heading={group} className={cn('pb-1', groupClass)}>
                {items.map((a) => (
                  <Command.Item key={a.id} value={`action:${a.id}`} onSelect={() => done(a.run)} className={itemClass}>
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center text-dim [&>svg]:h-3.5 [&>svg]:w-3.5">{a.icon}</span>
                    <span className="shrink-0 text-[13px] text-white/90">{a.label}</span>
                    {a.detail && <span className="min-w-0 truncate text-[11.5px] text-dim">{a.detail}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )
          })}
          {searching && sections === null && <div className="px-2.5 py-2 font-mono text-[11px] text-dim">Searching…</div>}
          {searching && sections !== null && !sections.length && !shown.length && <div className="px-2.5 py-2 text-[12.5px] text-dim">Nothing matches "{query.trim()}".</div>}
          {(sections ?? []).map((section) => (
            <Command.Group
              key={section.kind}
              className={cn('pb-1', groupClass)}
              heading={
                <>
                  <KindIcon name={section.icon} className="h-3 w-3" />
                  {section.plural}
                  {section.count > section.entries.length && <span className="font-normal text-faint">{section.count}</span>}
                </>
              }
            >
              {section.entries.map((hit) => (
                <Command.Item key={hit.id} value={`hit:${section.kind}/${hit.id}`} onSelect={() => pickHit(hit)} className={cn(itemClass, 'flex-col items-stretch gap-0')}>
                  <span className="truncate text-[13px] text-white/90">{hit.title}</span>
                  {hitDetail(hit) && <span className="truncate text-[11.5px] text-dim">{hitDetail(hit)}</span>}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      )}
    </Command>
  )
}
