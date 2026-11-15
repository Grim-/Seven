import { IN_APP } from '../lib/mode'
import { EntryView } from '../components/entries/EntryView'
import { File, Folder } from 'lucide-react'
import type { PageViewData, WidgetViewData, AssetsViewData, CollectionViewData, DiffData, ExcerptData, FileListItem, NoteViewData, TerminalData, ViewKind, ViewRef } from '@shared/types'
import { LiveCollection } from '../components/data/CollectionView'
import { LiveNote } from '../components/data/NoteView'
import { LiveAssets } from '../components/data/AssetView'
import { WorkoutResult } from '../components/workout/Workout'
import { PartView } from '../components/data/PartView'
import { useApp } from '../store/app'
import { useData } from '../store/data'
import { useDashboards } from '../store/dashboards'
import { WidgetBody } from '../components/dashboards/WidgetBody'
import { PageControls, PageFrame } from '../components/data/PageFrame'
import { Button, EmptyState } from '../components/ui'
import { formatBytes } from '../lib/format'
import { cn } from '../lib/cn'
import { showName } from '@shared/ids'
import { Presentation, presentData, registerPresentation, type PresentationProps } from './presentations'
import { showInData } from '../lib/library'

function TextView({ data }: { data: unknown }) {
  return <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-white/90">{String(data ?? '')}</pre>
}

function ThoughtView({ data }: { data: unknown }) {
  const t = (data ?? {}) as { kind?: string; style?: string | null; question?: string; reasoning?: string; conclusion?: string }
  return (
    <div className="flex flex-col gap-2 text-[12.5px]">
      {t.style && <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-purple">{t.style}</div>}
      {t.question && <div className="whitespace-pre-wrap text-accent-soft">{t.question}</div>}
      {t.reasoning && <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words border-l-2 border-l-purple/60 pl-2.5 font-mono text-[12px] leading-relaxed text-white/80">{t.reasoning}</pre>}
      <div className="text-white">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent">Conclusion </span>
        {t.conclusion}
      </div>
    </div>
  )
}

function JsonView({ data }: { data: unknown }) {
  return <pre className="max-h-80 overflow-auto font-mono text-[12px] leading-relaxed text-white/90">{JSON.stringify(data, null, 2)}</pre>
}

function FilesView({ data }: { data: unknown }) {
  const items = Array.isArray(data) ? (data as FileListItem[]) : []
  if (!items.length) return <div className="font-mono text-[12px] text-dim">No files</div>
  return (
    <ul className="max-h-80 overflow-auto font-mono text-[12px]">
      {items.map((item) => (
        <li key={item.path} className="flex items-center gap-2 py-0.5">
          {item.type === 'dir' ? <Folder className="h-3.5 w-3.5 shrink-0 text-accent" /> : <File className="h-3.5 w-3.5 shrink-0 text-dim" />}
          <span className="truncate text-white/90">{item.path}</span>
          {item.size !== undefined && <span className="ml-auto shrink-0 text-faint">{formatBytes(item.size)}</span>}
        </li>
      ))}
    </ul>
  )
}

function ExcerptView({ data }: { data: unknown }) {
  const excerpt = data as ExcerptData
  const lines = excerpt.text.split('\n')
  const width = String(excerpt.endLine).length
  return (
    <div className="max-h-96 overflow-auto border border-line/40 bg-black/70">
      <div className="sticky top-0 border-b border-line/40 bg-black/90 px-2.5 py-1 font-mono text-[10.5px] text-dim">
        {excerpt.path} · lines {excerpt.startLine}-{excerpt.endLine} of {excerpt.totalLines}
      </div>
      <pre className="px-2.5 py-1.5 font-mono text-[12px] leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-3">
            <span className="select-none text-faint">{String(excerpt.startLine + i).padStart(width)}</span>
            <span className="whitespace-pre text-white/90">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}

export function PatchView({ patch, maxHeight = 'max-h-96' }: { patch: string; maxHeight?: string }) {
  const lines = patch.split('\n').filter((l) => !l.startsWith('Index:') && !l.startsWith('====') && !l.startsWith('---') && !l.startsWith('+++'))
  let added = 0
  let removed = 0
  for (const l of lines) {
    if (l.startsWith('+')) added++
    else if (l.startsWith('-')) removed++
  }
  return (
    <div className={cn('overflow-auto border border-line/40 bg-black/70', maxHeight)}>
      <div className="sticky top-0 flex gap-3 border-b border-line/40 bg-black/90 px-2.5 py-1 font-mono text-[10.5px]">
        <span className="text-ok">+{added}</span>
        <span className="text-alert">-{removed}</span>
      </div>
      <pre className="py-1 font-mono text-[12px] leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'whitespace-pre px-2.5',
              line.startsWith('+') && 'bg-ok/10 text-ok',
              line.startsWith('-') && 'bg-alert/10 text-alert',
              line.startsWith('@@') && 'text-purple',
              line.startsWith('\\') && 'text-faint',
              !/^[-+@\\]/.test(line) && 'text-white/75'
            )}
          >
            {line || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}

function DiffView({ data }: { data: unknown }) {
  const diff = data as DiffData
  return (
    <div className="flex flex-col gap-1">
      <div className="font-mono text-[11px] text-dim">
        {diff.path}
        {diff.created && <span className="ml-2 text-ok">new file</span>}
      </div>
      <PatchView patch={diff.patch} />
    </div>
  )
}

export function TerminalOutput({ command, shell, output, footer }: { command: string; shell?: string; output: string; footer?: React.ReactNode }) {
  return (
    <div className="max-h-96 overflow-auto border border-line/40 bg-[#050608]">
      <div className="sticky top-0 border-b border-line/40 bg-black/90 px-2.5 py-1 font-mono text-[11px]">
        <span className="text-accent">$</span> <span className="text-white">{command}</span>
        {shell && <span className="ml-2 text-faint">{shell}</span>}
      </div>
      <pre className="whitespace-pre-wrap break-words px-2.5 py-1.5 font-mono text-[12px] leading-relaxed text-white/85">{output || ' '}</pre>
      {footer && <div className="border-t border-line/30 px-2.5 py-1 font-mono text-[10.5px]">{footer}</div>}
    </div>
  )
}

function TerminalView({ data }: { data: unknown }) {
  const t = data as TerminalData
  const footer = t.timedOut ? (
    <span className="text-accent">stopped after timeout</span>
  ) : t.exitCode === 0 ? (
    <span className="text-ok">exit 0</span>
  ) : (
    <span className="text-alert">exit {t.exitCode ?? '?'}</span>
  )
  return <TerminalOutput command={t.command} shell={t.shell} output={t.output} footer={footer} />
}


function CollectionResult({ data }: { data: unknown }) {
  const d = data as CollectionViewData
  const open = () => {
    showInData({ kind: 'page', id: d.collectionId })
  }
  return <LiveCollection collectionId={d.collectionId} view={d.view} recordIds={d.recordIds} options={d.options} onOpen={IN_APP ? open : undefined} />
}

function NoteResult({ data }: { data: unknown }) {
  return <LiveNote noteId={(data as NoteViewData).noteId} />
}

function AssetsResult({ data, title }: { data: unknown; title?: string }) {
  return <LiveAssets assetIds={(data as AssetsViewData).assetIds} title={title} />
}

function WidgetResult({ data }: { data: unknown }) {
  const d = data as WidgetViewData
  const dashboard = useDashboards((s) => s.list.find((x) => x.id === d.dashboardId))
  const widget = dashboard?.widgets.find((w) => w.id === d.widgetId)
  if (!dashboard || !widget) return <EmptyState title="Removed">This widget is no longer on its dashboard.</EmptyState>
  const open = () => {
    useDashboards.getState().setActive(dashboard.id)
    useApp.getState().setView('dashboards')
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-white">{widget.title}</span>
        <span className="font-mono text-[11px] text-faint">on {dashboard.name}</span>
        {IN_APP && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={open}>
            Open dashboard
          </Button>
        )}
      </div>
      <div className="h-72 overflow-auto border border-line/40 bg-black/40 p-2">
        <WidgetBody dashboard={dashboard} widget={widget} compact />
      </div>
    </div>
  )
}

function WidgetStage({ fields }: PresentationProps) {
  const d = fields as unknown as WidgetViewData
  const dashboard = useDashboards((s) => s.list.find((x) => x.id === d.dashboardId))
  const widget = dashboard?.widgets.find((w) => w.id === d.widgetId)
  if (!dashboard || !widget) return <EmptyState title="Removed">This widget is no longer on its dashboard.</EmptyState>
  return (
    <div className="flex flex-col gap-3 border border-line/60 bg-bg/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.9)]">
      <div className="flex items-center gap-3 border-b border-line/40 pb-2.5">
        <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.12em] text-white">{showName(widget.title)}</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">on {dashboard.name}</span>
      </div>
      <div className="min-h-[360px] max-h-[75vh] overflow-auto">
        <WidgetBody dashboard={dashboard} widget={widget} />
      </div>
    </div>
  )
}

registerPresentation('widget', WidgetStage)

function PageResult({ data, title }: { data: unknown; title?: string }) {
  const d = data as PageViewData
  const asset = useData((s) => s.assets.find((a) => a.id === d.assetId))
  if (!asset) return <EmptyState title="Removed">This page is no longer in Seven's files.</EmptyState>
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] font-semibold uppercase tracking-[0.1em] text-white">{title ?? asset.name}</span>
        <PageControls asset={asset} boards={IN_APP} />
      </div>
      <PageFrame asset={asset} className="h-[28rem] border border-line/40" />
    </div>
  )
}

