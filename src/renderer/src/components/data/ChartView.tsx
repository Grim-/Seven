import { useMemo } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FieldValue } from '@shared/types'
import { compare } from '@shared/records'
import type { BodyProps } from './CollectionView'

const AXIS = { stroke: 'var(--color-line)', tick: { fill: 'var(--color-dim)', fontSize: 11, fontFamily: 'var(--font-data)' } }

function label(value: FieldValue | undefined): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.join(', ') || '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export function ChartBody({ page, records, options, compact }: BodyProps) {
  const x =
    (typeof options.x === 'string' ? page.fields.find((f) => f.name === options.x) : undefined) ??
    page.fields.find((f) => f.type === 'date') ??
    page.fields.find((f) => f.type === 'select') ??
    page.fields[0]
  const y = typeof options.y === 'string' ? page.fields.find((f) => f.name === options.y && f.type === 'number') : page.fields.find((f) => f.type === 'number')
  const aggregate = typeof options.aggregate === 'string' ? options.aggregate : y ? 'sum' : 'count'
  const kind = typeof options.chart === 'string' ? options.chart : x?.type === 'date' ? 'line' : 'bar'

  const points = useMemo(() => {
    if (!x) return []
    const groups = new Map<string, { raw: FieldValue | undefined; values: number[]; count: number }>()
    for (const r of records) {
      const raw = x.type === 'date' && typeof r.values[x.name] === 'string' ? (r.values[x.name] as string).slice(0, 10) : r.values[x.name]
      const k = label(raw)
      const g = groups.get(k) ?? { raw, values: [], count: 0 }
      g.count += 1
      const v = y ? r.values[y.name] : null
      if (typeof v === 'number') g.values.push(v)
      groups.set(k, g)
    }
    let entries = [...groups.entries()]
    if (x.type === 'select') entries.sort((a, b) => x.options.indexOf(String(a[1].raw)) - x.options.indexOf(String(b[1].raw)))
    else entries.sort((a, b) => compare(a[1].raw, b[1].raw))
    entries = entries.slice(-200)
    return entries.map(([k, g]) => {
      const vals = g.values
      const value =
        aggregate === 'count' || !y
          ? g.count
          : !vals.length
            ? 0
            : aggregate === 'average'
              ? vals.reduce((a, b) => a + b, 0) / vals.length
              : aggregate === 'min'
                ? Math.min(...vals)
                : aggregate === 'max'
                  ? Math.max(...vals)
                  : vals.reduce((a, b) => a + b, 0)
      return { x: k, value: Math.round(value * 100) / 100 }
    })
  }, [records, x, y, aggregate])

  if (!x) return <div className="p-2 text-[12.5px] text-dim">Nothing to chart.</div>
  if (!points.length) return <div className="p-2 text-[12.5px] text-dim">No records to chart yet.</div>
  const name = y && aggregate !== 'count' ? `${aggregate} of ${y.name}` : 'count'
  const common = { data: points, margin: { top: 8, right: 12, bottom: 0, left: -12 } }
  const grid = <CartesianGrid stroke="color-mix(in srgb, var(--color-ink) 6%, transparent)" vertical={false} />
  const xAxis = <XAxis dataKey="x" {...AXIS} tickLine={false} minTickGap={12} />
  const yAxis = <YAxis {...AXIS} tickLine={false} allowDecimals width={44} />
  const tip = (
    <Tooltip
      contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-line-strong)', borderRadius: 0, fontSize: 12 }}
      labelStyle={{ color: 'var(--color-ink)' }}
      itemStyle={{ color: 'var(--color-accent)' }}
      cursor={{ fill: 'color-mix(in srgb, var(--color-accent) 6%, transparent)', stroke: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' }}
    />
  )

  return (
    <div className={compact ? 'h-60' : 'h-full min-h-48'}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'bar' ? (
          <BarChart {...common}>
            {grid}
            {xAxis}
            {yAxis}
            {tip}
            <Bar dataKey="value" name={name} fill="var(--color-accent)" fillOpacity={0.85} maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        ) : kind === 'area' ? (
          <AreaChart {...common}>
            {grid}
            {xAxis}
            {yAxis}
            {tip}
            <Area dataKey="value" name={name} stroke="var(--color-accent)" strokeWidth={2} fill="var(--color-accent)" fillOpacity={0.15} isAnimationActive={false} />
          </AreaChart>
        ) : (
          <LineChart {...common}>
            {grid}
            {xAxis}
            {yAxis}
            {tip}
            <Line dataKey="value" name={name} stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-accent)' }} isAnimationActive={false} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
