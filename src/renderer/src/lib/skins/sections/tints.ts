import { SKIN_TINTS } from '@shared/themeLook'
import { present, registerSkinSection } from './registry'

registerSkinSection({
  vars: (theme) => present(Object.fromEntries(SKIN_TINTS.map((k) => [`--color-tint-${k}`, theme.tints[k]])))
})
