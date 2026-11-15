import { useState } from 'react'
import { Eye, EyeOff, Layers } from 'lucide-react'
import { Button, Eyebrow, FaceCount, Popover } from '../ui'
import { CardBack } from './CardBack'
import { LiveCard } from './LiveCard'
import type { HeldCard } from './useHeldCards'

export function HandChip({ name, held }: { name: string; held: HeldCard[] }) {
  const [fronts, setFronts] = useState(false)
  const total = held.reduce((n, h) => n + h.count, 0)
  return (
    <Popover
      title={`${name}'s hand`}
      side="bottom"
      align="start"
      className="w-[min(34rem,92vw)] gap-2 p-3"
      triggerClassName="h-7 gap-1.5 px-1 font-mono text-[10.5px] text-dim hover:text-white"
      trigger={
        <>
          <span className="flex items-end phone:hidden">
            {held.slice(0, 6).map((h) => (
              <CardBack key={h.id} className="-ml-1.5 w-3.5 first:ml-0" />
            ))}
          </span>
          <Layers className="hidden h-3.5 w-3.5 phone:block" />
          <span>{total}</span>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <Eyebrow>{name}'s hand</Eyebrow>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" icon={fronts ? <EyeOff /> : <Eye />} onClick={() => setFronts(!fronts)}>
          {fronts ? 'Hide fronts' : 'Show fronts'}
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
        {held.map((h) => (
          <div key={h.id} className="relative">
            {fronts ? <LiveCard id={h.id} /> : <CardBack className="w-full" />}
            <FaceCount count={h.count > 1 ? h.count : undefined} />
          </div>
        ))}
      </div>
    </Popover>
  )
}
