import { PAGE_WIDGET_UI } from './PageWidget'
import { FILE_WIDGET_UI } from './FileWidget'
import { PageChat, PageStage } from './PageChat'
import { FileChat, FileStage } from './FileChat'
import { AddonChat } from './AddonChat'
import { SheetCard } from './SheetCard'
import { BoardChat, BoardStage } from '../dashboards/BoardChat'
import { WorkoutChat, ExerciseChat, WorkoutWidget } from '../workout/workoutPresent'
import { entryWidget } from '../../registries/widgets'
import { FolderChat } from './FolderChat'
import { WorldChat, WorldWidget } from '../worlds/WorldChat'
import { SkillChat, SkillStage, SkillWidget } from '../skills/SkillChat'
import { ThemeChat, ThemeStage, ThemeWidget } from '../themes/ThemeChat'
import { RepoChat, RepoStage, RepoWidget } from './RepoChat'
import { RoutineChat, RoutineWidget } from './RoutineChat'
import { CommandChat } from './CommandChat'
import { StyleChat } from '../mind/StyleChat'
import { StoryChat, StoryStage, StoryWidget } from '../stories/StoryChat'
import { ReminderChat, ReminderStage, ReminderWidget } from '../reminders/ReminderChat'
import { WebLogChat, WebLogWidget } from '../web/WebLogChat'
import { MessageChat, MessageWidget } from '../board/MessageChat'
import { ChatEntryChat, ChatEntryStage, ChatEntryWidget } from '../chat/ChatEntryChat'
import { MindChat, MindWidget } from '../mind/MindChat'
import { AgentChat, AgentStage, AgentWidget } from '../agents/AgentChat'
import { ScriptPart } from '../python/Python'
import { useState, useEffect } from 'react'
import { Download, ExternalLink, FileIcon, FolderOpen, ListPlus, MessageSquare, Pencil, Play, Trash2 } from 'lucide-react'
import { pageKindOf, pageTypeOfKind } from '@shared/types'
import { showName } from '@shared/ids'
import { Button, EmptyState, Modal, Panel, askText, type MenuItem, confirmDelete } from '../ui'
import { FileEditor } from '../pictures/FileEditor'
import { useData } from '../../store/data'
import { engine, main } from '../../lib/ipc'
import { chooseFiles } from '../../lib/importFiles'
import { errorText, formatBytes, formatRelative } from '../../lib/format'
import { useDashboards } from '../../store/dashboards'
import { useAgents } from '../../store/agents'
import { useSessions } from '../../store/sessions'
import { useTools } from '../../store/tools'
import { useApp } from '../../store/app'
import { MindView } from '../mind/Mind'
import { StylesPanel } from '../mind/Styles'
import { CommandsPanel } from './CommandsPanel'
import { SheetScreen, askNewSheet } from './SheetScreen'
import { RepoScreen, askNewRepo } from './RepoScreen'
import { NEW_ROUTINE, RoutineScreen } from './RoutineScreen'
import { ReminderList } from '../reminders/Reminders'
import { WebLog } from '../web/WebLog'
import { WorldsPanel } from '../worlds/Worlds'
import { MapScreen } from '../maps/MapScreen'
import { MapImporter } from '../maps/MapImporter'
import { MapChat, MapStage, MapThumb, MapWidget } from '../maps/MapSurfaces'
import { deletePlaceItem } from '../maps/placeActions'
import { PlaceChat, PlaceStage, PlaceWidget } from '../maps/PlaceSurfaces'
import { SkillsPanel } from '../skills/Skills'
import { AgentAvatar } from '../agents/look'
import { PageHost, ToolPage, askNewFolder, askNewPage, askRenamePage, usePageTypes } from './PageView'
import { PageExplorer } from './PageExplorer'
import { FilesPicker } from './FilesPicker'
import { WorkoutHome } from '../workout/WorkoutHome'
import { PagesBrowser, showPage } from '../../views/PagesView'
import { FileTrail, fileFolder } from './FileTrail'
import { newWorkoutEntry } from '../workout/Workout'
import { ExerciseScreen, WorkoutEntryScreen } from '../workout/WorkoutScreens'
import { JsonImporter } from '../workout/JsonImporter'
import { PythonPanel } from '../python/Python'
import { KindBrowser } from './KindBrowser'
import { ThemesPanel } from '../themes/Themes'
import { StoriesPanel } from '../stories/Stories'
import { Markdown } from '../chat/Markdown'
import { onLibraryChange, openChat } from '../../lib/library'
import { saveAsset } from '../../lib/exporting'
import { addToQueue, playNow } from '../../store/player'
import { SETUP_GROUP, registerKindUi, type KindMenuContext, type KindScreenProps, type KindUi } from '../../registries/kinds'
import { registerStoryteller } from '../storyteller/register'
import { registerCards } from '../cards/register'
import { registerDecisions } from '../decisions/register'
import { AssetMedia } from '../pictures/AssetMedia'
import { SlideshowScreen, askNewSlideshow } from '../slideshow/SlideshowScreen'
import { SlideshowPart, SlideshowThumb } from '../slideshow/SlideshowPlayer'
import { BoardView } from '../board/BoardView'
import { failed } from '../../lib/notify'



