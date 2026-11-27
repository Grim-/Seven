import { SKIN_SCHEMES, type SkinScheme } from '@shared/themeLook'
import { present, registerSkinSection } from './registry'

registerSkinSection({
  vars: (theme) => present({ '--scheme': theme.scheme ?? undefined }),
  read: (read) => {
    const scheme = read.value('--scheme')
    return { scheme: SKIN_SCHEMES.includes(scheme as SkinScheme) ? (scheme as SkinScheme) : null }
  }
})