function ViewsPresentation({ fields }: { fields: Record<string, unknown> }) {
  const views = (Array.isArray(fields.views) ? fields.views : []).filter((v): v is ViewRef => !!v && typeof v === 'object' && typeof (v as ViewRef).kind === 'string' && (v as ViewRef).kind !== 'present')
  return (
    <div className="flex flex-col gap-2">
      {views.map((v, i) => (
        <ViewRenderer key={i} view={v} />
      ))}
    </div>
  )
}

registerPresentation('view', ViewsPresentation)

function PresentResult({ data }: { data: unknown }) {
  const d = presentData(data)
  return d ? <Presentation data={{ ...d, where: 'panel' }} /> : null
}

const VIEWS: Record<ViewKind, (props: { data: unknown; title?: string }) => React.ReactNode> = {
  thought: ThoughtView,
  text: TextView,
  json: JsonView,
  files: FilesView,
  excerpt: ExcerptView,
  diff: DiffView,
  terminal: TerminalView,
  collection: CollectionResult,
  note: NoteResult,
  assets: AssetsResult,
  widget: WidgetResult,
  page: PageResult,
  entry: EntryView,
  present: PresentResult,
  workout: WorkoutResult,
  part: PartView
}

export const LIVE_VIEWS: ReadonlySet<ViewKind> = new Set<ViewKind>(['collection', 'note', 'assets', 'widget', 'page', 'workout', 'part'])

export function ViewRenderer({ view }: { view: ViewRef }) {
  const View = VIEWS[view.kind] ?? JsonView
  return <View data={view.data} title={view.title} />
}