function deleteItem(ctx: KindMenuContext, message: string, run: () => Promise<unknown>): MenuItem {
  return {
    label: 'Delete',
    icon: <Trash2 />,
    danger: true,
    onSelect: () =>
      confirmDelete(`Delete ${ctx.title}?`, message, run, () => {
        if (ctx.selected?.id === ctx.id) ctx.select(null)
      })
  }
}

export function GeneratedPage({ id, onEntry }: { id: string; onEntry?: (kind: string, ref: string) => boolean }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    const load = () =>
      void engine('library.read', { entry: `page/${id}` })
        .then(setText)
        .catch((err) => setText(`Could not build this page: ${errorText(err)}`))
    load()
    return onLibraryChange(load)
  }, [id])
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border border-line/60 bg-black/70 p-4">
      {text === null ? <div className="font-mono text-[11px] text-dim">Building…</div> : <Markdown text={text} onEntry={onEntry} />}
    </div>
  )
}

function PageScreen({ id, select }: KindScreenProps) {
  const pages = useData((s) => s.pages)
  const types = usePageTypes()
  if (!id) return null
  if (id.startsWith('all:')) return <GeneratedPage key={id} id={id} />
  const page = pages.find((p) => p.id === id)
  if (page?.type && types.some((t) => t.id === page.type && t.single)) return <ToolPage key={id} id={id} />
  return <PageHost id={id} onChange={(next) => select({ kind: 'page', id: next })} />
}

function pageMenu(ctx: KindMenuContext): MenuItem[] {
  if (ctx.id.startsWith('all:')) return []
  return [
    { label: 'Rename', icon: <Pencil />, onSelect: () => askRenamePage(ctx.id, ctx.title) },
    deleteItem(ctx, 'Its text and items are removed. Boards and chats showing it will say it is missing.', () => engine('data.pages.delete', { id: ctx.id }))
  ]
}

const pageBase: KindUi = {
  whole: true,
  open: (id) => showPage(id === 'all' ? null : id),
  addLabel: 'New page',
  add: (_kind, select) => () => askNewPage((id) => select({ kind: 'page', id })),
  menu: pageMenu
}

registerKindUi('page', { ...pageBase, browser: PagesBrowser, picker: FilesPicker, rail: { label: 'Files', icon: 'folder' }, ownView: 'pages', present: { Screen: PageScreen, Chat: PageChat, Stage: PageStage, Widget: PAGE_WIDGET_UI } })

function FolderScreen({ id, select }: KindScreenProps) {
  const pages = useData((s) => s.pages)
  if (!id) return null
  return <PageExplorer key={id} folder={id} onOpen={(next) => select(next ? { kind: pageKindOf(pages.find((p) => p.id === next)?.type), id: next } : null)} onOpenFile={(file) => select({ kind: 'file', id: file })} />
}

