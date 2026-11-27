import { FRAME_BOUNDS } from '@shared/themeLook'
import { SettingCard, SettingRow } from '../../ui'
import { PictureTune } from './PictureTune'
import { SidesField } from './SidesField'
import { withKey, type SectionProps } from './edit'

export function PicturesPage({ draft, set }: SectionProps) {
  const images = draft.images
  const frame = images.frame
  return (
    <>
      <SettingCard title="Textures" intro="Pictures repeated under the colours, so a small tile is enough. Use a see-through picture so the colour shows.">
        <PictureTune label="Ground" hint="Behind everything." value={images.ground} options={{ what: 'a ground texture' }} onChange={(id) => set({ images: withKey(images, 'ground', id) })} />
        <PictureTune label="Surfaces" hint="On panels, cards and records." value={images.surface} options={{ what: 'a surface texture' }} onChange={(id) => set({ images: withKey(images, 'surface', id) })} />
      </SettingCard>
      <SettingCard title="Panel frame" intro="A picture drawn as the edge of panels. Its corners stay as they are and its sides stretch.">
        <PictureTune label="Frame" value={frame?.image} options={{ what: 'a frame picture' }} onChange={(image) => set({ images: { ...images, frame: image ? { slice: frame?.slice ?? [30, 30, 30, 30], width: frame?.width ?? [12, 12, 12, 12], image } : undefined } })} />
        {frame && (
          <>
            <SettingRow label="Corner size in the picture (px)" hint="Each side can differ, for frames thicker on one edge." wide>
              <SidesField value={frame.slice} min={FRAME_BOUNDS.slice.min} max={FRAME_BOUNDS.slice.max} onChange={(slice) => set({ images: { ...images, frame: { ...frame, slice } } })} />
            </SettingRow>
            <SettingRow label="Edge width on screen (px)" wide>
              <SidesField value={frame.width} min={FRAME_BOUNDS.width.min} max={FRAME_BOUNDS.width.max} onChange={(width) => set({ images: { ...images, frame: { ...frame, width } } })} />
            </SettingRow>
          </>
        )}
      </SettingCard>
      <SettingCard title="Divider">
        <PictureTune label="Divider" hint="Repeated along rules in documents." value={images.divider} options={{ what: 'a divider picture' }} onChange={(id) => set({ images: withKey(images, 'divider', id) })} />
      </SettingCard>
    </>
  )
}
