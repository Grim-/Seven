import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts'
import type { SessionPoint } from '../../progress/stats'

export function Sparkline({ points, colour }: { points: SessionPoint[]; colour: string }) {
  return (
    <div className="h-6 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            dataKey="total"
            stroke={colour}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