registerKindUi('folder', {
  present: { Screen: FolderScreen, Chat: FolderChat, Stage: FolderChat, Widget: entryWidget(FolderChat) },
  showsAs: 'page',
  railUnder: { kind: 'page', count: false },
  ownView: 'pages',
  whole: true,
  open: (id) => showPage(id === 'all' ? null : id),
  addLabel: 'New folder',
  add: (_kind, select) => () => askNewFolder((id) => select({ kind: 'folder', id })),
  menu: (ctx) => [
    {
      label: 'Rename',
      icon: <Pencil />,
      onSelect: () =>
        askText('Rename folder', 'Name', showName(ctx.title), async (title) => {
          await engine('data.pages.write', { id: ctx.id, title, body: null }).catch(failed('Could not rename'))
        })
    },
    deleteItem(ctx, 'What is inside it moves up a level.', () => engine('data.pages.delete', { id: ctx.id }))
  ]
})

registerKindUi('page:addon', {
  ...pageBase,
  present: { Screen: PageScreen, Chat: AddonChat, Stage: AddonChat },
  whole: false,
  open: undefined,
  add: (kind, select) => {
    const typeId = pageTypeOfKind(kind)
    const type = useTools
      .getState()
      .list.flatMap((m) => m.pages.map((p) => ({ id: `${m.id}:${p.type}`, label: p.label, single: p.single })))
      .find((t) => t.id === typeId)
    if (!type || type.single) return undefined
    return () => askNewPage((id) => select({ kind, id }), type)
  },
  addLabel: undefined
})

function AssetScreen({ id, select }: KindScreenProps) {
  const asset = useData((s) => s.assets.find((a) => a.id === id))
  const [deleting, setDeleting] = useState(false)
  if (!id) return null
  if (!asset) return <EmptyState title="Deleted">This file no longer exists.</EmptyState>
  const open = (reveal: boolean) => void main('asset.open', { id: asset.id, reveal }).catch(failed('Could not open'))
  return (
    <Panel
      className="flex-1"
      title={asset.name}
      meta={`${asset.kind} · ${formatBytes(asset.size)}`}
      bodyClassName="flex flex-col gap-3 overflow-auto"
      actions={
        <>
          <Button size="sm" variant="ghost" onClick={() => open(false)}>
            Open
          </Button>
          <Button size="sm" variant="ghost" onClick={() => open(true)}>
            Show in folder
          </Button>
          <Button size="sm" variant="ghost" icon={<Download />} onClick={() => void saveAsset(asset.id, asset.name)}>
            Save a copy
          </Button>
          <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </>
      }
    >
      <FileEditor asset={asset} />
      <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 font-mono text-[11.5px]">
        <span className="text-faint">ID</span>
        <span className="text-white/85 select-text">{asset.id}</span>
        <span className="text-faint">From</span>
        <span className="text-white/85">{asset.source.original ?? '—'}</span>
        <span className="text-faint">Added</span>
        <span className="text-white/85">{new Date(asset.createdAt).toLocaleString()}</span>
      </div>
      {deleting && (
        <Modal
          open
          title="Delete"
          onClose={() => setDeleting(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  void engine('data.assets.delete', { id: asset.id })
                    .then(() => select(null))
                    .catch(failed('Delete failed'))
                }
              >
                Delete
              </Button>
            </>
          }
        >
          Delete the file "{asset.name}"? Agents using it will no longer find it. This can't be undone.
        </Modal>
      )}
    </Panel>
  )
}

function FileThumb({ id, large = false }: { id: string; large?: boolean }) {
  if (large) return <AssetMedia id={id} className="h-full w-full" fallback={<FileIcon className="h-8 w-8 text-dim" />} />
  return (
    <AssetMedia
      id={id}
      className="h-7 w-7 shrink-0 border border-line/50"
      fallback={
        <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-line/50">
          <FileIcon className="h-3.5 w-3.5 text-dim" />
        </span>
      }
    />
  )
}

