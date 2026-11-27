import { TunableRow } from '../../ui'
import { LabelledNumber } from './LabelledNumber'
import { PictureField } from '../../pictures/PictureField'
import type { SurfaceStyle } from '@shared/themeLook'
import { readProps, writeProps, type SurfacePart } from '../../../lib/skins/surfaceCss'
import { AnchorGrid, type Anchor } from './AnchorGrid'
import { assetIn, assetValue } from './cssAsset'

const PROPS = ['background-image', 'width', 'height', 'left', 'top', 'transform'] as const

interface Decor {
  image: string | undefined
  anchor: Anchor
  x: number
  y: number
  width: number
  height: number
  turn: number
}

function place(value: string): { at: number; by: number } {
  const calc = /(-?[\d.]+)%\s*([+-])\s*([\d.]+)px/.exec(value)
  if (calc) return { at: Number(calc[1]), by: Number(calc[3]) * (calc[2] === '-' ? -1 : 1) }
  const pct = /^(-?[\d.]+)%$/.exec(value)
  if (pct) return { at: Number(pct[1]), by: 0 }
  return { at: 0, by: parseFloat(value) || 0 }
}

function read(style: SurfaceStyle, part: SurfacePart): Decor {
  const now = readProps(style, part, PROPS)
  const left = place(now.left)
  const top = place(now.top)
  return {
    image: assetIn(now['background-image']),
    anchor: { x: left.at, y: top.at },
    x: left.by,
    y: top.by,
    width: parseFloat(now.width) || 48,
    height: parseFloat(now.height) || 48,
    turn: parseFloat(/rotate\((-?[\d.]+)deg\)/.exec(now.transform)?.[1] ?? '0') || 0
  }
}

function staticSurface(surface: string): boolean {
  const el = document.querySelector(`[data-skin-surface="${CSS.escape(surface)}"]`)
  return Boolean(el && getComputedStyle(el).position === 'static')
}

export function DecorPlacement({ style, onChange, part, label, surface }: { style: SurfaceStyle; onChange: (next: SurfaceStyle) => void; part: SurfacePart; label: string; surface: string }) {
  const now = read(style, part)
  const write = (next: Partial<Decor>) => {
    const d = { ...now, ...next }
    const on = Boolean(d.image)
    let out = writeProps(style, part, {
      content: on ? '""' : null,
      position: on ? 'absolute' : null,
      'pointer-events': on ? 'none' : null,
      'background-image': d.image ? assetValue(d.image) : null,
      'background-size': on ? '100% 100%' : null,
      'background-repeat': on ? 'no-repeat' : null,
      width: on ? `${d.width}px` : null,
      height: on ? `${d.height}px` : null,
      left: on ? `calc(${d.anchor.x}% + ${d.x}px)` : null,
      top: on ? `calc(${d.anchor.y}% + ${d.y}px)` : null,
      transform: on ? `translate(-${d.anchor.x}%, -${d.anchor.y}%) rotate(${d.turn}deg)` : null
    })
    if (on && !now.image && staticSurface(surface)) out = writeProps(out, '', { position: 'relative' })
    onChange(out)
  }
  return (
    <TunableRow label={label} hint="A picture pinned to this surface, such as a clasp or a corner piece." changed={Boolean(now.image)} onReset={() => write({ image: undefined })} wide>
      <div className="flex flex-col gap-3">
        <PictureField value={now.image ?? null} options={{ what: 'a decoration' }} onChange={(id) => write({ image: id ?? undefined })} />
        {now.image && (
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1">
              <span className="type-label text-[10.5px] text-faint">Pinned to</span>
              <AnchorGrid value={now.anchor} onChange={(anchor) => write({ anchor })} />
            </label>
            <LabelledNumber className="w-24" label="Across (px)" value={now.x} onChange={(x) => write({ x })} />
            <LabelledNumber className="w-24" label="Down (px)" value={now.y} onChange={(y) => write({ y })} />
            <LabelledNumber className="w-24" label="Width (px)" value={now.width} min={1} onChange={(width) => write({ width })} />
            <LabelledNumber className="w-24" label="Height (px)" value={now.height} min={1} onChange={(height) => write({ height })} />
            <LabelledNumber className="w-24" label="Turn (°)" value={now.turn} min={-360} max={360} onChange={(turn) => write({ turn })} />
          </div>
        )}
      </div>
    </TunableRow>
  )
}

