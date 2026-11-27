import { cn } from '../../../lib/cn'

export interface Anchor {
  x: number
  y: number
}

const STOPS = [0, 50, 100]

export function AnchorGrid({ value, onChange }: { value: Anchor; onChange: (next: Anchor) => void }) {
  return (
    <div className="grid w-fit grid-cols-3 gap-1">
      {STOPS.flatMap((y) =>
        STOPS.map((x) => (
          <button
            key={`${x}:${y}`}
            type="button"
            title={`${x}% across, ${y}% down`}
            onClick={() => onChange({ x, y })}
            className={cn('h-5 w-5 border border-line/60', value.x === x && value.y === y ? 'bg-accent' : 'hover:bg-accent/30')}
          />
        ))
      )}
    </div>
  )
}
