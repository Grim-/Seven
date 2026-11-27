import { lookOption, lookSlots } from '@shared/themeLook'
import { registerSkinSection } from './registry'

registerSkinSection({
  attrs: (theme) => Object.fromEntries(lookSlots().flatMap((slot): [string, string][] => (lookOption(slot, theme.options[slot]) ? [[`data-look-${slot}`, theme.options[slot]]] : [])))
})
