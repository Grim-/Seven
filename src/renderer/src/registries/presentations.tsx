import { PRESENT_PREFIX, presentationTypeOf } from '@shared/toolnames'
import { useEffect, type ComponentType } from 'react'
import { create } from 'zustand'
import { LayoutDashboard, PanelRight, Play, X } from 'lucide-react'
import type { PresentData, PresentWhere, ToolPart } from '@shared/types'
import { Markdown } from '../components/chat/Markdown'
import { useApp } from '../store/app'
import { useDashboards } from '../store/dashboards'
import { cn } from '../lib/cn'
import { copyText } from '../lib/notify'
import { AlertBox } from '../components/ui'

export { PRESENT_PREFIX }

export interface PresentationProps {
  fields: Record<string, unknown>
  where: PresentWhere
  draft: boolean
  stage: boolean
  onDone?: () => void
}

const registry = new Map<string, ComponentType<PresentationProps>>()

export function registerPresentation(type: string, component: ComponentType<PresentationProps>): void {
  registry.set(type, component)
}

export function isPresentation(name: string): boolean {
  return presentationTypeOf(name) !== null
}

export function presentData(value: unknown): PresentData | null {
  if (!value || typeof value !== 'object') return null
  const d = value as Partial<PresentData>
  if (typeof d.type !== 'string' || !d.fields || typeof d.fields !== 'object') return null
  return { type: d.type, fields: d.fields, where: d.where ?? 'inline', key: d.key ?? null, board: d.board ?? null }
}

export const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v))

function Generic({ fields }: PresentationProps) {
  return (
    <div className="flex flex-col gap-2 border border-line/50 bg-black/40 p-3">
      {Object.entries(fields)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => (
          <div key={k}>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent-soft">{k}</div>
            {typeof v === 'string' ? <Markdown text={v} /> : <pre className="whitespace-pre-wrap font-mono text-[12px] text-dim">{JSON.stringify(v, null, 2)}</pre>}
          </div>
        ))}
    </div>
  )
}

export function Presentation({ data, draft = false, stage = false, onDone }: { data: PresentData; draft?: boolean; stage?: boolean; onDone?: () => void }) {
  const View = registry.get(data.type) ?? Generic
  return <View fields={data.fields} where={data.where} draft={draft} stage={stage} onDone={onDone} />
}

interface StageState {
  playing: PresentData | null
  play: (data: PresentData) => void
  close: () => void
}

export const useStage = create<StageState>((set) => ({
  playing: null,
  play: (playing) => set({ playing }),
  close: () => set({ playing: null })
}))

export function StageOverlay() {
  const playing = useStage((s) => s.playing)
  const close = useStage((s) => s.close)
  useEffect(() => {
    if (!playing) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, close])
  if (!playing) return null
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-black/85 p-6 backdrop-blur-sm" onClick={close}>
      <button title="Close" onClick={close} className="absolute right-3 top-3 z-10 text-dim hover:text-white">
        <X className="h-5 w-5" />
      </button>
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Presentation data={playing} stage onDone={close} />
      </div>
    </div>
  )
}

function Stub({ icon, text, action, onClick }: { icon: React.ReactNode; text: string; action: string; onClick: () => void }) {
  return (
    <div className="my-2 flex items-center gap-2 border border-line/50 bg-black/40 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
      {icon}
      <span className="truncate">{text}</span>
      <button onClick={onClick} className="ml-auto shrink-0 text-accent hover:text-white">
        {action}
      </button>
    </div>
  )
}

