import { Segmented, Toggle, TunableRow } from '../../ui'
import { PictureField } from '../../pictures/PictureField'
import type { SurfaceStyle } from '@shared/themeLook'
import { readProps, sides, writeProps } from '../../../lib/skins/surfaceCss'
import { SidesField, type Sides } from './SidesField'
import { SliceView } from './SliceView'
import { assetIn, assetValue } from './cssAsset'

const PROPS = ['border-image-source', 'border-image-slice', 'border-image-width', 'border-image-outset', 'border-image-repeat'] as const
const REPEATS = [
  { value: 'stretch', label: 'Stretch' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'round', label: 'Round' },
  { value: 'space', label: 'Space' }
] as const
type Repeat = (typeof REPEATS)[number]['value']

const px = (s: Sides) => s.map((v) => `${v}px`).join(' ')

export function EdgeTiling({ style, onChange }: { style: SurfaceStyle; onChange: (next: SurfaceStyle) => void }) {
  const now = readProps(style, '', PROPS)
  const source = assetIn(now['border-image-source'])
  const fill = /\bfill\b/.test(now['border-image-slice'])
  const slice = sides(now['border-image-slice'], 30)
  const width = sides(now['border-image-width'], 12)
  const outset = sides(now['border-image-outset'], 0)
  const [across = 'stretch', down = across] = now['border-image-repeat'].split(/\s+/).filter(Boolean) as Repeat[]
  const write = (next: { source?: string; slice?: Sides; fill?: boolean; width?: Sides; outset?: Sides; across?: Repeat; down?: Repeat }) => {
    const v = { source, slice, fill, width, outset, across, down, ...next }
    onChange(
      writeProps(style, '', {
        'border-image-source': v.source ? assetValue(v.source) : null,
        'border-image-slice': v.source ? `${v.slice.join(' ')}${v.fill ? ' fill' : ''}` : null,
        'border-image-width': v.source ? px(v.width) : null,
        'border-image-outset': v.source ? px(v.outset) : null,
        'border-image-repeat': v.source ? `${v.across} ${v.down}` : null
      })
    )
  }
  return (
    <TunableRow label="Edge picture" hint="Drawn as this surface's border: the corners stay as they are and the edges tile." changed={Boolean(source)} onReset={() => write({ source: undefined })} wide>
      <div className="flex flex-col gap-3">
        <PictureField value={source ?? null} options={{ what: 'an edge picture' }} onChange={(id) => write({ source: id ?? undefined })} />
        {source && (
          <>
            <SliceView asset={source} slice={slice} onChange={(s) => write({ slice: s })} />
            <span className="type-label text-[11px] text-dim">Corner size in the picture (px)</span>
            <SidesField value={slice} min={0} onChange={(s) => write({ slice: s })} />
            <span className="type-label text-[11px] text-dim">Edge width on screen (px)</span>
            <SidesField value={width} min={0} onChange={(s) => write({ width: s })} />
            <span className="type-label text-[11px] text-dim">Reach outside the surface (px)</span>
            <SidesField value={outset} min={0} onChange={(s) => write({ outset: s })} />
            <div className="flex flex-wrap items-center gap-3">
              <Segmented value={across} options={[...REPEATS]} onChange={(r) => write({ across: r })} />
              <Segmented value={down} options={[...REPEATS]} onChange={(r) => write({ down: r })} />
              <Toggle checked={fill} onChange={(f) => write({ fill: f })} label="Fill the middle" />
            </div>
          </>
        )}
      </div>
    </TunableRow>
  )
}
