import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WorkoutLogRow } from '@shared/types'
import { Panel } from '../../../ui'
import { ACCENT, AXIS, TOOLTIP, shortDate } from '../../progress/chartStyle'
import { weeklyDays, type Period } from '@shared/workoutInsights'

export function ConsistencyChart({ rows, period }: { rows: WorkoutLogRow[]; period: Period }) {
  const weeks = weeklyDays(rows, period).map((w) => ({
    ...w,
    label: shortDate(w.week),
    shown: w.days || 0.08
  }))
  return (
    <Panel title="Consistency" meta="days trained each week; red weeks had none">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="label" {...AXIS} tickLine={false} minTickGap={16} />
            <YAxis {...AXIS} tickLine={false} allowDecimals={false} domain={[0, 7]} />
            <Tooltip
              {...TOOLTIP}
              cursor={{ fill: 'color-mix(in srgb, var(--color-ink) 4%, transparent)' }}
              formatter={(_v, _n, item) => [
                `${(item.payload as { days: number }).days} days`,
                'Trained'
              ]}
              labelFormatter={(l) => `Week of ${l}`}
            />
            <Bar dataKey="shown" isAnimationActive={false}>
              {weeks.map((w) => (
                <Cell key={w.week} fill={w.days ? ACCENT : 'var(--color-alert)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}
