import { HEADING_MARK } from '@shared/themeLook'
import { present, registerSkinSection } from './registry'

function unquote(value: string): string | undefined {
  const inner = value.replace(/^(['"])(.*)\1$/, '$2')
  return HEADING_MARK.test(inner) ? inner : undefined
}

registerSkinSection({
  vars: (theme) =>
    present({
      '--heading-mark': theme.ornament.headingMark === undefined ? undefined : `"${theme.ornament.headingMark}"`,
      '--scanlines': theme.ornament.scanlines === undefined ? undefined : String(theme.ornament.scanlines),
      '--vignette': theme.ornament.vignette === undefined ? undefined : String(theme.ornament.vignette)
    }),
  read: (read) => ({ ornament: { headingMark: unquote(read.value('--heading-mark')), scanlines: read.number('--scanlines'), vignette: read.number('--vignette') } })
})
