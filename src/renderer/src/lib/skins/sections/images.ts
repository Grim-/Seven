import { cssUrl, present, registerSkinSection } from './registry'

registerSkinSection({
  assets: (theme) => [theme.images.ground, theme.images.surface, theme.images.frame?.image, theme.images.divider].filter((id): id is string => Boolean(id)),
  vars: (theme, url) => {
    const { ground, surface, frame, divider } = theme.images
    return present({
      '--ground-texture': ground ? cssUrl(url(ground)) : undefined,
      '--surface-texture': surface ? cssUrl(url(surface)) : undefined,
      '--frame-image': frame ? cssUrl(url(frame.image)) : undefined,
      '--frame-slice': frame ? frame.slice.join(' ') : undefined,
      '--frame-width': frame ? frame.width.map((w) => `${w}px`).join(' ') : undefined,
      '--divider-image': divider ? cssUrl(url(divider)) : undefined
    })
  }
})
