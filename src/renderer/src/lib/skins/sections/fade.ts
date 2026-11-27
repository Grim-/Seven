import { registerSkinSection } from './registry'

registerSkinSection({
  vars: (theme) => ({ '--chat-fade-opacity': String(theme.chatFadeOpacity) })
})
