import { useState, type MouseEvent, type ReactNode } from 'react'
import { ArrowLeftRight, ArrowUp, Columns3, Plus, Trash2 } from 'lucide-react'
import { MAX_STOPS, type GradientStop } from '@shared/gradient'
import { colourAt, joinColour, splitColour } from '../../lib/gradients'
import { Button } from './Button'
import { HexColor } from './HexColor'
import { SliderNumber } from './SliderNumber'
import { openMenu, type MenuItem } from './ContextMenu'
import { GradientBar } from './GradientBar'

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="type-label text-dim">{label}</span>
      <span className="flex min-w-0 items-center gap-2">{children}</span>
    </>
  )
}

export function GradientField({ stops, onChange, newColour, angle, onAngle, max = MAX_STOPS }: { stops: GradientStop[]; onChange: (stops: GradientStop[]) => void; newColour: string; angle?: number; onAngle?: (angle: number) => void; max?: number }) {
  const [selected, setSelected] = useState(0)
  const at = Math.max(0, Math.min(selected, stops.length - 1))
  const current = stops[at]
  const full = stops.length >= max

  const update = (i: number, patch: Partial<GradientStop>) => onChange(stops.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const addAt = (pos: number) => {
    if (full) return
    const next = stops.length ? [...stops, { color: colourAt(stops, pos), at: pos }] : [{ color: newColour, at: 0 }, { color: `${newColour.slice(0, 7)}00`, at: 100 }]
    onChange(next)
    setSelected(stops.length)
  }
  const addAfter = (i: number) => {
    const sorted = [...stops].sort((a, b) => a.at - b.at)
    const here = stops[i]
    const later = sorted.find((s) => s.at > (here?.at ?? 0))
    addAt(here ? Math.round(later ? (here.at + later.at) / 2 : Math.max(0, here.at - 10)) : 0)
  }
  const remove = (i: number) => {
    onChange(stops.filter((_, j) => j !== i))
    setSelected(Math.max(0, i - 1))
  }
  const reverse = () => onChange(stops.map((s) => ({ ...s, at: 100 - s.at })))
  const evenOut = () => {
    const rank = stops.map((_, i) => i).sort((a, b) => stops[a].at - stops[b].at)
    const last = Math.max(1, stops.length - 1)
    onChange(stops.map((s, i) => ({ ...s, at: Math.round((rank.indexOf(i) / last) * 100) })))
  }

  const stopActions = (i: number): MenuItem[] => [
    { label: 'Add a colour', icon: <Plus />, disabled: full, onSelect: () => addAfter(i) },
    { label: 'Reverse', icon: <ArrowLeftRight />, disabled: stops.length < 2, onSelect: reverse },
    { label: 'Even out', icon: <Columns3 />, disabled: stops.length < 3, onSelect: evenOut },
    { label: 'Remove', icon: <Trash2 />, danger: true, disabled: !stops.length, onSelect: () => remove(i) }
  ]
  const barActions = (pos: number): MenuItem[] => [{ label: 'Add a colour here', icon: <Plus />, disabled: full, onSelect: () => addAt(pos) }, ...stopActions(at).slice(1, 3)]
  const { hex, alpha } = current ? splitColour(current.color) : { hex: newColour.slice(0, 7), alpha: 1 }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <GradientBar
        stops={stops}
        selected={at}
        onSelect={setSelected}
        onMove={(i, pos) => update(i, { at: pos })}
        onAdd={addAt}
        onRemove={remove}
        onStopMenu={(e: MouseEvent, i) => openMenu(e, `Colour ${i + 1}`, stopActions(i))}
        onBarMenu={(e: MouseEvent, pos) => openMenu(e, 'Gradient', barActions(pos))}
      />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        {current && (
          <>
            <Labelled label="Colour">
              <HexColor value={hex} onChange={(h) => update(at, { color: joinColour(h, alpha) })} />
            </Labelled>
            <Labelled label="Opacity">
              <SliderNumber value={Math.round(alpha * 100)} min={0} max={100} onChange={(p) => update(at, { color: joinColour(hex, p / 100) })} />
            </Labelled>
            <Labelled label="Position">
              <SliderNumber value={current.at} min={0} max={100} onChange={(pos) => update(at, { at: pos })} />
            </Labelled>
          </>
        )}
        {onAngle && angle !== undefined && (
          <Labelled label="Angle">
            <SliderNumber value={angle} min={0} max={359} onChange={onAngle} />
            <span className="flex h-6 w-6 items-center justify-center border border-line/60 text-accent [&>svg]:h-3.5 [&>svg]:w-3.5" style={{ transform: `rotate(${angle}deg)` }}>
              <ArrowUp />
            </span>
          </Labelled>
        )}
      </div>
      <span className="flex flex-wrap gap-1.5">
        {stopActions(at).map((a) => (
          <Button key={a.label} size="sm" variant="ghost" icon={a.icon} disabled={a.disabled} onClick={() => a.onSelect?.()}>
            {a.label}
          </Button>
        ))}
      </span>
    </div>
  )
}
