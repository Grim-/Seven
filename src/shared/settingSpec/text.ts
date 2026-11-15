import { registerSettingType } from './spec'

const MAX_TEXT = 80

registerSettingType({
  type: 'text',
  schema: () => ({ type: 'string' }),
  clean: (_spec, value) => (typeof value === 'string' ? value.slice(0, MAX_TEXT) : undefined)
})
