import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TimelineRow } from '@shared/timeline'
import { engine } from '../../lib/ipc'
import { formatRelative } from '../../lib/format'
import { KindIcon, onLibraryChange, openEntry } from '../../lib/library'
import { ThemeGlance } from '../themes/ThemeControl'
import { WorkoutState, lastDone, openWorkout, useWorkout } from '../workout/Workout'
import { useTools } from '../../store/tools'
import { modelName, useModels } from '../../store/models'
import { useVault } from '../../store/vault'
import { cn } from '../../lib/cn'
import { PlayerGlance } from '../shell/Player'
import { useNow } from '../../lib/useNow'
import { gigabytes, useSystemStats } from '../../lib/systemStats'
import { useReminderList } from '../../lib/reminders'
import { Field, Meter, Select } from '../ui'
import { Database } from 'lucide-react'
import type { WidgetChoice, WidgetProviderInfo } from '@shared/types'
import { glanceView, registerGlanceView } from '../../registries/glances'
import { MissingWidget, registerWidgetUi, type WidgetBodyProps, type WidgetEditorProps } from '../../registries/widgets'

function Label({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-soft">{children}</div>
}

function greeting(hour: number): string {
  if (hour < 5) return 'Late night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function ClockGlance() {
  const now = new Date(useNow(1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 overflow-hidden">
      <Label>{greeting(now.getHours())}</Label>
      <div className="font-mono text-[44px] font-bold leading-none tabular-nums text-white">
        {pad(now.getHours())}:{pad(now.getMinutes())}
        <span className="ml-1 text-[22px] text-accent">{pad(now.getSeconds())}</span>
      </div>
      <div className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-teal/80">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  )
}

function when(time: number): string {
  const d = new Date(time)
  const today = new Date()
  const tomorrow = new Date(Date.now() + 86_400_000)
  const hm = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return hm
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${hm}`
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ${hm}`
}

function Row({ icon, title, meta, onClick, hot }: { icon: ReactNode; title: string; meta: string; onClick?: () => void; hot?: boolean }) {
  return (
    <button onClick={onClick} className="shell-row flex w-full items-center gap-2.5 px-2 py-1.5 text-left">
      <span className={cn('shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5', hot ? 'text-accent' : 'text-teal/70')}>{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-white/90">{title}</span>
      <span className="shrink-0 font-mono text-[10.5px] text-faint">{meta}</span>
    </button>
  )
}

function WorkoutLine() {
  const { overview, error } = useWorkout()
  if (error) return <WorkoutState error={error} />
  if (!overview) return null
  const last = lastDone(overview)
  const doneToday = overview.history.find((h) => h.date === overview.today)
  return (
    <Row
      icon={<KindIcon name="dumbbell" />}
      hot={!doneToday}
      title={doneToday ? `Done: ${doneToday.label}` : last ? `Last: ${last.label}` : 'No workout done yet'}
      meta={overview.history[0] ? `last ${overview.history[0].date}` : ''}
      onClick={() => (last ? openEntry('workout', last.id) : openWorkout())}
    />
  )
}

function TodayGlance() {
  const workoutOn = useTools((s) => s.list.some((m) => m.id === 'workout' && m.state === 'on'))
  const reminders = useReminderList().list ?? []
  const upcoming = useMemo(
    () =>
      reminders
        .filter((r) => r.enabled)
        .sort((a, b) => a.next - b.next)
        .slice(0, 6),
    [reminders]
  )
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto">
      {workoutOn && (
        <div className="flex flex-col gap-1">
          <Label>Training</Label>
          <WorkoutLine />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label>Coming up</Label>
        {upcoming.length ? (
          upcoming.map((r) => <Row key={r.id} icon={<KindIcon name="alarm-clock" />} title={r.text} meta={when(r.next)} hot={r.next - Date.now() < 3_600_000} onClick={() => openEntry('reminder', r.id)} />)
        ) : (
          <div className="px-2 text-[12px] text-faint">Nothing scheduled.</div>
        )}
      </div>
    </div>
  )
}

function RecentGlance() {
  const [rows, setRows] = useState<TimelineRow[]>([])
  useEffect(() => {
    const load = () => void engine('timeline.recent', { limit: 14 }).then(setRows).catch(() => undefined)
    load()
    return onLibraryChange(load)
  }, [])
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto">
      {!rows.length && <div className="px-2 text-[12px] text-faint">Nothing yet.</div>}
      {rows.map((r) => (
        <Row key={`${r.kind}/${r.id}/${r.at}`} icon={<KindIcon name={r.icon} />} title={r.title} meta={`${r.what} · ${formatRelative(r.at)}`} onClick={() => openEntry(r.kind, r.id)} />
      ))}
    </div>
  )
}

function SystemGlance() {
  const stats = useSystemStats()
  const host = useModels((s) => s.host)
  const models = useModels((s) => s.list)
  const vault = useVault((s) => s.status)
  const model = host.status === 'ready' ? modelName(models, host.modelId) : host.status === 'loading' ? `loading ${Math.round(host.progress * 100)}%` : host.status === 'error' ? 'error' : 'none loaded'
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden">
      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
        <span className="truncate text-white/90">
          <span className={cn('mr-1.5 inline-block h-1.5 w-1.5', host.status === 'ready' ? 'bg-teal' : host.status === 'loading' ? 'bg-accent' : host.status === 'error' ? 'bg-alert' : 'bg-faint')} />
          {model}
        </span>
        {vault.configured && <span className={vault.unlocked ? 'text-teal/80' : 'text-faint'}>vault {vault.unlocked ? 'open' : 'locked'}</span>}
      </div>
      {stats && (
        <>
          <Meter label="CPU" value={stats.cpu === null ? null : stats.cpu / 100} text={`${stats.cpu ?? '—'}%`} />
          <Meter label="RAM" value={stats.ramUsed / stats.ramTotal} text={`${gigabytes(stats.ramUsed)} / ${gigabytes(stats.ramTotal)} GB`} />
          {stats.vramTotal !== null && <Meter label="VRAM" value={(stats.vramUsed ?? 0) / stats.vramTotal} text={`${gigabytes(stats.vramUsed ?? 0)} / ${gigabytes(stats.vramTotal)} GB`} />}
        </>
      )}
    </div>
  )
}

registerGlanceView('clock', { View: ClockGlance })
registerGlanceView('today', { View: TodayGlance })
registerGlanceView('recent', { View: RecentGlance })
registerGlanceView('system', { View: SystemGlance })
registerGlanceView('player', { View: PlayerGlance })
registerGlanceView('theme', { View: ThemeGlance })

function glanceChoices(info: WidgetProviderInfo, modules: { id: string; state: string }[]): WidgetChoice[] {
  return (info.choices ?? []).filter((c) => !c.module || modules.some((m) => m.id === c.module && m.state === 'on'))
}

function GlanceWidgetBody({ widget }: WidgetBodyProps) {
  const glance = glanceView(String(widget.source.tool))
  return glance ? <glance.View /> : <MissingWidget what="tool" />
}

function GlanceWidgetEditor({ source, info, onChange }: WidgetEditorProps) {
  const choices = glanceChoices(info, useTools((s) => s.list))
  return (
    <Field label="Tool">
      <Select value={String(source.tool ?? '')} options={choices.map((c) => ({ value: c.id, label: c.label }))} onChange={(tool) => onChange({ ...source, tool })} />
    </Field>
  )
}

registerWidgetUi('tool', {
  Body: GlanceWidgetBody,
  Editor: GlanceWidgetEditor,
  blank: (info) => ({ kind: 'tool', tool: glanceChoices(info, useTools.getState().list)[0]?.id ?? '' }),
  choices: { heading: 'Glances', meta: 'glance', icon: <Database className="h-3.5 w-3.5 text-dim" />, source: (id) => ({ kind: 'tool', tool: id }) },
  entry: (source) => glanceView(String(source.tool))?.entry ?? null
})