registerKindUi('file', {
  pictures: (id) => [id],
  present: { Screen: AssetScreen, Chat: FileChat, Stage: FileStage, Widget: FILE_WIDGET_UI, Thumb: FileThumb },
  railUnder: { kind: 'page', count: true },
  trail: FileTrail,
  back: (selected) => showPage(selected.id === 'all' ? null : fileFolder(selected.id)),
  addLabel: 'Add files',
  add: (_kind, select) => () => void chooseFiles().then((added) => added[0] && select({ kind: 'file', id: added[0].id })),
  menu: (ctx) => [
    ...(useData.getState().assets.find((a) => a.id === ctx.id)?.kind === 'audio'
      ? [
          { label: 'Play', icon: <Play />, onSelect: () => playNow([ctx.id]) },
          { label: 'Add to queue', icon: <ListPlus />, onSelect: () => addToQueue([ctx.id]) }
        ]
      : []),
    { label: 'Open file', icon: <ExternalLink />, onSelect: () => void main('asset.open', { id: ctx.id, reveal: false }).catch(failed('Could not open')) },
    { label: 'Show in folder', icon: <FolderOpen />, onSelect: () => void main('asset.open', { id: ctx.id, reveal: true }).catch(failed('Could not open')) },
    { label: 'Save a copy…', icon: <Download />, onSelect: () => void saveAsset(ctx.id, ctx.title) },
    deleteItem(ctx, 'The file is removed from Seven. Boards and chats showing it will say it is missing.', () => engine('data.assets.delete', { id: ctx.id }))
  ]
})

function AgentThumb({ id, large = false }: { id: string; large?: boolean }) {
  const agent = useAgents((s) => s.list.find((a) => a.id === id))
  return agent ? <AgentAvatar agent={agent} size={large ? 88 : 28} /> : null
}

function ChatScreen({ id }: KindScreenProps) {
  const meta = useSessions((s) => s.list.find((x) => x.id === id))
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!id) return
    void engine('library.read', { entry: `chat/${id}` })
      .then(setText)
      .catch((err) => setText(errorText(err)))
  }, [id, meta?.updatedAt])
  if (!id) return <KindBrowser kind="chat" title="Chats" empty="No chats yet." />
  return (
    <Panel
      className="min-w-0 flex-1"
      title={meta?.title ?? 'Chat'}
      meta={meta ? formatRelative(meta.updatedAt) : undefined}
      actions={
        <Button size="sm" variant="primary" icon={<MessageSquare />} onClick={() => openChat(id)}>
          Open chat
        </Button>
      }
      bodyClassName="overflow-y-auto p-4"
    >
      {text === null ? <div className="font-mono text-[11px] text-dim">Loading…</div> : <Markdown text={text} />}
    </Panel>
  )
}

const panel = (Component: React.ComponentType<{ initial?: string | null }>) =>
  function Screen({ id }: KindScreenProps) {
    return <Component key={id ?? 'all'} initial={id} />
  }

