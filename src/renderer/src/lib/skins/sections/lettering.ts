import { present, registerSkinSection } from './registry'

registerSkinSection({
  vars: (theme) =>
    present({
      '--caps-spacing': theme.lettering.capsSpacing === undefined ? undefined : String(theme.lettering.capsSpacing),
      '--size-adjust': theme.lettering.sizeAdjust === undefined ? undefined : String(theme.lettering.sizeAdjust)
    }),
  read: (read) => ({ lettering: { capsSpacing: read.number('--caps-spacing'), sizeAdjust: read.number('--size-adjust') } })
})