export function PresentationPart({ part }: { part: ToolPart }) {
  const fromView = presentData(part.view?.data)
  const data: PresentData = fromView ?? {
    type: presentationTypeOf(part.name) ?? part.name,
    fields: part.args,
    where: (part.args.where as PresentWhere) ?? 'inline',
    key: null
  }
  const draft = !fromView
  if (part.status === 'error' || part.status === 'blocked') {
    return <AlertBox className="my-2">{part.error ?? 'Could not present this'}</AlertBox>
  }
  if (data.where === 'panel' && !draft) {
    const openPanel = () => {
      const app = useApp.getState()
      const prefs = app.settings?.sidePanel
      if (prefs) void app.updateSettings({ sidePanel: { ...prefs, open: true, tab: 'outputs' } })
    }
    return <Stub icon={<PanelRight className="h-3.5 w-3.5" />} text={`${part.view?.title ?? data.type} · in the side panel`} action="Open" onClick={openPanel} />
  }
  if (data.where === 'board' && !draft) {
    const openBoard = () => {
      const board = useDashboards.getState().list.find((d) => d.name === data.board)
      if (board) useDashboards.getState().setActive(board.id)
      useApp.getState().setView('dashboards')
    }
    return <Stub icon={<LayoutDashboard className="h-3.5 w-3.5" />} text={`${part.view?.title ?? data.type} · on board ${data.board ?? ''}`} action="Open" onClick={openBoard} />
  }
  if (data.type === 'scene' && !draft) {
    return (
      <div className="my-2">
        <Presentation data={{ ...data, where: 'inline' }} />
      </div>
    )
  }
  if (data.where === 'stage' && !draft) {
    return <Stub icon={<Play className="h-3.5 w-3.5" />} text={`${part.view?.title ?? data.type} · played on stage`} action="Replay" onClick={() => useStage.getState().play(data)} />
  }
  return (
    <div className={cn('my-2', draft && 'opacity-90')}>
      <Presentation data={{ ...data, where: 'inline' }} draft={draft} />
    </div>
  )
}

function Card({ fields, draft, stage }: PresentationProps) {
  const footer = str(fields.footer)
  return (
    <div className={cn('notch-sm flex flex-col border border-line border-l-2 border-l-accent bg-black/60', stage && 'text-[16px]')}>
      <div className={cn('border-b border-line/50 px-3.5 py-2 font-semibold uppercase tracking-[0.06em] text-white', stage ? 'text-[20px]' : 'text-[14px]')}>
        {str(fields.title)}
        {draft && <span className="ml-1 inline-block h-3.5 w-1.5 animate-blink bg-accent align-middle" />}
      </div>
      <div className="px-3.5 py-2.5">
        <Markdown text={str(fields.body)} />
      </div>
      {footer && <div className="border-t border-line/40 px-3.5 py-1.5 font-mono text-[11px] text-dim">{footer}</div>}
    </div>
  )
}

registerPresentation('card', Card)

function CodeView({ fields, draft }: PresentationProps) {
  const code = str(fields.code)
  const lines = code.split('\n')
  const label = str(fields.title) || str(fields.language) || 'Code'
  return (
    <div className="flex flex-col border border-line/60 bg-black/70">
      <div className="flex items-center gap-2 border-b border-line/50 px-3 py-1.5">
        <span className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-accent-soft">{label}</span>
        {str(fields.title) && str(fields.language) && <span className="font-mono text-[10px] text-faint">{str(fields.language)}</span>}
        {!draft && (
          <button onClick={() => void copyText(code)} className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-dim hover:text-white">
            Copy
          </button>
        )}
      </div>
      <div className="max-h-[480px] overflow-auto py-2">
        <table className="font-mono text-[12.5px] leading-relaxed">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i}>
                <td className="select-none pl-3 pr-3 text-right align-top text-faint">{i + 1}</td>
                <td className="whitespace-pre pr-4 text-white/90">{line || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DocumentView({ fields, draft, stage }: PresentationProps) {
  return (
    <article className={cn('border border-line/50 bg-[#0e1016] px-6 py-5', stage && 'px-10 py-8')}>
      <h1 className={cn('mb-3 border-b border-line/40 pb-2 font-semibold text-white', stage ? 'text-[26px]' : 'text-[19px]')}>
        {str(fields.title)}
        {draft && <span className="ml-1 inline-block h-4 w-1.5 animate-blink bg-accent align-middle" />}
      </h1>
      <div className={cn('leading-relaxed', stage ? 'text-[16.5px]' : 'text-[14.5px]')}>
        <Markdown text={str(fields.body)} />
      </div>
    </article>
  )
}

registerPresentation('code', CodeView)
registerPresentation('document', DocumentView)
