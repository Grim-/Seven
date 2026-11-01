import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { showName } from '@shared/ids'
import type { WorkoutTarget } from '@shared/types'
import { ACCENT, AXIS, GRID, TOOLTIP, shortDate } from './chartStyle'
import { metricText, type Metric, type SessionPoint } from './stats'

type TargetInfo = { target: WorkoutTarget; workout: string | null } | null

export function ExerciseProgress({ unit, series, metric, target }: { unit: string; series: SessionPoint[]; metric: Metric; target: TargetInfo }) {
  const data = series.map((p) => ({ ...p, label: shortDate(p.date) }))
  const top = target && metric === 'best' ? target.target.max : null
  if (!series.length) return <div className="text-[12.5px] text-faint">Not logged yet.</div>
  return (
    <div className="flex flex-col gap-3">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" {...AXIS} tickLine={false} minTickGap={20} />
            <YAxis {...AXIS} tickLine={false} allowDecimals={false} width={44} />
            <Tooltip {...TOOLTIP} cursor={{ stroke: 'rgba(255,201,25,0.4)' }} formatter={(v) => [metricText(Number(v)), metric === 'best' ? 'Best set' : 'Total']} />
            {top !== null && <ReferenceLine y={top} stroke="rgba(255,255,255,0.35)" label={{ value: 'top of target', fill: 'rgba(255,255,255,0.55)', fontSize: 11, position: 'insideTopRight' }} />}
            <Line dataKey={metric} stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT, stroke: '#0b0d12', strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SessionTable unit={unit} series={series} />
    </div>
  )
}

export function SessionTable({ unit, series }: { unit: string; series: SessionPoint[] }) {
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="border-b border-line/40 text-left text-dim">
          <th className="py-1 font-normal">Date</th>
          <th className="py-1 font-normal">Sets{unit ? ` (${unit})` : ""}</th>
          <th className="py-1 text-right font-normal">Best</th>
          <th className="py-1 text-right font-normal">Total</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {[...series].reverse().map((p) => (
          <tr key={p.date} className="border-b border-line/15">
            <td className="py-1 text-white/85">{p.date}</td>
            <td className="py-1 font-mono text-white/85">{p.values.map((v) => metricText(v)).join(' · ')}</td>
            <td className="py-1 text-right text-white">{metricText(p.best)}</td>
            <td className="py-1 text-right text-white">{metricText(p.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function progressSummary(series: SessionPoint[], metric: Metric, unit: string, target: TargetInfo, workoutName: (id: string) => string): string {
  const peak = series.reduce((m, p) => Math.max(m, p[metric]), 0)
  const aim = target && metric === 'best' ? ` · target ${target.target.min}-${target.target.max}${target.workout ? ` in ${showName(workoutName(target.workout))}` : ''}` : ''
  return `${metric === 'best' ? 'Best set per session' : 'Total per session'} · peak ${metricText(peak)} ${unit}${aim}`
}
