import { mapStyleValues, type LookFont, type LookImages } from '@shared/themeLook'
import type { ThemeDraft } from '@shared/theme'
import { data } from '../data/hub'
import { readPortabilityPrefs } from '../portability/prefs'
import { isFontFile, rasterHeader } from '../util/imageHeader'
import { noteFailure } from '../util/report'

const CSS_ASSET = /url\(\s*(['"]?)(a_[a-z0-9]+)\1\s*\)/g

function bytesOf(id: string): Buffer | null {
  const meta = data.assets.metaFor(id)
  return meta ? data.assets.readBytes(meta) : null
}

export function checkThemeFiles(draft: ThemeDraft): ThemeDraft {
  const max = readPortabilityPrefs().maxPictureSide
  const dropped = new Set<string>()
  const picture = (id: string | undefined): string | undefined => {
    if (!id) return id
    const bytes = bytesOf(id)
    const head = bytes ? rasterHeader(bytes) : null
    if (head && head.width <= max && head.height <= max) return id
    dropped.add(id)
    return undefined
  }
  const font = (f: LookFont | undefined): LookFont | undefined => {
    if (!f?.file) return f
    const bytes = bytesOf(f.file)
    if (bytes && isFontFile(bytes)) return f
    dropped.add(f.file)
    return { ...f, file: null }
  }
  const frameImage = picture(draft.images.frame?.image)
  const images: LookImages = {
    ...draft.images,
    ground: picture(draft.images.ground),
    surface: picture(draft.images.surface),
    divider: picture(draft.images.divider),
    frame: draft.images.frame && frameImage ? draft.images.frame : undefined
  }
  const fonts = Object.fromEntries(Object.entries(draft.fonts).map(([role, f]) => [role, font(f)])) as ThemeDraft['fonts']
  const surfaces = Object.fromEntries(
    Object.entries(draft.surfaces ?? {}).map(([id, style]) => [id, mapStyleValues(style, (v) => v.replace(CSS_ASSET, (whole, _q: string, asset: string) => (picture(asset) ? whole : 'none')))])
  )
  if (dropped.size) {
    noteFailure(
      new Error(`Not a PNG, JPEG, WebP or GIF within ${max}px (or not a font file): ${[...dropped].join(', ')}`),
      'themes',
      `Some files in ${draft.name} were left out`
    )
  }
  return { ...draft, images: Object.fromEntries(Object.entries(images).filter(([, v]) => v !== undefined)) as LookImages, fonts, surfaces }
}