registerKindUi('workout', { present: { Screen: WorkoutEntryScreen, Chat: WorkoutChat, Stage: WorkoutChat, Widget: entryWidget(WorkoutWidget) }, home: WorkoutHome, addLabel: 'New workout', add: () => () => newWorkoutEntry('workout', 'workout', { items: [] }), importer: ({ onClose }) => <JsonImporter initial="workouts" onClose={onClose} /> })
registerKindUi('exercise', { present: { Screen: ExerciseScreen, Chat: ExerciseChat, Stage: ExerciseChat, Widget: entryWidget(ExerciseChat) }, addLabel: 'New exercise', add: () => () => newWorkoutEntry('exercise', 'exercise', {}), importer: ({ onClose }) => <JsonImporter initial="exercises" onClose={onClose} /> })
registerKindUi('place', { present: { Screen: panel(WorldsPanel), Chat: PlaceChat, Stage: PlaceStage, Widget: entryWidget(PlaceWidget) }, whole: true, menu: (ctx) => [deletePlaceItem(ctx.id, ctx.title)] })
registerKindUi('map', { present: { Screen: MapScreen, Chat: MapChat, Stage: MapStage, Widget: entryWidget(MapWidget), Thumb: MapThumb }, addLabel: 'New map', add: (_k, select) => () => askText('New map', 'Name', '', async (name) => { if (name.trim()) select({ kind: 'map', id: (await engine('maps.create', { name })).id }) }), importer: MapImporter, importLabel: 'Import a map made in Tiled' })
registerKindUi('world', { present: { Screen: panel(WorldsPanel), Chat: WorldChat, Stage: WorldChat, Widget: entryWidget(WorldWidget) }, whole: true })
registerKindUi('skill', { present: { Screen: panel(SkillsPanel), Chat: SkillChat, Stage: SkillStage, Widget: entryWidget(SkillWidget) }, whole: true })
registerKindUi('script', { present: { Screen: panel(PythonPanel), Chat: ScriptPart, Stage: ScriptPart, Widget: entryWidget(ScriptPart) }, whole: true, addLabel: 'New script', add: (_k, select) => () => select({ kind: 'script', id: '_new' }) })
registerKindUi('theme', { railGroup: SETUP_GROUP, present: { Screen: panel(ThemesPanel), Chat: ThemeChat, Stage: ThemeStage, Widget: entryWidget(ThemeWidget) }, whole: true, addLabel: 'New theme', add: (_k, select) => () => select({ kind: 'theme', id: '_new' }) })
registerKindUi('slideshow', { present: { Screen: SlideshowScreen, Chat: SlideshowPart, Stage: SlideshowPart, Widget: entryWidget(SlideshowPart), Thumb: SlideshowThumb }, addLabel: 'New slideshow', add: (_k, select) => () => askNewSlideshow(select) })
registerKindUi('repo', { emptyText: 'No repos yet. Make one in Data.', present: { Screen: RepoScreen, Chat: RepoChat, Stage: RepoStage, Widget: entryWidget(RepoWidget) }, whole: true, addLabel: 'New repo', add: (_k, select) => () => askNewRepo(select) })
registerKindUi('routine', { present: { Screen: RoutineScreen, Chat: RoutineChat, Stage: RoutineChat, Widget: entryWidget(RoutineWidget) }, addLabel: 'New routine', add: (_k, select) => () => select({ kind: 'routine', id: NEW_ROUTINE }) })
registerKindUi('sheet', { present: { Screen: SheetScreen, Chat: SheetCard, Stage: SheetCard, Widget: entryWidget(SheetCard) }, whole: true, addLabel: 'New character', add: (_k, select) => () => askNewSheet(select) })
registerKindUi('command', { railGroup: SETUP_GROUP, present: { Screen: panel(CommandsPanel), Chat: CommandChat }, whole: true, addLabel: 'New command', add: (_k, select) => () => select({ kind: 'command', id: '_new' }) })
registerKindUi('style', { railGroup: SETUP_GROUP, present: { Screen: panel(StylesPanel), Chat: StyleChat }, whole: true, addLabel: 'New style', add: (_k, select) => () => select({ kind: 'style', id: '_new' }) })
registerKindUi('story', { present: { Screen: panel(StoriesPanel), Chat: StoryChat, Stage: StoryStage, Widget: entryWidget(StoryWidget) }, whole: true, timed: true })
registerKindUi('reminder', { present: { Screen: () => <ReminderList />, Chat: ReminderChat, Stage: ReminderStage, Widget: entryWidget(ReminderWidget) }, whole: true })
registerKindUi('weblog', { present: { Screen: () => <WebLog />, Chat: WebLogChat, Stage: WebLogChat, Widget: entryWidget(WebLogWidget) }, whole: true })
registerKindUi('message', { present: { Screen: () => <BoardView />, Chat: MessageChat, Stage: MessageChat, Widget: entryWidget(MessageWidget) }, whole: true })
registerKindUi('chat', { present: { Screen: ChatScreen, Chat: ChatEntryChat, Stage: ChatEntryStage, Widget: entryWidget(ChatEntryWidget) }, whole: true, timed: true })
registerKindUi('memory', {
  present: { Screen: ({ id }) => (id ? <MindView key={id} agentId={id} /> : <KindBrowser kind="memory" title="Minds" empty="No agents yet." />), Chat: MindChat, Stage: MindChat, Widget: entryWidget(MindWidget), Thumb: AgentThumb },
  whole: true
})
registerKindUi('agent', {
  open: (id) => {
    useAgents.setState({ focus: id === 'all' ? null : id })
    useApp.getState().setView('agents')
  },
  whole: true,
  present: { Chat: AgentChat, Stage: AgentStage, Widget: entryWidget(AgentWidget), Thumb: AgentThumb }
})
registerKindUi('board', {
  present: { Chat: BoardChat, Stage: BoardStage },
  open: (id) => {
    if (id !== 'all') useDashboards.getState().setActive(id)
    useApp.getState().setView('dashboards')
  },
  whole: true
})

registerStoryteller()
registerCards()
registerDecisions()
